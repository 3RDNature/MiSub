import { StorageFactory } from '../../storage-adapter.js';
import { createJsonResponse } from '../utils.js';
import { parseNodeInfo } from '../utils/geo-utils.js';
import { calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.js';
import { applyNodeTransformPipeline } from '../../utils/node-transformer.js';
import { KV_KEY_SUBS, KV_KEY_PROFILES } from '../config.js';
import { fetchSubscriptionNodes } from './node-fetcher.js';

/**
 * 生成过期提示节点
 * @param {string} message 提示信息
 * @returns {Array} 节点列表
 */
function generateExpiredNode(message) {
    const errorNodeName = `[提示] ${message}`;
    // 生成一个不可用的节点用于展示信息
    const node = {
        name: errorNodeName,
        type: 'vmess',
        server: '127.0.0.1',
        port: 80,
        uuid: '00000000-0000-0000-0000-000000000000',
        alterId: 0,
        cipher: 'auto',
        tls: false,
        network: 'tcp',
        subscriptionName: '系统提示',
        url: `vmess://${btoa(JSON.stringify({ v: "2", ps: errorNodeName, add: "127.0.0.1", port: "80", id: "00000000-0000-0000-0000-000000000000", aid: "0", scy: "auto", net: "tcp", type: "none", host: "", path: "", tls: "" }))}`
    };
    return [node];
}

/**
 * 处理订阅组模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} profileId - 订阅组ID (可能是 ID, CustomId 或 AccessToken)
 * @param {string} userAgent - 用户代理
 * @param {boolean} applyTransform - 是否应用节点转换规则（智能重命名、前缀等）
 * @returns {Promise<Object>} 处理结果
 */
export async function handleProfileMode(request, env, profileId, userAgent, applyTransform = false) {
    const storageAdapter = StorageFactory.createAdapter(env, await StorageFactory.getStorageType(env));

    // 获取订阅组和所有数据
    const allProfiles = await storageAdapter.get(KV_KEY_PROFILES) || [];
    const allSubscriptions = await storageAdapter.get(KV_KEY_SUBS) || [];

    // --- 核心修改：支持多 Token 匹配逻辑 ---
    let matchedTokenConfig = null;

    // 查找匹配的订阅组
    const profile = allProfiles.find(p => {
        // 1. 匹配原始 ID (管理员/默认链接)
        if (p.id === profileId) return true;
        
        // 2. 匹配旧版 Custom ID
        if (p.customId && p.customId === profileId) return true;
        
        // 3. 匹配多 Token 列表 (Access Tokens)
        if (Array.isArray(p.accessTokens)) {
            const tokenMatch = p.accessTokens.find(t => t.token === profileId && t.enabled !== false);
            if (tokenMatch) {
                matchedTokenConfig = tokenMatch;
                return true;
            }
        }
        return false;
    });

    if (!profile || !profile.enabled) {
        return createJsonResponse({ error: '订阅组不存在或已禁用' }, 404);
    }

    // --- 核心修改：过期时间检查 ---
    // 默认使用全局/旧版设置
    let expiresAt = profile.expiresAt;
    
    // 如果匹配到了特定的 Token，优先使用该 Token 的过期时间
    if (matchedTokenConfig && matchedTokenConfig.expiresAt) {
        expiresAt = matchedTokenConfig.expiresAt;
    }

    // 执行过期检查
    if (expiresAt) {
        const now = new Date();
        const expDate = new Date(expiresAt);
        // 简单的日期比较 (如果 expiresAt 是 YYYY-MM-DD，JS 会解析为 UTC 0点，可能存在时区偏差，但通常足够)
        if (!isNaN(expDate.getTime()) && now > expDate) {
            const expiredNodes = generateExpiredNode(`此订阅链接已于 ${expiresAt} 到期，请联系管理员。`);
            return {
                success: true,
                subscriptions: [],
                nodes: expiredNodes,
                totalCount: 1,
                stats: { protocols: {}, regions: {} }
            };
        }
    }

    // Create a map for quick lookup
    const misubMap = new Map(allSubscriptions.map(item => [item.id, item]));

    const targetMisubs = [];

    // 1. Add subscriptions in order defined by profile
    const profileSubIds = profile.subscriptions || [];
    if (Array.isArray(profileSubIds)) {
        profileSubIds.forEach(id => {
            const sub = misubMap.get(id);
            if (sub && sub.enabled && sub.url.startsWith('http')) {
                targetMisubs.push(sub);
            }
        });
    }

    // 2. Add manual nodes in order defined by profile
    const profileNodeIds = profile.manualNodes || [];
    if (Array.isArray(profileNodeIds)) {
        profileNodeIds.forEach(id => {
            const node = misubMap.get(id);
            if (node && node.enabled && !node.url.startsWith('http')) {
                targetMisubs.push(node);
            }
        });
    }

    // 分离HTTP订阅和手工节点
    const targetSubscriptions = targetMisubs.filter(item => item.url.startsWith('http'));
    const targetManualNodes = targetMisubs.filter(item => !item.url.startsWith('http'));

    // 处理手工节点（直接解析节点URL）
    const manualNodeResults = targetManualNodes.map(node => {
        const nodeInfo = parseNodeInfo(node.url);
        return {
            subscriptionName: node.name || '手工节点',
            url: node.url,
            success: true,
            nodes: [{
                ...nodeInfo,
                subscriptionName: node.name || '手工节点'
            }],
            error: null,
            isManualNode: true
        };
    });

    // 并行获取HTTP订阅节点
    const subscriptionResults = await Promise.all(
        targetSubscriptions.map(sub => fetchSubscriptionNodes(sub.url, sub.name, userAgent, sub.customUserAgent, false, sub.exclude))
    );

    // 合并所有结果
    const allResults = [...subscriptionResults, ...manualNodeResults];

    // 统计所有节点
    const allNodes = [];
    allResults.forEach(result => {
        if (result.success) {
            allNodes.push(...result.nodes);
        }
    });

    // 如果需要应用转换规则，则处理节点名称
    let processedNodes = allNodes;
    if (applyTransform && profile.nodeTransform?.enabled) {
        // 提取节点 URL 列表
        const nodeUrls = allNodes.map(node => node.url);

        // 应用节点转换管道
        // 使用默认模板 '{emoji}{region}-{protocol}-{index}'，如果用户未自定义模板
        const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
        const effectiveTemplate = profile.nodeTransform.rename?.template?.template || defaultTemplate;
        const transformedUrls = applyNodeTransformPipeline(nodeUrls, {
            ...profile.nodeTransform,
            enableEmoji: effectiveTemplate.includes('{emoji}')
        });

        // 重要修复：由于节点转换管道可能会重新排序节点，
        // 不能用原始索引匹配转换后的 URL，必须从转换后的 URL 重新解析所有节点信息
        processedNodes = transformedUrls.map(transformedUrl => {
            const nodeInfo = parseNodeInfo(transformedUrl);
            // 尝试找到原始节点以保留 subscriptionName
            const originalNode = allNodes.find(n => {
                // 通过 URL 的核心部分（服务器和端口）进行匹配
                try {
                    const origUrl = new URL(n.url);
                    const transUrl = new URL(transformedUrl);
                    return origUrl.hostname === transUrl.hostname && origUrl.port === transUrl.port;
                } catch {
                    return false;
                }
            });
            return {
                ...nodeInfo,
                subscriptionName: originalNode?.subscriptionName || nodeInfo.subscriptionName || '未知'
            };
        });
    }

    // 生成统计信息（使用处理后的节点）
    const protocolStats = calculateProtocolStats(processedNodes);
    const regionStats = calculateRegionStats(processedNodes);

    return {
        success: true,
        subscriptions: allResults,
        nodes: processedNodes,
        totalCount: processedNodes.length,
        stats: {
            protocols: protocolStats,
            regions: regionStats
        }
    };
}
