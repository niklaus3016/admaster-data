<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <!-- 顶部状态栏 -->
    <div class="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 py-4 px-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-emerald-400">幸运彩票</h1>
      <div class="text-zinc-400 text-sm">
        {{ currentDate }}
      </div>
    </div>

    <!-- 主要内容 -->
    <div class="flex-1 p-6">
      <!-- 奖金池信息 -->
      <div class="bg-gradient-to-r from-emerald-900/30 to-emerald-700/20 rounded-2xl p-6 border border-emerald-800/30 mb-6">
        <h2 class="text-lg font-semibold mb-4 text-emerald-300">奖金池</h2>
        <div class="flex items-end justify-between">
          <div>
            <p class="text-zinc-400 text-sm mb-1">当前奖金</p>
            <p class="text-4xl font-bold text-white animate-pulse">{{ formatGold(poolStatus.totalAmount) }} 金币</p>
          </div>
          <div class="text-right">
            <p class="text-zinc-400 text-sm mb-1">今日贡献</p>
            <p class="text-xl font-semibold text-emerald-400">{{ formatGold(poolStatus.todayAmount) }} 金币</p>
          </div>
        </div>
        <div class="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" 
            :style="{ width: poolProgress + '%' }"
          ></div>
        </div>
      </div>

      <!-- 奖券信息 -->
      <div class="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 mb-6">
        <h2 class="text-lg font-semibold mb-4 text-white">我的奖券</h2>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-zinc-400 text-sm mb-1">当前拥有</p>
            <p class="text-3xl font-bold text-white">{{ userTickets.length }} 张</p>
          </div>
          <div class="text-right">
            <p class="text-zinc-400 text-sm mb-1">获取方式</p>
            <p class="text-sm text-emerald-400">每日广告满100次自动获得</p>
          </div>
        </div>
      </div>

      <!-- 开奖倒计时 -->
      <div class="bg-gradient-to-r from-amber-900/30 to-amber-700/20 rounded-2xl p-6 border border-amber-800/30 mb-6">
        <h2 class="text-lg font-semibold mb-4 text-amber-300">开奖倒计时</h2>
        <div class="flex items-center justify-center gap-4">
          <div class="bg-zinc-800 rounded-lg p-3 w-16 text-center">
            <p class="text-2xl font-bold text-white">{{ countdown.hours }}</p>
            <p class="text-xs text-zinc-400">时</p>
          </div>
          <div class="text-2xl font-bold text-zinc-400">:</div>
          <div class="bg-zinc-800 rounded-lg p-3 w-16 text-center">
            <p class="text-2xl font-bold text-white">{{ countdown.minutes }}</p>
            <p class="text-xs text-zinc-400">分</p>
          </div>
          <div class="text-2xl font-bold text-zinc-400">:</div>
          <div class="bg-zinc-800 rounded-lg p-3 w-16 text-center">
            <p class="text-2xl font-bold text-white">{{ countdown.seconds }}</p>
            <p class="text-xs text-zinc-400">秒</p>
          </div>
        </div>
        <p class="text-center text-zinc-400 text-sm mt-4">每晚 22:00 准时开奖</p>
      </div>

      <!-- 中奖规则 -->
      <div class="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 mb-6">
        <h2 class="text-lg font-semibold mb-4 text-white">中奖规则</h2>
        <ul class="space-y-3">
          <li class="flex items-center">
            <span class="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center text-red-400 font-bold mr-3">1</span>
            <span class="text-zinc-300">一等奖：1名，获得奖金池的 50%</span>
          </li>
          <li class="flex items-center">
            <span class="w-8 h-8 rounded-full bg-amber-900/50 flex items-center justify-center text-amber-400 font-bold mr-3">2</span>
            <span class="text-zinc-300">二等奖：1名，获得奖金池的 30%</span>
          </li>
          <li class="flex items-center">
            <span class="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center text-emerald-400 font-bold mr-3">3</span>
            <span class="text-zinc-300">三等奖：1名，获得奖金池的 20%</span>
          </li>
        </ul>
      </div>

      <!-- 历史开奖记录 -->
      <div class="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
        <h2 class="text-lg font-semibold mb-4 text-white">历史开奖记录</h2>
        <div v-if="lotteryHistory.length === 0" class="text-center text-zinc-500 py-8">
          暂无开奖记录
        </div>
        <div v-else class="space-y-4">
          <div 
            v-for="item in lotteryHistory" 
            :key="item._id" 
            class="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700"
          >
            <div class="flex justify-between items-center mb-2">
              <p class="font-semibold">{{ item.drawTime }}</p>
              <span class="text-sm text-emerald-400">已开奖</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-sm">
              <div class="text-center">
                <p class="text-red-400 font-bold">一等奖</p>
                <p class="text-zinc-400">{{ item.winners.first || '未开奖' }}</p>
                <p class="text-zinc-300">{{ formatGold(item.prizes.first) }} 金币</p>
              </div>
              <div class="text-center">
                <p class="text-amber-400 font-bold">二等奖</p>
                <p class="text-zinc-400">{{ item.winners.second || '未开奖' }}</p>
                <p class="text-zinc-300">{{ formatGold(item.prizes.second) }} 金币</p>
              </div>
              <div class="text-center">
                <p class="text-emerald-400 font-bold">三等奖</p>
                <p class="text-zinc-400">{{ item.winners.third || '未开奖' }}</p>
                <p class="text-zinc-300">{{ formatGold(item.prizes.third) }} 金币</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部导航栏 -->
    <div class="bg-zinc-900 border-t border-zinc-800 py-3 px-6">
      <div class="flex items-center justify-around">
        <router-link 
          to="/" 
          class="flex flex-col items-center transition-colors"
          :class="$route.path === '/' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span class="text-xs">电子手工</span>
        </router-link>
        <router-link 
          to="/lottery" 
          class="flex flex-col items-center transition-colors"
          :class="$route.path === '/lottery' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span class="text-xs">幸运彩票</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getLotteryPool, getLotteryTickets, getLotteryHistory, getLotterySettings } from '../api/apiService';

// 响应式数据
const poolStatus = ref({ totalAmount: 0, todayAmount: 0 });
const userTickets = ref<any[]>([]);
const lotteryHistory = ref<any[]>([]);
const lotterySettings = ref({ poolPercentage: 5, drawTime: '22:00' });
const isLoading = ref(false);
const countdown = ref({ hours: '00', minutes: '00', seconds: '00' });

// 计算属性
const currentDate = computed(() => {
  const now = new Date();
  return now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
});

const poolProgress = computed(() => {
  // 假设每天目标是100000金币，计算进度
  const target = 100000;
  const progress = Math.min((poolStatus.value.totalAmount / target) * 100, 100);
  return progress;
});

// 方法
const formatGold = (gold: number) => {
  return gold.toLocaleString();
};

const loadLotteryData = async () => {
  isLoading.value = true;
  try {
    // 加载奖金池状态
    const poolResponse = await getLotteryPool();
    if (poolResponse.success && poolResponse.data) {
      poolStatus.value = poolResponse.data;
    }

    // 加载用户奖券
    const ticketsResponse = await getLotteryTickets();
    if (ticketsResponse.success && ticketsResponse.data) {
      userTickets.value = ticketsResponse.data;
    }

    // 加载历史开奖记录
    const historyResponse = await getLotteryHistory();
    if (historyResponse.success && historyResponse.data) {
      lotteryHistory.value = historyResponse.data;
    }

    // 加载彩票设置
    const settingsResponse = await getLotterySettings();
    if (settingsResponse.success && settingsResponse.data) {
      lotterySettings.value = settingsResponse.data;
    }
  } catch (error) {
    console.error('加载彩票数据失败:', error);
  } finally {
    isLoading.value = false;
  }
};

const updateCountdown = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(22, 0, 0, 0);
  
  if (now > target) {
    // 今天已经过了开奖时间，计算到明天的时间
    target.setDate(target.getDate() + 1);
  }
  
  const diff = target.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  countdown.value = {
    hours: hours.toString().padStart(2, '0'),
    minutes: minutes.toString().padStart(2, '0'),
    seconds: seconds.toString().padStart(2, '0')
  };
};

// 生命周期
let countdownInterval: number;

onMounted(() => {
  loadLotteryData();
  updateCountdown();
  countdownInterval = window.setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  clearInterval(countdownInterval);
});
</script>

<style scoped>
/* 可以添加页面特定的样式 */
</style>