<script setup>
import { computed } from 'vue';
import SubConverterSelector from '../../forms/SubConverterSelector.vue';
import NodeTransformSettings from '../../settings/NodeTransformSettings.vue';
import Input from '../../ui/Input.vue';

const props = defineProps({
  localProfile: {
    type: Object,
    required: true
  },
  showAdvanced: {
    type: Boolean,
    default: false
  },
  uiText: {
    type: Object,
    required: true
  },
  prefixToggleOptions: {
    type: Array,
    default: () => []
  },
  createDefaultNodeTransform: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(['toggle-advanced']);

const nodeTransformMode = computed({
  get: () => (props.localProfile.nodeTransform ? 'custom' : 'global'),
  set: (value) => {
    if (value === 'custom') {
      if (!props.localProfile.nodeTransform) {
        props.localProfile.nodeTransform = props.createDefaultNodeTransform();
      }
    } else {
      props.localProfile.nodeTransform = null;
    }
  }
});

// 添加新的 Token
const addAccessToken = () => {
  if (!props.localProfile.accessTokens) {
    props.localProfile.accessTokens = [];
  }
  // 生成一个简单的随机字符串作为默认 Token
  const randomToken = Math.random().toString(36).substring(2, 10);
  props.localProfile.accessTokens.push({
    token: randomToken,
    name: '',
    expiresAt: '',
    enabled: true
  });
};

// 移除 Token
const removeAccessToken = (index) => {
  props.localProfile.accessTokens.splice(index, 1);
};
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <Input 
        id="profile-name"
        v-model="localProfile.name"
        label="订阅组名称"
        placeholder="例如：家庭共享"
      />
    </div>
    <div>
      <Input
        id="profile-custom-id"
        v-model="localProfile.customId"
        label="默认自定义 ID (可选)"
        placeholder="如: home, game (限字母、数字、-、_)"
      />
      <p class="text-xs text-gray-400 mt-1 ml-1">默认的主访问入口，设置后可通过 /token/home 访问。</p>
    </div>
  </div>

  <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center">
        <input
          type="checkbox"
          id="profile-is-public"
          v-model="localProfile.isPublic"
          class="h-4 w-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label for="profile-is-public" class="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          公开展示 (Public)
        </label>
      </div>
      <span class="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full" v-if="localProfile.isPublic">
        将在公开页显示
      </span>
    </div>
    
    <div v-if="localProfile.isPublic" class="animate-fade-in-down">
      <label for="profile-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        公开页描述 / 简介
      </label>
      <textarea
        id="profile-description"
        v-model="localProfile.description"
        rows="2"
        placeholder="简要介绍此订阅组的内容，将在公开页面展示。"
        class="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
      ></textarea>
    </div>
    <div v-else class="text-xs text-gray-400">
      开启后，任何人均可通过公开页面查看此订阅组的名称和简介，并获取订阅链接。
    </div>
  </div>

  <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
    <button 
      type="button" 
      @click="emit('toggle-advanced')"
      class="flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-hidden"
    >
      <span>高级设置 & 共享管理</span>
      <svg :class="{ 'rotate-180': showAdvanced }" class="w-4 h-4 ml-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    
    <div v-show="showAdvanced" class="mt-4 space-y-4 animate-fade-in-down">
      
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 class="text-sm font-medium text-indigo-700 dark:text-indigo-300">多用户共享管理 (Access Tokens)</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">创建额外的 Token 分享给他人，可单独设置到期时间。</p>
          </div>
          <button @click="addAccessToken" type="button" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded transition-colors shadow-sm">
            + 添加共享链接
          </button>
        </div>
        
        <div class="p-3 space-y-2">
          <div v-if="!localProfile.accessTokens || localProfile.accessTokens.length === 0" class="text-sm text-gray-500 text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-dashed border-gray-300 dark:border-gray-700">
            暂无共享链接，点击上方按钮添加。
          </div>
          
          <div v-else v-for="(token, index) in localProfile.accessTokens" :key="index" class="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded border border-gray-100 dark:border-gray-700/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
            <div class="w-full sm:w-1/4">
               <input 
                v-model="token.name" 
                placeholder="备注 (如: 朋友A)" 
                class="w-full px-2 py-1.5 text-xs sm:text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
               />
            </div>
            <div class="w-full sm:w-1/3 flex-1 relative">
               <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <span class="text-gray-400 text-xs">/token/</span>
               </div>
               <input 
                v-model="token.token" 
                placeholder="Token ID" 
                class="w-full pl-14 pr-2 py-1.5 text-xs sm:text-sm font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
               />
            </div>
            <div class="w-full sm:w-auto">
               <input 
                type="date" 
                v-model="token.expiresAt" 
                title="到期时间"
                class="w-full px-2 py-1.5 text-xs sm:text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
               />
            </div>
            <button 
              @click="removeAccessToken(index)" 
              type="button"
              class="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title="删除此共享"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="profile-subconverter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            自定义后端 (可选)
          </label>
          <SubConverterSelector
            id="profile-subconverter"
            v-model="localProfile.subConverter"
            type="backend"
            placeholder="留空则使用全局设置"
            :allowEmpty="true"
          />
        </div>
        <div>
          <label for="profile-subconfig" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            自定义远程配置 (可选)
          </label>
          <SubConverterSelector
            id="profile-subconfig"
            v-model="localProfile.subConfig"
            type="config"
            placeholder="留空则使用全局设置"
            :allowEmpty="true"
          />
        </div>
        <div>
          <label for="profile-expires-at" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            默认到期时间 (Global)
          </label>
          <input
            type="date"
            id="profile-expires-at"
            v-model="localProfile.expiresAt"
            class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:text-white"
          >
          <p class="text-xs text-gray-400 mt-1">此时间仅对使用默认 ID 或未设置单独到期时间的 Token 生效。</p>
        </div>
      </div>

      <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ uiText.prefixTitle }}</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ uiText.manualPrefixLabel }}</label>
            <input
              type="text"
              v-model="localProfile.prefixSettings.manualNodePrefix"
              placeholder="留空则使用全局前缀"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ uiText.manualPrefixToggle }}</label>
            <select
              v-model="localProfile.prefixSettings.enableManualNodes"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ uiText.subscriptionPrefixToggle }}</label>
            <select
              v-model="localProfile.prefixSettings.enableSubscriptions"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option v-for="option in prefixToggleOptions" :key="String(option.value)" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ uiText.nodeTransformTitle }}</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">净化配置来源</label>
            <select
              v-model="nodeTransformMode"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="global">使用全局设置</option>
              <option value="custom">自定义</option>
            </select>
          </div>
        </div>
        <NodeTransformSettings
          v-if="nodeTransformMode === 'custom'"
          :model-value="localProfile.nodeTransform"
          @update:model-value="val => localProfile.nodeTransform = val"
        />
      </div>
    </div>
  </div>
</template>
