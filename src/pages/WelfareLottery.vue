<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Gift, Trophy, LogOut, History, Wallet, CreditCard, Sparkles, Zap, ChevronRight, Smartphone, TrendingUp, Ticket, RefreshCw, Handshake } from 'lucide-vue-next';
import { recordAdView, getWelfareLotteryInfo, claimWelfareLottery, getWelfareLotteryRecords, getWelfareWalletBalance, withdrawWelfareFunds, getWelfareLotteryPrizes, bindAlipay, getAlipayInfo, getWelfareWithdrawRecords } from '../api/apiService';
import gold1gImage from '../../gold-1g.png';
import phoneModelImage from '../../phone-model.png';

const empId = ref(localStorage.getItem('empId') || '');

// 状态管理
const isLoading = ref(false);
const error = ref('');
const welfareBalance = ref(0);
const lotteryChances = ref(0);
const lotteryItems = ref([
  { id: '1', name: '1克黄金', probability: 2, value: 500, type: 'gold' },
  { id: '2', name: '1.68元', probability: 20, value: 1.68, type: 'cash' },
  { id: '3', name: '88.8元', probability: 5, value: 88.8, type: 'cash' },
  { id: '4', name: '6.88元', probability: 15, value: 6.88, type: 'cash' },
  { id: '5', name: '千元手机', probability: 1, value: 1000, type: 'phone' },
  { id: '6', name: '16.8元', probability: 12, value: 16.8, type: 'cash' },
  { id: '7', name: '66.8元', probability: 8, value: 66.8, type: 'cash' },
  { id: '8', name: '再接再厉', probability: 37, value: 0, type: 'encourage' }
]);
const isSpinning = ref(false);
const spinResult = ref(null);
const showResultModal = ref(false);
const welfareRecords = ref([]);
const isLoadingRecords = ref(false);
const showRecordsModal = ref(false);
const showWithdrawModal = ref(false);
const showAmountModal = ref(false); // 金额选择弹窗
const withdrawAmount = ref(0);
const alipayAccount = ref('');
const alipayName = ref('');
const withdrawSuccess = ref(false);
const isSubmittingWithdraw = ref(false);
const rotation = ref(0);
const adProgress = ref(0);
const showBindModal = ref(false);
const bindAlipayName = ref('');
const bindAlipayAccount = ref('');
const isSubmittingBind = ref(false);

// 提现次数相关状态
const dailyWithdrawCount = ref(0); // 今日已提现次数
const maxDailyWithdraws = 1; // 每日最大提现次数
const selectedAmount = ref(0); // 已选择的提现金额
const withdrawRecords = ref([]); // 提现记录
const showWithdrawRecordsModal = ref(false); // 提现记录弹窗

// 转盘音效
let spinAudio: HTMLAudioElement | null = null;

// 计算属性
const canSpin = computed(() => lotteryChances.value > 0 && !isSpinning.value);

// 计算剩余提现次数
const remainingWithdraws = computed(() => maxDailyWithdraws - dailyWithdrawCount.value);

// 加载福利抽奖信息
const loadWelfareInfo = async () => {
  console.log('loadWelfareInfo - empId:', empId.value);
  if (!empId.value) {
    console.log('loadWelfareInfo - empId为空');
    return;
  }
  
  isLoading.value = true;
  error.value = '';
  
  try {
    // 获取福利抽奖信息
    console.log('loadWelfareInfo - 开始调用getWelfareLotteryInfo');
    const infoResponse = await getWelfareLotteryInfo(empId.value);
    console.log('loadWelfareInfo - getWelfareLotteryInfo响应:', infoResponse);
    if (infoResponse.success && infoResponse.data) {
      welfareBalance.value = Number(infoResponse.data.balance) || 0;
      lotteryChances.value = Number(infoResponse.data.chances) || 0;
      console.log('loadWelfareInfo - 余额:', welfareBalance.value);
      console.log('loadWelfareInfo - 抽奖机会:', lotteryChances.value);
    } else {
      error.value = infoResponse.message || '获取福利抽奖信息失败';
      console.log('loadWelfareInfo - 获取失败:', error.value);
    }
    
    // 获取奖品列表
    console.log('loadWelfareInfo - 开始调用getWelfareLotteryPrizes');
    const prizesResponse = await getWelfareLotteryPrizes();
    console.log('loadWelfareInfo - getWelfareLotteryPrizes响应:', prizesResponse);
    if (prizesResponse.success && prizesResponse.data) {
      lotteryItems.value = prizesResponse.data.prizes;
      console.log('loadWelfareInfo - 奖品列表:', lotteryItems.value);
    }
    
    // 获取绑定的支付宝信息
    console.log('loadWelfareInfo - 开始调用getAlipayInfo');
    const alipayResponse = await getAlipayInfo(empId.value);
    console.log('loadWelfareInfo - getAlipayInfo响应:', alipayResponse);
    if (alipayResponse.success && alipayResponse.data) {
      bindAlipayName.value = alipayResponse.data.alipayName;
      bindAlipayAccount.value = alipayResponse.data.alipayAccount;
      console.log('loadWelfareInfo - 支付宝信息:', { bindAlipayName: bindAlipayName.value, bindAlipayAccount: bindAlipayAccount.value });
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
  console.log('loadWelfareBalance - empId:', empId.value);
  if (!empId.value) {
    console.log('loadWelfareBalance - empId为空');
    return;
  }
  
  try {
    console.log('loadWelfareBalance - 开始调用getWelfareWalletBalance');
    const response = await getWelfareWalletBalance(empId.value);
    console.log('loadWelfareBalance - getWelfareWalletBalance响应:', response);
    if (response.success && response.data) {
      welfareBalance.value = Number(response.data.balance) || 0;
      console.log('loadWelfareBalance - 余额:', welfareBalance.value);
    }
  } catch (err) {
    console.error('获取福利钱包余额失败:', err);
  }
};

// 加载福利抽奖记录
const loadWelfareRecords = async () => {
  if (!empId.value) return;
  
  isLoadingRecords.value = true;
  
  try {
    const response = await getWelfareLotteryRecords(empId.value);
    if (response.success && response.data) {
      welfareRecords.value = response.data.records || [];
    }
  } catch (err) {
    console.error('获取福利抽奖记录失败:', err);
  } finally {
    isLoadingRecords.value = false;
  }
};

// 加载提现记录
const loadWithdrawRecords = async () => {
  if (!empId.value) return;
  
  isLoading.value = true;
  error.value = '';
  
  try {
    const response = await getWelfareWithdrawRecords(empId.value);
    if (response.success && response.data) {
      withdrawRecords.value = response.data.records;
    }
  } catch (err) {
    console.error('获取提现记录失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};

// 时间格式化函数
const formatTime = (timeString: string) => {
  const date = new Date(timeString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 处理抽奖
const handleSpin = async () => {
  if (!empId.value || !canSpin.value) return;
  
  isSpinning.value = true;
  error.value = '';
  
  // 立即开始旋转（先转一圈）
  rotation.value = rotation.value + 360;
  
  // 播放转盘音效
  try {
    spinAudio = new Audio('/cjyx.m4a');
    spinAudio.loop = false; // 不循环播放
    spinAudio.volume = 0.5;
    spinAudio.play().catch(err => console.log('音效播放失败:', err));
  } catch (err) {
    console.log('音效初始化失败:', err);
  }
  
  try {
    const response = await claimWelfareLottery(empId.value);
    if (response.success && response.data) {
      const result = response.data.result;
      spinResult.value = result;
      
      // 计算旋转角度
      const prizeIndex = lotteryItems.value.findIndex(item => item.id === result.id);
      const baseRotation = 360 * 4; // 基础旋转4圈
      const sectorAngle = 360 / lotteryItems.value.length;
      // 调整旋转角度，确保指针指向正确的扇区
      // 转盘实际顺序（从12点开始顺时针）：20元现金 → 10元现金 → 5元现金 → 手机 → 金条 → 再接再厉 → 100元现金 → 50元现金
      const actualPrizeIndex = [2, 3, 4, 5, 6, 7, 0, 1][prizeIndex];
      const targetRotation = rotation.value + baseRotation + actualPrizeIndex * sectorAngle;
      rotation.value = targetRotation;
      
      // 减少抽奖机会
      lotteryChances.value -= 1;
      
      // 如果中奖，更新余额
      if (result.type !== 'encourage' && result.value > 0) {
        welfareBalance.value += result.value;
      }
      
      // 转盘停止后重置状态
      setTimeout(() => {
        isSpinning.value = false;
        // 停止音效
        if (spinAudio) {
          spinAudio.pause();
          spinAudio.currentTime = 0;
          spinAudio = null;
        }
        // 重新加载中奖记录
        loadWelfareRecords();
      }, 6500);
    } else {
      error.value = response.message || '抽奖失败';
      isSpinning.value = false;
      // 停止音效
      if (spinAudio) {
        spinAudio.pause();
        spinAudio.currentTime = 0;
        spinAudio = null;
      }
    }
  } catch (err) {
    console.error('抽奖失败:', err);
    error.value = '网络错误，请稍后重试';
    isSpinning.value = false;
    // 停止音效
    if (spinAudio) {
      spinAudio.pause();
      spinAudio.currentTime = 0;
      spinAudio = null;
    }
  }
};

// 打开绑定弹窗
const openBindModal = () => {
  // 从本地存储获取已绑定的支付宝信息
  let savedAlipayName = '';
  let savedAlipayAccount = '';
  
  if (typeof localStorage !== 'undefined') {
    savedAlipayName = localStorage.getItem('alipayName') || '';
    savedAlipayAccount = localStorage.getItem('alipayAccount') || '';
  }
  
  bindAlipayName.value = savedAlipayName;
  bindAlipayAccount.value = savedAlipayAccount;
  
  showBindModal.value = true;
};

// 处理绑定
const handleBind = async () => {
  if (!empId.value || !bindAlipayName.value || !bindAlipayAccount.value) return;
  
  isSubmittingBind.value = true;
  error.value = '';
  
  try {
    const response = await bindAlipay(empId.value, bindAlipayName.value, bindAlipayAccount.value);
    if (response.success) {
      // 保存到本地存储
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('alipayName', bindAlipayName.value);
        localStorage.setItem('alipayAccount', bindAlipayAccount.value);
      }
      
      // 关闭绑定弹窗
      showBindModal.value = false;
      
      // 显示成功提示
      showRewardAnimation('绑定成功');
      
      // 重置表单
      bindAlipayName.value = '';
      bindAlipayAccount.value = '';
      
      isSubmittingBind.value = false;
    } else {
      error.value = response.message || '绑定失败';
      isSubmittingBind.value = false;
    }
  } catch (err) {
    console.error('绑定失败:', err);
    error.value = '网络错误，请稍后重试';
    isSubmittingBind.value = false;
  }
};

// 处理提现
const handleWithdraw = async () => {
  if (!empId.value || !alipayAccount.value || !alipayName.value) return;
  
  isSubmittingWithdraw.value = true;
  error.value = '';
  
  try {
    const response = await withdrawWelfareFunds(empId.value, withdrawAmount.value, alipayAccount.value, alipayName.value);
    if (response.success) {
      withdrawSuccess.value = true;
      welfareBalance.value -= withdrawAmount.value;
      
      // 增加今日提现次数
      dailyWithdrawCount.value += 1;
      
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

// 显示奖励动画
const showRewardAnimation = (message: string) => {
  // 这里可以实现奖励动画逻辑
  console.log('获得奖励:', message);
};

// 打开提现弹窗
const openWithdrawModal = () => {
  // 先打开金额选择弹窗
  showAmountModal.value = true;
};

// 选择提现金额
const selectWithdrawAmount = (amount: number) => {
  // 检查是否达到每日提现次数限制
  if (dailyWithdrawCount.value >= maxDailyWithdraws) {
    showRewardAnimation('今日提现次数已用完');
    return;
  }
  
  selectedAmount.value = amount;
};

// 确认提现金额
const confirmWithdrawAmount = () => {
  if (selectedAmount.value === 0) return;
  
  withdrawAmount.value = selectedAmount.value;
  
  // 从本地存储获取已绑定的支付宝信息
  let savedAlipayName = '';
  let savedAlipayAccount = '';
  
  if (typeof localStorage !== 'undefined') {
    savedAlipayName = localStorage.getItem('alipayName') || '';
    savedAlipayAccount = localStorage.getItem('alipayAccount') || '';
  }
  
  alipayName.value = savedAlipayName;
  alipayAccount.value = savedAlipayAccount;
  
  withdrawSuccess.value = false;
  showAmountModal.value = false;
  showWithdrawModal.value = true;
};

// 关闭提现弹窗
const closeWithdrawModal = () => {
  showWithdrawModal.value = false;
};

// 关闭记录弹窗
const closeRecordsModal = () => {
  showRecordsModal.value = false;
};

// 生命周期
onMounted(async () => {
  await loadWelfareInfo();
  await loadWelfareBalance();
  loadWithdrawRecords();
});

// 获取奖品颜色
const getPrizeColor = (type: string) => {
  switch (type) {
    case 'cash':
      return '#10b981';
    case 'phone':
      return '#8b5cf6';
    case 'gold':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
};

// 获取奖品图标
const getPrizeIcon = (type: string) => {
  switch (type) {
    case 'cash':
      return Wallet;
    case 'phone':
      return Smartphone;
    case 'gold':
      return Trophy;
    case 'encourage':
      return Handshake;
    default:
      return Gift;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#050505] text-white pb-32 relative overflow-x-hidden font-sans">
    <!-- 沉浸式背景光晕 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div class="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-amber-500/5 blur-[150px] rounded-full" />
      <div class="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-600/5 blur-[150px] rounded-full" />
      <!-- 网格底纹 -->
      <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 40px 40px;" />
    </div>

    <!-- 顶部导航栏 -->
    <header class="bg-black/40 backdrop-blur-xl border-b border-white/5 pt-8 pb-5 px-6 flex items-center justify-between sticky top-0 z-50">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Gift class="text-white w-5 h-5" />
        </div>
        <div class="flex flex-col">
          <span class="font-bold text-sm tracking-widest uppercase bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">福利抽奖</span>
          <span class="text-[10px] text-zinc-400 font-bold tracking-wider">免费抽奖，好运常相伴！</span>
        </div>
      </div>
      <div class="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
        <span class="text-xs font-mono text-blue-400">{{ lotteryChances }}</span>
        <Sparkles class="w-3 h-3 text-purple-500" />
      </div>
    </header>

    <main class="max-w-md mx-auto px-6 mt-8 space-y-10 relative z-10">
      <!-- 钱包卡片 -->
      <section class="relative">
        <!-- 预览提示框 -->
        <div class="mb-4 p-3 rounded-lg bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 animate-pulse">
          <p class="text-xs font-bold text-center text-red-400 tracking-wide">
            此页面仅作为预览使用，福利抽奖功能暂未开放，预计5月正式上线，敬请期待！
          </p>
        </div>
        
        <div class="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-blue-500/20 to-purple-500/20 blur-xl rounded-[2.5rem] opacity-50" />
        <div class="relative bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-6 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <!-- 碳纤维纹理 -->
          <div class="absolute inset-0 opacity-[0.05] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png');" />
          
          <div class="relative z-10 space-y-4">
            <div>
              <p class="text-sm font-black uppercase tracking-[0.4em] mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">福利钱包</p>
              <div class="flex items-baseline gap-2">
                <span class="text-3xl font-light bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">¥</span>
                <span class="text-4xl font-black tracking-tighter bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent tabular-nums">
                  {{ welfareBalance.toFixed(2) }}
                </span>
              </div>
            </div>

            <div class="flex gap-3 items-center pt-2">
              <div 
                @click="openBindModal"
                class="flex-1 px-4 py-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-[0.2em] hover:from-blue-500/30 hover:to-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Wallet class="w-3 h-3" />
                提现绑定
              </div>
              <div 
                @click="showWithdrawRecordsModal = true"
                class="flex-1 px-4 py-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-[0.2em] hover:from-blue-500/30 hover:to-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <History class="w-3 h-3" />
                提现记录
              </div>
            </div>

            <div class="pt-1">
              <button 
                @click="openWithdrawModal"
                :disabled="welfareBalance <= 0"
                class="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-black text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100 flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(59,130,246,0.2)]"
              >
                <CreditCard class="w-4 h-4" />
                立即提现
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 实物化大转盘 -->
      <section class="flex flex-col items-center justify-center py-6 space-y-12">
        <div class="relative group">
          <!-- 3D 金属外圈 -->
          <div class="absolute -inset-10 bg-gradient-to-b from-zinc-800 to-black rounded-full shadow-[0_30px_60px_rgba(0,0,0,0.8),inset_0_2px_5px_rgba(255,255,255,0.1)] border-b-4 border-black" />
          
          <!-- LED 跑马灯 -->
          <div class="absolute -inset-8 rounded-full pointer-events-none">
            <div v-for="i in 12" :key="i" 
              class="absolute w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              :style="{ 
                top: '50%', left: '50%', 
                transform: `rotate(${i * 30}deg) translate(0, -145px)`,
                animation: `pulse 2s infinite ${i * 0.1}s`
              }"
            />
          </div>

          <!-- 机械指针 -->
          <div class="absolute -top-12 left-1/2 -translate-x-1/2 z-40">
            <div class="relative">
              <div class="w-10 h-14 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-lg shadow-2xl border-x border-white/5" />
              <div class="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-4 h-8 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-400/30"
                :class="{ 'animate-wiggle': isSpinning }"
              />
              <!-- 铆钉 -->
              <div class="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-600 rounded-full border border-white/10 shadow-inner" />
            </div>
          </div>

          <!-- 转盘主体 -->
          <div class="relative w-80 h-80 rounded-full p-3 bg-zinc-900 shadow-inner overflow-hidden">
            <div 
              class="w-full h-full rounded-full border-[12px] border-zinc-800 relative overflow-hidden transition-transform duration-[6500ms] cubic-bezier(0.15, 0, 0.15, 1) shadow-2xl"
              :style="{ transform: `rotate(${rotation}deg)` }"
            >
              <!-- 扇区 -->
              <div 
                v-for="(prize, index) in lotteryItems" 
                :key="prize.id"
                class="absolute top-0 left-0 w-full h-full origin-center"
                :style="{ transform: `rotate(${index * 45}deg)` }"
              >
                <div 
                  class="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[150px] origin-bottom flex flex-col items-center pt-4"
                  :style="{
                    backgroundColor: index % 2 === 0 ? '#111' : '#1a1a1a',
                    clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                    borderRight: '1px solid rgba(255,255,255,0.03)'
                  }"
                >
                  <span class="text-[13px] font-black text-white uppercase tracking-tight text-center px-2 leading-tight drop-shadow-[0_2px_3px_rgba(0,0,0,1)] mb-2">
                    {{ prize.name }}
                  </span>
                  <div class="relative">
                    <div class="absolute inset-0 blur-lg opacity-50" :style="{ backgroundColor: getPrizeColor(prize.type) }" />
                    <img v-if="prize.type === 'gold'" :src="gold1gImage" class="w-9 h-9 relative z-10 object-contain" />
                    <img v-else-if="prize.type === 'phone'" :src="phoneModelImage" class="w-9 h-9 relative z-10 object-contain" />
                    <component v-else :is="getPrizeIcon(prize.type)" class="w-9 h-9 relative z-10" :style="{ color: getPrizeColor(prize.type) }" />
                  </div>
                </div>
              </div>
              
              <!-- 内阴影深度感 -->
              <div class="absolute inset-0 rounded-full shadow-[inset_0_0_60px_rgba(0,0,0,0.8)] pointer-events-none" />
            </div>

            <!-- 中心启动按钮 -->
            <div class="absolute inset-0 m-auto w-24 h-24 z-30">
              <button 
                @click="handleSpin"
                :disabled="isSpinning || lotteryChances <= 0"
                class="w-full h-full rounded-full border-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_2px_5px_rgba(255,255,255,0.1)] flex items-center justify-center active:translate-y-1 active:shadow-inner transition-all disabled:grayscale disabled:opacity-50 disabled:active:translate-y-0 group overflow-hidden"
                :class="{
                  'bg-gradient-to-b from-zinc-700 to-zinc-900 border-zinc-800': lotteryChances <= 0 || isSpinning,
                  'bg-gradient-to-b from-blue-500 to-purple-600 border-red-600 shadow-[0_10px_30px_rgba(220,38,38,0.4),inset_0_2px_5px_rgba(255,255,255,0.2)]': lotteryChances > 0 && !isSpinning
                }"
              >
                <!-- 按钮发光 -->
                <div class="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div class="relative z-10 flex flex-col items-center">
                  <Zap class="w-5 h-5 mb-1" :class="{
                    'text-amber-400 animate-bounce': !isSpinning && lotteryChances > 0,
                    'text-zinc-400': lotteryChances <= 0 || isSpinning
                  }" />
                  <span class="text-[10px] font-black uppercase tracking-[0.2em]" :class="{
                    'text-amber-400': !isSpinning && lotteryChances > 0,
                    'text-zinc-400': lotteryChances <= 0 || isSpinning
                  }">
                    {{ isSpinning ? '抽奖中' : (lotteryChances > 0 ? '开始抽奖' : '没有机会') }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- 工业风进度条 -->
        <div v-if="false" class="w-full max-w-[280px] space-y-4">
          <div class="flex justify-between items-end px-1">
            <div class="flex flex-col">
              <span class="text-[10px] text-zinc-500 uppercase tracking-[0.4em] font-black mb-1">系统进度</span>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span class="text-[10px] text-blue-400 font-mono font-bold uppercase tracking-widest">数据同步中...</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-2xl font-black font-mono text-white tabular-nums">{{ adProgress }}</span>
              <span class="text-xs text-zinc-600 font-bold ml-1">/ 99999</span>
            </div>
          </div>
          
          <!-- 测试按钮 -->
          <button 
            @click="lotteryChances += 1"
            class="w-full py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-widest hover:bg-blue-500/30 transition-all"
          >
            测试：增加抽奖机会
          </button>
          
          <div class="relative h-4 bg-zinc-900 rounded-full border border-white/5 p-1 overflow-hidden shadow-inner">
            <!-- 玻璃管效果 -->
            <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-10" />
            <div 
              class="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-amber-500 rounded-full transition-all duration-1000 ease-out relative"
              :style="{ width: `${(adProgress / 99999) * 100}%` }"
            >
              <!-- 扫光动画 -->
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
          
          <p class="text-[9px] text-zinc-500 text-center uppercase tracking-[0.2em] font-bold leading-relaxed">
            每观看 99999 个广告可获得 <span class="text-amber-500">1 次高级抽奖机会</span>
          </p>
        </div>
      </section>

      <!-- 中奖记录列表 -->
      <section class="space-y-6">
        <div class="flex items-center justify-between px-2">
          <div class="flex items-center gap-3">
            <div class="w-1 h-4 bg-amber-500 rounded-full" />
            <h2 class="text-[10px] uppercase tracking-[0.4em] text-zinc-400 font-black">中奖历史记录</h2>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span class="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">实时更新中</span>
          </div>
        </div>
        
        <div class="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div v-if="welfareRecords.length === 0" class="py-24 text-center">
            <div class="relative inline-block mb-6">
              <div class="absolute inset-0 bg-zinc-500/10 blur-2xl rounded-full" />
              <Gift class="w-12 h-12 text-zinc-800 relative z-10" />
            </div>
            <p class="text-[10px] text-zinc-600 uppercase tracking-[0.4em] font-bold">暂无中奖记录</p>
          </div>
          <div v-else class="divide-y divide-white/[0.03]">
            <div 
              v-for="record in welfareRecords" 
              :key="record.id"
              class="px-8 py-6 flex justify-between items-center hover:bg-white/[0.02] transition-colors group"
            >
              <div class="flex items-center gap-5">
                <div 
                  class="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 shadow-lg transition-transform group-hover:scale-110"
                  :class="{
                    'bg-emerald-500/5 text-emerald-500': record.value > 0,
                    'bg-zinc-500/5 text-zinc-500': record.value === 0
                  }"
                >
                  <Gift class="w-6 h-6" />
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-black text-white tracking-tight group-hover:text-amber-400 transition-colors">{{ record.name }}</span>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] text-zinc-500 font-mono tracking-widest">{{ formatTime(record.time) }}</span>
                  </div>
                </div>
              </div>
              <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                <ChevronRight class="w-4 h-4 text-zinc-400" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 中奖弹窗 -->
    <transition name="prize">
      <div v-if="showResultModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-2xl" @click="showResultModal = false" />
        
        <!-- 弹窗背景动画 -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 blur-[120px] rounded-full animate-pulse" />
        </div>

        <div class="relative bg-zinc-900 border border-white/10 p-12 rounded-[4rem] text-center space-y-8 shadow-[0_0_150px_rgba(245,158,11,0.2)] max-w-sm w-full overflow-hidden">
          <!-- 碳纤维纹理 -->
          <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png');" />
          
          <div class="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(245,158,11,0.5)] border-4 border-zinc-900">
            <Trophy class="w-16 h-16 text-white animate-bounce" />
          </div>
          
          <div class="pt-12 space-y-3">
            <h3 class="text-4xl font-black text-white uppercase tracking-tighter italic leading-none">恭喜中奖!</h3>
            <p class="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">恭喜获得奖励</p>
          </div>

          <div class="py-10 bg-black/40 rounded-[2.5rem] border border-white/5 relative group">
            <div class="absolute inset-0 bg-amber-500/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <p class="text-4xl font-black text-amber-400 tracking-tight relative z-10">{{ spinResult?.name }}</p>
          </div>

          <button
            @click="showResultModal = false"
            class="w-full py-5 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.3em] hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl"
          >
            收下奖励
          </button>
        </div>
      </div>
    </transition>

    <!-- 金额选择弹窗 -->
    <transition name="modal">
      <div v-if="showAmountModal" class="fixed inset-0 z-[9999] flex items-end justify-center p-0 pointer-events-auto">
        <div 
          class="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
          @click="showAmountModal = false"
        />
        <div class="relative transform transition-all w-full">
          <div class="bg-zinc-900 border-t border-white/10 rounded-t-[3rem] p-6 shadow-2xl overflow-hidden min-h-[60vh] flex flex-col">
            <!-- 背景渐变 -->
            <div class="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-500/20 to-transparent pointer-events-none" />
            
            <!-- 碳纤维纹理 -->
            <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png');" />
            
            <!-- 光晕效果 -->
            <div class="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div class="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            
            <div class="relative z-10 flex flex-col flex-1 justify-between">
              <div class="space-y-8">
                <div class="text-center">
                  <h3 class="text-2xl font-black text-white uppercase tracking-tight">选择提现金额</h3>
                  <p class="text-xs text-zinc-500 font-black uppercase tracking-[0.3em] mt-2">当前余额: <span class="text-blue-400 text-sm">¥{{ welfareBalance.toFixed(2) }}</span></p>
                </div>
                
                <div class="grid grid-cols-3 gap-3">
                  <button 
                    v-for="amount in [10, 20, 30, 50, 100, 200]" 
                    :key="amount"
                    @click="selectWithdrawAmount(amount)"
                    :disabled="welfareBalance < amount"
                    class="py-4 rounded-2xl border-2 transition-all active:scale-95 disabled:opacity-30 disabled:border-zinc-800 disabled:text-zinc-700 disabled:bg-zinc-900 disabled:active:scale-100 relative overflow-hidden group"
                    :class="{
                      'border-blue-500 bg-gradient-to-br from-blue-500/10 to-purple-600/10 text-blue-400 hover:from-blue-500/20 hover:to-purple-600/20': welfareBalance >= amount && amount !== selectedAmount,
                      'border-green-500 bg-gradient-to-br from-green-500/20 to-emerald-600/20 text-green-400': welfareBalance >= amount && amount === selectedAmount,
                      'border-zinc-800 text-zinc-700 bg-zinc-900': welfareBalance < amount
                    }"
                  >
                    <!-- 按钮发光效果 -->
                    <div v-if="welfareBalance >= amount" class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <!-- 按钮边框发光 -->
                    <div v-if="welfareBalance >= amount" class="absolute inset-0 rounded-2xl border-2 border-blue-500/0 group-hover:border-blue-500/50 transition-all" />
                    <span class="text-xl font-black relative z-10">¥{{ amount }}</span>
                  </button>
                </div>
                
                <p class="text-xs text-zinc-400 font-black uppercase tracking-[0.2em] text-center">今日您还可以提现<span class="text-green-400">{{ remainingWithdraws }}次</span></p>
                <p class="text-xs text-zinc-400 font-black uppercase tracking-[0.2em] text-center mt-1">申请提现后，<span class="text-green-400">1～3</span>个工作日打款到账</p>
              </div>
              
              <div class="mt-4" v-if="selectedAmount === 0">
                <button
                  @click="showAmountModal = false"
                  class="w-full py-4 rounded-2xl bg-zinc-800 text-zinc-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-700 transition-all active:scale-95 relative overflow-hidden group"
                >
                  <!-- 按钮发光效果 -->
                  <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span class="relative z-10">取消</span>
                </button>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3" v-else>
                <button
                  @click="showAmountModal = false; selectedAmount = 0"
                  class="py-4 rounded-2xl bg-zinc-800 text-zinc-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-zinc-700 transition-all active:scale-95 relative overflow-hidden group"
                >
                  <!-- 按钮发光效果 -->
                  <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span class="relative z-10">取消</span>
                </button>
                <button
                  @click="confirmWithdrawAmount"
                  class="py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-black text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all active:scale-95 relative overflow-hidden group shadow-[0_10px_20px_rgba(59,130,246,0.2)]"
                >
                  <!-- 按钮发光效果 -->
                  <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span class="relative z-10">确定</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 提现记录弹窗 -->
    <transition name="modal">
      <div v-if="showWithdrawRecordsModal" class="fixed inset-0 z-[9999] flex items-end justify-center p-0 pointer-events-auto">
        <div 
          class="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity z-[9998] pointer-events-auto"
          @click="showWithdrawRecordsModal = false"
        />
        <div class="relative w-full bg-zinc-900 border-t border-white/10 rounded-t-[3rem] p-6 shadow-2xl overflow-hidden min-h-[60vh] flex flex-col z-[9999]">
          <!-- 背景渐变 -->
          <div class="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-500/20 to-transparent pointer-events-none" />
          
          <!-- 碳纤维纹理 -->
          <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png');" />
          
          <!-- 光晕效果 -->
          <div class="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div class="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div class="relative z-10 flex flex-col flex-1 justify-between">
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <h3 class="text-xl font-black text-white uppercase tracking-tight">提现记录</h3>
                <button 
                  @click="showWithdrawRecordsModal = false"
                  class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white"
                >
                  <LogOut class="w-4 h-4 rotate-90" />
                </button>
              </div>
              
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">历史提现</p>
                <button 
                  @click="loadWithdrawRecords"
                  class="text-xs text-blue-400 font-bold flex items-center gap-1 hover:text-blue-300 transition-colors"
                >
                  <RefreshCw class="w-3 h-3" />
                  刷新
                </button>
              </div>
              
              <div class="bg-zinc-900/60 rounded-xl border border-white/5 p-3 max-h-64 overflow-y-auto no-scrollbar">
                <div v-if="withdrawRecords.length === 0" class="text-center py-8">
                  <div class="relative inline-block mb-4">
                    <div class="absolute inset-0 bg-zinc-500/10 blur-2xl rounded-full" />
                    <History class="w-10 h-10 text-zinc-800 relative z-10" />
                  </div>
                  <p class="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">暂无提现记录</p>
                </div>
                <div v-else class="space-y-4">
                  <div v-for="record in withdrawRecords" :key="record.id" class="flex justify-between items-center pb-3 border-b border-white/5 last:border-0 last:pb-0">
                    <div class="flex flex-col">
                      <span class="text-sm font-black text-white tracking-tight">{{ formatTime(record.time) }}</span>
                      <span :class="['text-xs font-bold mt-1', record.statusColor]">{{ record.statusText }}</span>
                    </div>
                    <span class="text-lg font-black text-white">¥{{ record.amount }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="mt-6">
              <button
                @click="showWithdrawRecordsModal = false"
                class="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-black text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all active:scale-95 relative overflow-hidden group shadow-[0_10px_20px_rgba(59,130,246,0.2)]"
              >
                <!-- 按钮发光效果 -->
                <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span class="relative z-10">关闭</span>
              </button>
            </div>
          </div>
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
                  readonly
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
    
    <!-- 绑定弹窗 -->
    <transition name="modal">
      <div v-if="showBindModal" class="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-0 sm:p-6 pointer-events-auto">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md z-[9998] pointer-events-auto" @click="showBindModal = false" />
        <div class="relative w-full max-w-md bg-[#020205] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col h-[90vh] max-h-[600px] z-[9999] shadow-2xl">
          <div class="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-[#020205] z-10">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mr-3 border border-blue-500/30">
                <Wallet class="w-4 h-4 text-blue-400" />
              </div>
              <h3 class="text-sm font-bold uppercase tracking-widest">绑定支付宝</h3>
            </div>
            <button 
              @click="showBindModal = false"
              class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white"
            >
              <LogOut class="w-4 h-4 rotate-90" />
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto no-scrollbar p-8">
            <div class="space-y-6">
              <!-- 绑定说明 -->
              <div class="glass-card rounded-xl p-4 text-xs text-zinc-500 space-y-2">
                <p>• 绑定支付宝账号后，提现时将自动填充账号信息</p>
                <p>• 请确保支付宝账号信息正确，否则可能导致提现失败</p>
                <p>• 首次绑定后再次点击可修改绑定信息</p>
              </div>
              
              <!-- 收款人支付宝姓名 -->
              <div>
                <label class="block text-zinc-500 text-xs uppercase tracking-wider mb-2">支付宝姓名</label>
                <input 
                  v-model="bindAlipayName" 
                  type="text"
                  class="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="请输入支付宝姓名"
                />
              </div>
              
              <!-- 收款人支付宝帐号 -->
              <div>
                <label class="block text-zinc-500 text-xs uppercase tracking-wider mb-2">支付宝帐号</label>
                <input 
                  v-model="bindAlipayAccount" 
                  type="text"
                  class="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="请输入支付宝帐号"
                />
              </div>
            </div>
          </div>
          
          <div class="px-8 py-6 border-t border-white/5 bg-[#020205] z-10">
            <button 
              @click="handleBind"
              :disabled="isSubmittingBind || !bindAlipayName || !bindAlipayAccount"
              class="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              <Wallet class="w-4 h-4" />
              确认绑定
            </button>
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
          <Gift class="w-6 h-6 mb-1" />
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

/* 动画效果 */
@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.5); }
}

@keyframes wiggle {
  0%, 100% { transform: translateX(-50%) rotate(0deg); }
  25% { transform: translateX(-50%) rotate(-5deg); }
  75% { transform: translateX(-50%) rotate(5deg); }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-wiggle {
  animation: wiggle 0.2s infinite;
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

.prize-enter-active, .prize-leave-active {
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.prize-enter-from {
  opacity: 0;
  transform: scale(0.7) translateY(40px);
}
.prize-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 字体平滑处理 */
.font-sans {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>