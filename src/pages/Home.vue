<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Coins, History, PlayCircle, LogOut, TrendingUp } from 'lucide-vue-next';
import { getUserInfo, rewardGold, getGoldLogs } from '../api/apiService';
import { useAdManager } from '../composables/useAdManager';

interface Record {
  id: string;
  time: string;
  amount: number;
}

const router = useRouter();
const empId = ref(localStorage.getItem('empId') || '');
const userId = ref(localStorage.getItem('userId') || '');

// 状态管理
const currentMonthGold = ref(0);
const lastMonthGold = ref(0);
const todayCoins = ref(0);
const todayTarget = ref(100000);
const records = ref<Record[]>([]);
const isLoading = ref(false);
const isLoadingRecords = ref(false);
const error = ref('');

const isWatching = ref(false);
const showReward = ref<number | null>(null);
const showAllRecords = ref(false);

const adConfig = {
  appId: 'YOUR_APP_ID',
  slotId: 'YOUR_SLOT_ID',
};

const { showRewardVideo } = useAdManager(adConfig);

// 初始化数据
onMounted(async () => {
  if (!empId.value || !userId.value) {
    router.push('/login');
    return;
  }
  await loadUserInfo();
  await loadGoldRecords();
});

// 加载用户金币信息
const loadUserInfo = async () => {
  if (!empId.value || !userId.value) return;
  
  isLoading.value = true;
  error.value = '';
  
  try {
    const response = await getUserInfo(userId.value, empId.value);
    if (response.success && response.data) {
      currentMonthGold.value = response.data.currentMonthGold;
      lastMonthGold.value = response.data.lastMonthGold;
    } else {
      error.value = response.message || '获取金币信息失败';
    }
  } catch (err) {
    console.error('获取金币信息失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};

// 加载金币记录
const loadGoldRecords = async () => {
  if (!userId.value) return;
  
  isLoadingRecords.value = true;
  
  try {
    const response = await getGoldLogs(userId.value);
    if (response.success && response.data) {
      // 转换后端记录格式为前端格式
      records.value = response.data.map((log: any) => ({
        id: log._id,
        time: new Date(log.createTime).toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        }),
        amount: log.gold
      }));
    }
  } catch (err) {
    console.error('获取金币记录失败:', err);
  } finally {
    isLoadingRecords.value = false;
  }
};

// 处理广告观看
const handleWatchAd = async () => {
  if (isWatching.value || !empId.value || !userId.value) return;
  
  isWatching.value = true;
  error.value = '';
  
  try {
    // 调用广告管理逻辑
    const result = await showRewardVideo();
    
    // 调用后端发放金币接口
    const rewardResponse = await rewardGold(userId.value, empId.value, result.ecpm);
    
    if (rewardResponse.success && rewardResponse.data) {
      const earned = rewardResponse.data.gold;
      // 更新本地状态
      currentMonthGold.value = rewardResponse.data.currentMonthGold;
      todayCoins.value += earned;
      // 显示奖励动画
      showReward.value = earned;
      // 重新加载金币记录
      await loadGoldRecords();
      // 3秒后隐藏奖励
      setTimeout(() => {
        showReward.value = null;
      }, 3000);
    } else {
      error.value = rewardResponse.message || '金币发放失败';
    }
  } catch (err) {
    console.error('广告观看失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isWatching.value = false;
  }
};

// 处理登出
const handleLogout = () => {
  localStorage.removeItem('empId');
  localStorage.removeItem('userId');
  localStorage.removeItem('employeeInfo');
  router.push('/login');
};
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0b] text-white pb-12 relative overflow-hidden">
    <!-- 背景装饰光晕 -->
    <div class="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
    <div class="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
    <div class="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

    <!-- Header -->
    <header class="bg-black/40 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex justify-between items-center sticky top-0 z-20">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-linear-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <TrendingUp class="text-white w-5 h-5" />
        </div>
        <div class="flex flex-col">
          <span class="font-bold text-sm tracking-widest uppercase bg-linear-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">广告变现系统</span>
          <span class="text-[10px] text-zinc-400 font-bold tracking-wider">员工ID：{{ empId }}</span>
        </div>
      </div>
      <button @click="handleLogout" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
        <LogOut class="w-4 h-4" />
      </button>
    </header>

    <main class="max-w-md mx-auto px-6 mt-6 space-y-6 relative z-10">
      <!-- Stats Section -->
      <div class="space-y-3">
        <div class="flex justify-between items-end px-2">
          <h2 class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">收益看板</h2>
          <div class="flex items-center gap-1.5">
            <div class="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
            <span class="text-[10px] text-emerald-500 font-mono">实时同步</span>
          </div>
        </div>
        <!-- 错误信息显示 -->
          <div v-if="error" class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-3">
            <p class="text-red-400 text-sm">{{ error }}</p>
          </div>
          
          <!-- 加载状态 -->
          <div v-if="isLoading" class="grid grid-cols-2 gap-3">
            <div class="bg-white/3 border border-white/5 p-4 rounded-[1.25rem] backdrop-blur-md animate-pulse">
              <div class="h-3 bg-white/10 rounded w-1/2 mb-2"></div>
              <div class="h-6 bg-white/10 rounded w-3/4"></div>
            </div>
            <div class="bg-white/3 border border-white/5 p-4 rounded-[1.25rem] backdrop-blur-md animate-pulse">
              <div class="h-3 bg-white/10 rounded w-1/2 mb-2"></div>
              <div class="h-6 bg-white/10 rounded w-3/4"></div>
            </div>
            <div class="bg-white/3 border border-white/5 p-4 rounded-[1.25rem] backdrop-blur-md animate-pulse">
              <div class="h-3 bg-white/10 rounded w-1/2 mb-2"></div>
              <div class="h-6 bg-white/10 rounded w-3/4"></div>
            </div>
            <div class="bg-white/3 border border-white/5 p-4 rounded-[1.25rem] backdrop-blur-md animate-pulse">
              <div class="h-3 bg-white/10 rounded w-1/2 mb-2"></div>
              <div class="h-6 bg-white/10 rounded w-3/4"></div>
            </div>
          </div>
          
          <!-- 金币统计数据 -->
          <div v-else class="grid grid-cols-2 gap-3">
            <div class="group relative bg-white/3 border border-white/5 p-4 rounded-[1.25rem] backdrop-blur-md overflow-hidden transition-all hover:bg-white/5">
              <div class="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 blur-2xl rounded-full -mr-8 -mt-8" />
              <p class="text-zinc-500 text-[9px] uppercase tracking-wider mb-1">上月累计金币</p>
              <p class="text-lg font-light tracking-tight text-blue-400">{{ lastMonthGold.toLocaleString() }}</p>
            </div>
            <div class="group relative bg-linear-to-br from-emerald-500 to-teal-700 p-4 rounded-[1.25rem] shadow-xl shadow-emerald-500/10 overflow-hidden transition-all hover:scale-[1.02]">
              <div class="absolute top-0 right-0 w-16 h-16 bg-white/10 blur-2xl rounded-full -mr-8 -mt-8" />
              <p class="text-emerald-100/60 text-[9px] uppercase tracking-wider mb-1">本月累计金币</p>
              <p class="text-lg font-bold text-white tracking-tight">{{ currentMonthGold.toLocaleString() }}</p>
            </div>
            <div class="group relative bg-white/3 border border-white/5 p-4 rounded-[1.25rem] backdrop-blur-md overflow-hidden transition-all hover:bg-white/5">
              <div class="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 blur-2xl rounded-full -mr-8 -mt-8" />
              <p class="text-zinc-500 text-[9px] uppercase tracking-wider mb-1">今日目标任务</p>
              <p class="text-lg font-light tracking-tight text-purple-400">{{ todayTarget.toLocaleString() }}</p>
            </div>
            <div class="group relative bg-white/3 border border-white/5 p-4 rounded-[1.25rem] backdrop-blur-md overflow-hidden transition-all hover:bg-white/5">
              <div class="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 blur-2xl rounded-full -mr-8 -mt-8" />
              <div 
                class="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest border"
                :class="todayCoins >= todayTarget ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'"
              >
                {{ todayCoins >= todayTarget ? '已完成' : '未完成' }}
              </div>
              <p class="text-zinc-500 text-[9px] uppercase tracking-wider mb-1">今日金币收益</p>
              <p class="text-lg font-light tracking-tight text-amber-400">{{ todayCoins.toLocaleString() }}</p>
            </div>
          </div>
      </div>

      <!-- Ad Trigger - 大圆形按钮 -->
      <div class="flex flex-col items-center justify-center py-2 relative">
        <div class="relative">
          <!-- 按钮背景光晕 -->
          <div 
            class="absolute inset-0 blur-3xl rounded-full transition-all duration-1000"
            :class="[
              isWatching ? 'bg-blue-500 opacity-60 scale-110' : 'bg-emerald-500 opacity-30 scale-100',
              'animate-pulse'
            ]"
          />
          
          <button
            @click="handleWatchAd"
            :disabled="isWatching"
            class="relative w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 transition-all active:scale-90 border-2"
            :class="[
              isWatching 
                ? 'bg-zinc-900/80 border-zinc-800 text-zinc-600 cursor-not-allowed' 
                : 'bg-linear-to-br from-zinc-800 to-black border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-emerald-500/50'
            ]"
          >
            <div :class="{ 'animate-spin': isWatching }">
              <PlayCircle class="w-12 h-12" :class="isWatching ? 'text-zinc-700' : 'text-emerald-400'" />
            </div>
            <div class="text-center">
              <span class="block text-xs font-black uppercase tracking-widest leading-none">
                {{ isWatching ? '正在加载' : '点击赚取金币' }}
              </span>
            </div>
          </button>
        </div>

        <transition name="reward">
          <div v-if="showReward" class="absolute pointer-events-none z-30 top-[-40px]">
            <div class="bg-linear-to-r from-amber-400 to-orange-500 text-white px-8 py-4 rounded-full font-bold shadow-[0_10px_30px_rgba(245,158,11,0.4)] flex items-center gap-3 border border-white/30">
              <Coins class="w-6 h-6 animate-bounce" />
              <span class="text-xl">+{{ showReward }}</span>
            </div>
          </div>
        </transition>
        
        <p class="mt-4 text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-medium">
          {{ isWatching ? '正在为您匹配优质广告资源' : '广告激励已就绪' }}
        </p>
      </div>

      <!-- History Section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between px-2">
          <div class="flex items-center gap-2">
            <History class="w-3 h-3 text-zinc-500" />
            <h2 class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">最近收益</h2>
          </div>
          <button 
            @click="showAllRecords = true"
            class="px-3 py-1 rounded-full bg-white/5 text-[9px] text-emerald-500 uppercase tracking-widest hover:bg-white/10 transition-all font-bold border border-emerald-500/20"
          >
            查看全部
          </button>
        </div>
        <div class="bg-white/2 rounded-4xl border border-white/5 backdrop-blur-md overflow-hidden">
          <div class="divide-y divide-white/3 max-h-[250px] overflow-y-auto no-scrollbar">
            <!-- 加载状态 -->
            <div v-if="isLoadingRecords" class="py-16 text-center">
              <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                <History class="w-5 h-5 text-zinc-700" />
              </div>
              <p class="text-[10px] text-zinc-600 uppercase tracking-widest">加载中...</p>
            </div>
            <!-- 空状态 -->
            <div v-else-if="records.length === 0" class="py-16 text-center">
              <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <History class="w-5 h-5 text-zinc-700" />
              </div>
              <p class="text-[10px] text-zinc-600 uppercase tracking-widest">暂无活动记录</p>
            </div>
            <!-- 记录列表 -->
            <div 
              v-else
              v-for="record in records.slice(0, 5)" 
              :key="record.id" 
              class="px-8 py-5 flex justify-between items-center hover:bg-white/2 transition-colors group"
            >
              <div class="flex flex-col">
                <span class="text-[11px] text-zinc-400 font-mono tracking-tighter">{{ record.time }}</span>
                <span class="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">广告激励成功</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-amber-400 font-mono group-hover:scale-110 transition-transform">+{{ record.amount }}</span>
                <Coins class="w-3 h-3 text-amber-500/50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- View All Records Modal -->
    <transition name="modal">
      <div v-if="showAllRecords" class="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-0 sm:p-6">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showAllRecords = false" />
        <div class="relative w-full max-w-md bg-[#0f0f11] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col max-h-[85vh]">
          <div class="px-8 py-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#0f0f11] z-10">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center">
                <History class="w-4 h-4 text-zinc-400" />
              </div>
              <h3 class="text-sm font-bold uppercase tracking-widest">所有收益记录</h3>
            </div>
            <button 
              @click="showAllRecords = false"
              class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white"
            >
              <LogOut class="w-4 h-4 rotate-90" />
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto no-scrollbar p-4">
            <div class="space-y-2">
              <!-- 加载状态 -->
              <div v-if="isLoadingRecords" class="py-20 text-center">
                <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                  <History class="w-5 h-5 text-zinc-700" />
                </div>
                <p class="text-xs text-zinc-600 uppercase tracking-widest">加载中...</p>
              </div>
              <!-- 空状态 -->
              <div v-else-if="records.length === 0" class="py-20 text-center">
                <p class="text-xs text-zinc-600 uppercase tracking-widest">暂无记录</p>
              </div>
              <!-- 记录列表 -->
              <div 
                v-else
                v-for="record in records" 
                :key="record.id" 
                class="px-6 py-4 rounded-2xl bg-white/2 border border-white/3 flex justify-between items-center"
              >
                <div class="flex flex-col">
                  <span class="text-[11px] text-zinc-400 font-mono tracking-tighter">{{ record.time }}</span>
                  <span class="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">激励视频收益</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-amber-400 font-mono">+{{ record.amount }}</span>
                  <Coins class="w-3 h-3 text-amber-500/50" />
                </div>
              </div>
            </div>
          </div>
          
          <div class="p-8 border-t border-white/5 text-center">
            <p class="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">共计 {{ records.length }} 条记录</p>
          </div>
        </div>
      </div>
    </transition>

    <footer class="text-center mt-8 px-6 pb-8">
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/2 border border-white/5">
        <div class="w-1 h-1 bg-zinc-700 rounded-full" />
        <p class="text-zinc-600 text-[9px] uppercase tracking-[0.4em]">
          安全加密连接已建立
        </p>
        <div class="w-1 h-1 bg-zinc-700 rounded-full" />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.reward-enter-active, .reward-leave-active {
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.reward-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.5);
}
.reward-enter-to {
  opacity: 1;
  transform: translateY(-100px) scale(1.2);
}
.reward-leave-to {
  opacity: 0;
  transform: translateY(-140px) scale(1.5);
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative, .modal-leave-to .relative {
  transform: translateY(100%);
}
</style>
