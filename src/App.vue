<template>
  <div>
    <!-- 安全警告弹窗 -->
    <div v-if="showSecurityAlert" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
      <div class="bg-zinc-900 rounded-2xl border border-red-500/30 p-6 max-w-md w-full">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.77-2.694-.77-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white">安全风险警告</h3>
        </div>
        <div class="space-y-2 mb-6">
          <p class="text-zinc-400 text-sm">检测到您的设备存在以下安全风险：</p>
          <ul class="list-disc list-inside space-y-1 text-red-400 text-sm">
            <li v-for="risk in securityRisks" :key="risk">{{ risk }}</li>
          </ul>
        </div>
        <p class="text-zinc-500 text-xs mb-6">为了保障您的账户安全和公平性，我们无法为存在安全风险的设备提供服务。</p>
        <button
          @click="exitApp"
          class="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold transition-colors"
        >
          退出应用
        </button>
      </div>
    </div>

    <router-view v-slot="{ Component }">
      <transition
        name="fade"
        mode="out-in"
      >
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { performSecurityCheck, getSecurityRisks } from './services/securityCheckService';
import { Capacitor } from '@capacitor/core';

const showSecurityAlert = ref(false);
const securityRisks = ref<string[]>([]);

onMounted(async () => {
  const result = await performSecurityCheck();

  if (!result.isSecure) {
    const risks = await getSecurityRisks();
    securityRisks.value = risks;
    showSecurityAlert.value = true;
  }
});

function exitApp() {
  if (Capacitor.getPlatform() === 'android') {
    try {
      const { App } = require('@capacitor/app');
      App.exitApp();
    } catch (e) {
      console.error('退出应用失败:', e);
      location.reload();
    }
  } else {
    location.reload();
  }
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>