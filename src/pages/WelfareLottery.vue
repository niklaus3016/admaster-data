<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Coins, Gift, Trophy, ArrowRight, LogOut, History, Wallet, CreditCard } from 'lucide-vue-next';
import { getUserInfo, recordAdView, getWelfareLotteryInfo, claimWelfareLottery, getWelfareLotteryRecords, getWelfareWalletBalance, withdrawWelfareFunds } from '../api/apiService';

const router = useRouter();
const empId = ref(localStorage.getItem('empId') || '');
const userId = ref(localStorage.getItem('userId') || '');

// 状态管理
const isLoading = ref(false);
const error = ref('');
const welfareBalance = ref(0);
const lotteryChances = ref(0);
const lotteryItems = ref([
  { id: 1, name: '100元现金', probability: 5, value: 100, type: 'cash' },
  { id: 2, name: '50元现金', probability: 10, value: 50, type: 'cash' },
  { id: 3, name: '20元现金', probability: 15, value: 20, type: 'cash' },
  { id: 4, name: '10元现金', probability: 20, value: 10, type: 'cash' },
  { id: 5, name: '5元现金', probability: 25, value: 5, type: 'cash' },
  { id: 6, name: '手机', probability: 1, value: 5000, type: 'phone' },
  { id: 7, name: '金条', probability: 2, value: 2000, type: 'gold' },
  { id: 8, name: '再接再厉', probability: 22, value: 0, type: 'encourage' }
]);
const isSpinning = ref(false);
const spinResult = ref(null);
const showResultModal = ref(false);
const welfareRecords = ref([]);
const isLoadingRecords = ref(false);
const showRecordsModal = ref(false);
const showWithdrawModal = ref(false);
const withdrawAmount = ref(0);
const alipayAccount = ref('');
const alipayName = ref('');
const withdrawSuccess = ref(false);
const isSubmittingWithdraw = ref(false);

// 计算属性
const canSpin = computed(() => lotteryChances.value > 0 && !isSpinning.value);
const totalProbability = computed(() => lotteryItems.value.reduce((sum, item) => sum + item.probability, 0));

// 加载福利抽奖信息
const loadWelfareInfo = async () => {
  if (!userId.value || !empId.value) return;
  
  isLoading.value = true;
  error.value = '';
  
  try {
    const response = await getWelfareLotteryInfo(userId.value, empId.value);
    if (response.success && response.data) {
      welfareBalance.value = Number(response.data.balance) || 0;
      lotteryChances.value = Number(response.data.chances) || 0;
    } else {
      error.value = response.message || '获取福利抽奖信息失败';
    }
  } catch (err) {
    console.error('获取福利抽奖信息失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};

// 加载福利钱包余额
const loadWelfareBalance = async () => {
  if (!userId.value || !empId.value) return;
  
  try {
    const response = await getWelfareWalletBalance(userId.value, empId.value);
    if (response.success && response.data) {
      welfareBalance.value = Number(response.data.balance) || 0;
    }
  } catch (err) {
    console.error('获取福利钱包余额失败:', err);
  }
};

// 加载福利抽奖记录
const loadWelfareRecords = async () => {
  if (!userId.value || !empId.value) return;
  
  isLoadingRecords.value = true;
  
  try {
    const response = await getWelfareLotteryRecords(userId.value, empId.value);
    if (response.success && response.data) {
      welfareRecords.value = response.data.records || [];
    }
  } catch (err) {
    console.error('获取福利抽奖记录失败:', err);
  } finally {
    isLoadingRecords.value = false;
  }
};

// 处理广告观看
const handleWatchAd = async () => {
  if (!userId.value || !empId.value) return;
  
  isLoading.value = true;
  error.value = '';
  
  try {
    // 记录广告观看
    const adResponse = await recordAdView(userId.value, empId.value, getDeviceId());
    if (adResponse.success) {
      // 增加抽奖机会
      lotteryChances.value += 1;
      // 显示获得抽奖机会的提示
      showRewardAnimation('抽奖机会+1');
    } else {
      error.value = adResponse.message || '广告观看失败';
    }
  } catch (err) {
    console.error('广告观看失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};

// 处理抽奖
const handleSpin = async () => {
  if (!userId.value || !empId.value || !canSpin.value) return;
  
  isSpinning.value = true;
  error.value = '';
  
  try {
    const response = await claimWelfareLottery(userId.value, empId.value);
    if (response.success && response.data) {
      const result = response.data.result;
      spinResult.value = result;
      
      // 减少抽奖机会
      lotteryChances.value -= 1;
      
      // 如果中奖，更新余额
      if (result.type !== 'encourage' && result.value > 0) {
        welfareBalance.value += result.value;
      }
      
      // 显示结果弹窗
      setTimeout(() => {
        showResultModal.value = true;
      }, 3000);
    } else {
      error.value = response.message || '抽奖失败';
      isSpinning.value = false;
    }
  } catch (err) {
    console.error('抽奖失败:', err);
    error.value = '网络错误，请稍后重试';
    isSpinning.value = false;
  }
};

// 处理提现
const handleWithdraw = async () => {
  if (!userId.value || !empId.value || !alipayAccount.value || !alipayName.value) return;
  
  isSubmittingWithdraw.value = true;
  error.value = '';
  
  try {
    const response = await withdrawWelfareFunds(userId.value, empId.value, withdrawAmount.value, alipayAccount.value, alipayName.value);
    if (response.success) {
      withdrawSuccess.value = true;
      welfareBalance.value -= withdrawAmount.value;
      
      // 3秒后关闭弹窗
      setTimeout(() => {
        withdrawSuccess.value = false;
        showWithdrawModal.value = false;
        withdrawAmount.value = 0;
        alipayAccount.value = '';
        alipayName.value = '';
      }, 3000);
    } else {
      error.value = response.message || '提现失败';
    }
  } catch (err) {
    console.error('提现失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isSubmittingWithdraw.value = false;
  }
};

// 获取设备ID
const getDeviceId = () => {
  return localStorage.getItem('deviceId') || 'unknown';
};

// 显示奖励动画
const showRewardAnimation = (message: string) => {
  // 这里可以实现奖励动画逻辑
  console.log('获得奖励:', message);
};

// 打开提现弹窗
const openWithdrawModal = () => {
  withdrawAmount.value = welfareBalance.value;
  alipayAccount.value = '';
  alipayName.value = '';
  withdrawSuccess.value = false;
  showWithdrawModal.value = true;
};

// 关闭提现弹窗
const closeWithdrawModal = () => {
  showWithdrawModal.value = false;
};

// 打开记录弹窗
const openRecordsModal = async () => {
  showRecordsModal.value = true;
  await loadWelfareRecords();
};

// 关闭记录弹窗
const closeRecordsModal = () => {
  showRecordsModal.value = false;
};

// 生命周期
onMounted(async () => {
  await loadWelfareInfo();
  await loadWelfareBalance();
});
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-[#020205] to-[#0a0a1a] text-white">
    <!-- 顶部栏 -->
    <div class="sticky top-0 z-40 bg-black/30 backdrop-blur-md border-b border-white/5 px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
            <Trophy class="w-4 h-4 text-white" />
          </div>
          <h1 class="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">福利抽奖</h1>
        </div>
        <div class="flex items-center gap-3">
          <button 
            @click="openRecordsModal"
            class="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 transition-all"
          >
            <History class="w-3 h-3 mr-1" />
            记录
          </button>
        </div>
      </div>
    </div>

    <!-- 福利钱包 -->
    <div class="px-4 py-6">
      <div class="glass-card rounded-[1.5rem] p-6 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
        <div class="relative z-10">
          <p class="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">福利钱包</p>
          <div class="flex items-end justify-between">
            <p class="text-3xl font-bold text-white tracking-tight">¥{{ welfareBalance.toFixed(2) }}</p>
            <button 
              @click="openWithdrawModal"
              class="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-all"
            >
              <Wallet class="w-4 h-4 mr-2" />
              提现
            </button>
          </div>
          <p class="text-zinc-400 text-xs mt-2">可直接提现到支付宝</p>
        </div>
      </div>
    </div>

    <!-- 抽奖机会 -->
    <div class="px-4 py-4">
      <div class="glass-card rounded-[1.5rem] p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <Gift class="w-5 h-5 text-purple-400 mr-3" />
            <div>
              <p class="text-zinc-500 text-[10px] uppercase tracking-wider">抽奖机会</p>
              <p class="text-xl font-bold text-white">{{ lotteryChances }}</p>
            </div>
          </div>
          <button 
            @click="handleWatchAd"
            class="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 transition-all flex items-center"
          >
            <Coins class="w-4 h-4 mr-2" />
            看广告获取
          </button>
        </div>
      </div>
    </div>

    <!-- 抽奖转盘 -->
    <div class="px-4 py-6 flex flex-col items-center">
      <h2 class="text-lg font-bold mb-6 text-center">幸运转盘</h2>
      <div class="relative w-64 h-64">
        <!-- 转盘背景 -->
        <div class="absolute inset-0 rounded-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30 shadow-lg shadow-purple-500/20" />
        
        <!-- 转盘内容 -->
        <div class="absolute inset-4 rounded-full bg-gradient-to-br from-purple-800/30 to-pink-800/30 border border-purple-500/20 flex items-center justify-center">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 z-10">
            <ArrowRight class="w-6 h-6 text-white" />
          </div>
          
          <!-- 转盘分割线和奖品 -->
          <div class="absolute inset-0 rounded-full overflow-hidden">
            <!-- 这里可以添加转盘的具体奖品分布 -->
            <div class="grid grid-cols-2 grid-rows-2 h-full w-full">
              <div class="border-r border-b border-purple-500/30 flex items-center justify-center p-2">
                <p class="text-center text-sm font-bold">100元现金</p>
              </div>
              <div class="border-b border-purple-500/30 flex items-center justify-center p-2">
                <p class="text-center text-sm font-bold">50元现金</p>
              </div>
              <div class="border-r border-purple-500/30 flex items-center justify-center p-2">
                <p class="text-center text-sm font-bold">手机</p>
              </div>
              <div class="flex items-center justify-center p-2">
                <p class="text-center text-sm font-bold">金条</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 抽奖按钮 -->
      <button 
        @click="handleSpin"
        :disabled="!canSpin"
        class="mt-8 px-8 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center"
        :class="canSpin ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90' : 'bg-zinc-800 text-zinc-400 cursor-not-allowed'"
      >
        <Gift class="w-4 h-4 mr-2" />
        {{ canSpin ? '立即抽奖' : '无抽奖机会' }}
      </button>
    </div>

    <!-- 奖品说明 -->
    <div class="px-4 py-6">
      <h2 class="text-lg font-bold mb-4">奖品说明</h2>
      <div class="glass-card rounded-[1.5rem] p-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3">
                <Coins class="w-4 h-4 text-white" />
              </div>
              <span class="text-sm">现金奖励</span>
            </div>
            <span class="text-xs text-zinc-500">直接进入福利钱包</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mr-3">
                <Trophy class="w-4 h-4 text-white" />
              </div>
              <span class="text-sm">实物奖品</span>
            </div>
            <span class="text-xs text-zinc-500">联系客服领取</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center mr-3">
                <Gift class="w-4 h-4 text-white" />
              </div>
              <span class="text-sm">再接再厉</span>
            </div>
            <span class="text-xs text-zinc-500">下次再来</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 结果弹窗 -->
    <transition name="modal">
      <div v-if="showResultModal" class="fixed inset-0 z-[9999] flex items-center justify-center p-6 pointer-events-auto">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md z-[9998] pointer-events-auto" @click="showResultModal = false" />
        <div class="relative w-full max-w-md bg-gradient-to-br from-purple-900/80 to-pink-900/80 border border-purple-500/30 rounded-[3rem] overflow-hidden flex flex-col items-center p-8 z-[9999] shadow-2xl shadow-purple-500/20">
          <div class="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
            <Trophy class="w-10 h-10 text-white" />
          </div>
          <h3 class="text-2xl font-bold mb-4 text-white">恭喜中奖！</h3>
          <p v-if="spinResult?.type !== 'encourage'" class="text-3xl font-bold mb-6 text-yellow-300">
            {{ spinResult?.name }}
          </p>
          <p v-else class="text-3xl font-bold mb-6 text-zinc-400">
            {{ spinResult?.name }}
          </p>
          <p v-if="spinResult?.type === 'cash'" class="text-sm text-zinc-300 mb-6">
            奖金已存入您的福利钱包
          </p>
          <p v-else-if="spinResult?.type === 'phone' || spinResult?.type === 'gold'" class="text-sm text-zinc-300 mb-6">
            请联系客服领取实物奖品
          </p>
          <button 
            @click="showResultModal = false"
            class="px-8 py-3 rounded-lg text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-all"
          >
            确定
          </button>
        </div>
      </div>
    </transition>

    <!-- 提现弹窗 -->
    <transition name="modal">
      <div v-if="showWithdrawModal" class="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-0 sm:p-6 pointer-events-auto">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md z-[9998] pointer-events-auto" @click="closeWithdrawModal" />
        <div class="relative w-full max-w-md bg-[#020205] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col h-[90vh] max-h-[600px] z-[9999] shadow-2xl">
          <div class="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-[#020205] z-10">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mr-3 border border-purple-500/30">
                <Wallet class="w-4 h-4 text-purple-400" />
              </div>
              <h3 class="text-sm font-bold uppercase tracking-widest">福利提现</h3>
            </div>
            <button 
              @click="closeWithdrawModal"
              class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white"
            >
              <LogOut class="w-4 h-4 rotate-90" />
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto no-scrollbar p-8">
            <div class="space-y-6">
              <!-- 可提现金额 -->
              <div class="glass-card rounded-xl p-4">
                <p class="text-zinc-500 text-xs uppercase tracking-wider mb-2">可提现金额</p>
                <p class="text-2xl font-bold text-white">¥{{ welfareBalance.toFixed(2) }}</p>
              </div>
              
              <!-- 提现金额输入 -->
              <div>
                <label class="block text-zinc-500 text-xs uppercase tracking-wider mb-2">提现金额</label>
                <input 
                  v-model="withdrawAmount" 
                  type="number" 
                  min="0" 
                  :max="welfareBalance" 
                  step="0.01"
                  class="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-purple-500 transition-all"
                  placeholder="请输入提现金额"
                />
              </div>
              
              <!-- 支付宝账号 -->
              <div>
                <label class="block text-zinc-500 text-xs uppercase tracking-wider mb-2">支付宝账号</label>
                <input 
                  v-model="alipayAccount" 
                  type="text"
                  class="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-purple-500 transition-all"
                  placeholder="请输入支付宝账号"
                />
              </div>
              
              <!-- 支付宝姓名 -->
              <div>
                <label class="block text-zinc-500 text-xs uppercase tracking-wider mb-2">支付宝姓名</label>
                <input 
                  v-model="alipayName" 
                  type="text"
                  class="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-purple-500 transition-all"
                  placeholder="请输入支付宝姓名"
                />
              </div>
            </div>
          </div>
          
          <div class="p-8 border-t border-white/5">
            <button 
              @click="handleWithdraw"
              :disabled="isSubmittingWithdraw || !withdrawAmount || !alipayAccount || !alipayName"
              class="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all"
              :class="isSubmittingWithdraw || !withdrawAmount || !alipayAccount || !alipayName ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'"
            >
              {{ isSubmittingWithdraw ? '提交中...' : '确认提现' }}
            </button>
            
            <!-- 提现成功提示 -->
            <div v-if="withdrawSuccess" class="mt-4 p-3 bg-emerald-900/30 rounded-lg border border-emerald-800/50">
              <p class="text-emerald-300 text-sm text-center">提现申请已提交，等待处理</p>
            </div>
            
            <!-- 错误提示 -->
            <div v-if="error" class="mt-4 p-3 bg-red-900/30 rounded-lg border border-red-800/50">
              <p class="text-red-300 text-sm text-center">{{ error }}</p>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 记录弹窗 -->
    <transition name="modal">
      <div v-if="showRecordsModal" class="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-0 sm:p-6 pointer-events-auto">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md z-[9998] pointer-events-auto" @click="closeRecordsModal" />
        <div class="relative w-full max-w-md bg-[#020205] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col h-[90vh] max-h-[600px] z-[9999] shadow-2xl">
          <div class="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-[#020205] z-10">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mr-3 border border-purple-500/30">
                <History class="w-4 h-4 text-purple-400" />
              </div>
              <h3 class="text-sm font-bold uppercase tracking-widest">抽奖记录</h3>
            </div>
            <button 
              @click="closeRecordsModal"
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
              <div v-else-if="welfareRecords.length === 0" class="py-20 text-center">
                <p class="text-xs text-zinc-600 uppercase tracking-widest">暂无抽奖记录</p>
              </div>
              <!-- 记录列表 -->
              <div 
                v-else
                v-for="record in welfareRecords" 
                :key="record.id" 
                class="px-6 py-4 rounded-2xl glass-card flex justify-between items-center min-h-[60px]"
              >
                <div class="flex flex-col">
                  <span class="text-[11px] text-zinc-400 font-mono tracking-tighter">{{ record.time }}</span>
                  <span class="text-[9px] text-zinc-600 uppercase tracking-widest mt-0.5">{{ record.name }}</span>
                </div>
                <div class="flex items-center">
                  <span class="text-sm font-bold" :class="record.value > 0 ? 'text-green-400' : 'text-zinc-400'">{{ record.value > 0 ? `+¥${record.value.toFixed(2)}` : record.name }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="p-8 border-t border-white/5 text-center">
            <p class="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">共计 {{ welfareRecords.length }} 条记录</p>
          </div>
        </div>
      </div>
    </transition>

    <!-- 底部导航栏 -->
    <div class="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-xl border-t border-white/5 py-3 px-6 z-50" style="padding-bottom: calc(3px + var(--safe-area-inset-bottom)); height: calc(60px + var(--safe-area-inset-bottom));">
      <div class="flex items-center justify-around">
        <router-link 
          to="/" 
          class="flex flex-col items-center transition-all duration-300"
          :class="$route.path === '/' ? 'text-emerald-400 scale-105' : 'text-zinc-400 hover:text-zinc-300'"
        >
          <TrendingUp class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">电子手工</span>
        </router-link>
        <router-link 
          to="/lottery" 
          class="flex flex-col items-center transition-all duration-300 relative"
          :class="$route.path === '/lottery' ? 'text-emerald-400 scale-105' : 'text-zinc-400 hover:text-zinc-300'"
        >
          <Ticket class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">幸运彩票</span>
        </router-link>
        <router-link 
          to="/welfare-lottery" 
          class="flex flex-col items-center transition-all duration-300"
          :class="$route.path === '/welfare-lottery' ? 'text-emerald-400 scale-105' : 'text-zinc-400 hover:text-zinc-300'"
        >
          <Trophy class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">福利抽奖</span>
        </router-link>
        <router-link 
          to="/phone-verification" 
          class="flex flex-col items-center transition-all duration-300"
          :class="$route.path === '/phone-verification' ? 'text-emerald-400 scale-105' : 'text-zinc-400 hover:text-zinc-300'"
        >
          <Smartphone class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">手机核销</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义样式 */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>