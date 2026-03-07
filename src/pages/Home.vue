<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Coins, History, PlayCircle, LogOut, TrendingUp, Wallet, CreditCard } from 'lucide-vue-next';
import { getUserInfo, rewardGold, getGoldLogs, recordLogin, getLoginStats, submitWithdrawRequest, getWithdrawStatus, getWithdrawRecords, claimDailyBonus, type WithdrawRecord } from '../api/apiService';
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
const bonusGold = ref(0);  // 额外金币奖励
const hasClaimedBonus = ref(false);  // 是否已领取额外金币
const isClaimingBonus = ref(false);  // 是否正在领取额外金币


const records = ref<Record[]>([]);
const isLoading = ref(false);
const isLoadingRecords = ref(false);
const error = ref('');

const isWatching = ref(false);
const showAllRecords = ref(false);

// 金币奖励弹窗和语音
const showRewardPopup = ref(false);
const rewardAmount = ref(0);
let rewardTimeout: ReturnType<typeof setTimeout> | null = null;

// 播放金币到账语音
const playRewardSound = (amount: number) => {
  console.log('========== playRewardSound 被调用 ==========');
  console.log('金币数量:', amount);
  
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.error('浏览器不支持语音合成');
      return;
    }
    
    // 取消之前的语音
    window.speechSynthesis.cancel();
    
    const gold = Math.floor(amount);
    let message = '';
    
    if (gold >= 500) {
      message = `哇塞！太厉害了！恭喜你赚了${gold}金币！`;
    } else if (gold >= 300) {
      message = `太棒了！恭喜你赚了${gold}金币！`;
    } else if (gold >= 100) {
      message = `恭喜你赚了${gold}金币！`;
    } else {
      message = `恭喜你又赚了${gold}金币！`;
    }
    
    console.log('语音内容:', message);
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    utterance.pitch = 1.2;
    utterance.volume = 1.0;
    
    // 等待语音列表加载完成
    const speak = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('可用语音数量:', voices.length);
      
      const zhVoice = voices.find(v => v.lang.includes('zh'));
      if (zhVoice) {
        utterance.voice = zhVoice;
        console.log('使用中文语音:', zhVoice.name);
      } else {
        console.log('未找到中文语音，使用默认语音');
      }
      
      window.speechSynthesis.speak(utterance);
      console.log('语音播放命令已发送');
    };
    
    // 检查语音列表是否已加载
    if (window.speechSynthesis.getVoices().length > 0) {
      speak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        speak();
      };
    }
  } catch (err) {
    console.error('语音播放失败:', err);
  }
};

// 显示金币奖励
const showRewardAnimation = (amount: number) => {
  console.log('========== showRewardAnimation 被调用 ==========');
  console.log('金币数量:', amount);
  
  // 清除之前的定时器
  if (rewardTimeout) {
    clearTimeout(rewardTimeout);
  }
  
  rewardAmount.value = amount;
  showRewardPopup.value = true;
  console.log('showRewardPopup 已设置为 true');
  
  // 播放语音
  playRewardSound(amount);
  console.log('playRewardSound 已调用');
  
  // 3秒后隐藏
  rewardTimeout = setTimeout(() => {
    showRewardPopup.value = false;
    console.log('showRewardPopup 已设置为 false');
  }, 3000);
};
const showWithdrawModal = ref(false);
const withdrawAmount = ref(0);
const alipayAccount = ref('');
const alipayName = ref('');
const isSubmittingWithdraw = ref(false);
const withdrawSuccess = ref(false);
const withdrawEnabled = ref(false); // 提现开关状态
const showWithdrawRecordsModal = ref(false);
const withdrawRecords = ref<WithdrawRecord[]>([]);
const isLoadingWithdrawRecords = ref(false);

// 登录天数统计
const loginDays = ref(0);

// 加载登录统计
const loadLoginStats = async () => {
  if (!userId.value || !empId.value) return;

  try {
    // 1. 记录本次登录
    await recordLogin(userId.value, empId.value);

    // 2. 获取登录统计
    const response = await getLoginStats(userId.value, empId.value);
    if (response.success && response.data) {
      loginDays.value = response.data.totalLoginDays;
    }
  } catch (err) {
    console.error('获取登录统计失败:', err);
  }
};

// 加载提现开关状态
const loadWithdrawStatus = async () => {
  try {
    const response = await getWithdrawStatus();
    if (response.success && response.data) {
      withdrawEnabled.value = response.data.enabled;
    } else {
      withdrawEnabled.value = false;
    }
  } catch (err) {
    console.error('获取提现状态失败:', err);
    withdrawEnabled.value = false;
  }
};

const adConfig = {
  appId: '2882303761520501672',
  slotId: '19181348',
};

const { showRewardVideo } = useAdManager(adConfig);

// 初始化数据
onMounted(async () => {
  if (!empId.value || !userId.value) {
    router.push('/login');
    return;
  }
  
  // 尝试从 employeeInfo 中重新获取 userId（确保使用最新的 userId）
  try {
    const employeeInfoStr = localStorage.getItem('employeeInfo');
    if (employeeInfoStr) {
      const employeeInfo = JSON.parse(employeeInfoStr);
      if (employeeInfo.userId && employeeInfo.userId !== userId.value) {
        console.log('更新 userId:', userId.value, '->', employeeInfo.userId);
        userId.value = employeeInfo.userId;
        localStorage.setItem('userId', employeeInfo.userId);
      }
    }
  } catch (e) {
    console.error('解析 employeeInfo 失败:', e);
  }
  
  await loadLoginStats();
  await loadWithdrawStatus();
  await loadUserInfo();
  await loadGoldRecords();
});

// 加载用户金币信息
const loadUserInfo = async () => {
  if (!empId.value || !userId.value) return;  
  isLoading.value = true;
  error.value = '';
  
  try {
    console.log('加载用户信息:', { userId: userId.value, empId: empId.value });
    const response = await getUserInfo(userId.value, empId.value);
    console.log('用户信息响应:', response);
    if (response.success && response.data) {
      currentMonthGold.value = response.data.currentMonthGold;
      lastMonthGold.value = response.data.lastMonthGold;
      todayTarget.value = response.data.todayTarget || 0;
      bonusGold.value = response.data.bonusGold || 5000;
      hasClaimedBonus.value = response.data.hasClaimedBonus || false;
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
      // 转换后端记录格式为前端格式（使用北京时间）
      const toBeijingTime = (date: Date) => {
        return new Date(date.getTime() + 8 * 60 * 60 * 1000);
      };
      
      records.value = response.data.map((log: any) => {
        // 后端返回的时间已经是北京时间，直接显示
        const recordTime = new Date(log.createTime);
        return {
          id: log._id,
          time: recordTime.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          }),
          amount: log.gold
        };
      });

      // 计算今日金币收益（使用北京时间 UTC+8）
      const getBeijingDate = (date: Date) => {
        const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
        return beijingTime.toISOString().split('T')[0];
      };
      
      const today = getBeijingDate(new Date());
      todayCoins.value = response.data
        .filter((log: any) => {
          const logDate = getBeijingDate(new Date(log.createTime));
          return logDate === today;
        })
        .reduce((sum: number, log: any) => sum + log.gold, 0);
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
      // 显示金币奖励动画和语音
      showRewardAnimation(earned);
      // 重新加载金币记录（会自动计算今日金币）
      await loadGoldRecords();
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

// 领取今日目标额外金币
const handleClaimBonus = async () => {
  if (!userId.value || !empId.value) return;
  
  isClaimingBonus.value = true;
  
  try {
    const response = await claimDailyBonus(userId.value, empId.value);
    if (response.success && response.data) {
      const earned = response.data.gold;
      currentMonthGold.value = response.data.currentMonthGold;
      hasClaimedBonus.value = true;
      // 显示金币奖励动画和语音
      showRewardAnimation(earned);
      await loadGoldRecords();
    } else {
      error.value = response.message || '领取失败';
    }
  } catch (err) {
    console.error('领取额外金币失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isClaimingBonus.value = false;
  }
};

// 处理登出
const handleLogout = () => {
  localStorage.removeItem('empId');
  localStorage.removeItem('userId');
  localStorage.removeItem('employeeInfo');
  router.push('/login');
};

// 打开提现弹窗
const openWithdrawModal = () => {
  withdrawAmount.value = Number((lastMonthGold.value / 1000).toFixed(2));
  alipayAccount.value = '';
  alipayName.value = '';
  withdrawSuccess.value = false;
  showWithdrawModal.value = true;
};

// 关闭提现弹窗
const closeWithdrawModal = () => {
  showWithdrawModal.value = false;
};

// 打开提现记录弹窗
const openWithdrawRecordsModal = async () => {
  showWithdrawRecordsModal.value = true;
  await loadWithdrawRecords();
};

// 关闭提现记录弹窗
const closeWithdrawRecordsModal = () => {
  showWithdrawRecordsModal.value = false;
};

// 加载提现记录
const loadWithdrawRecords = async () => {
  if (!userId.value) return;
  isLoadingWithdrawRecords.value = true;
  try {
    const response = await getWithdrawRecords(userId.value);
    console.log('提现记录响应:', response);
    if (response.success && response.data) {
      withdrawRecords.value = response.data;
      // 打印第一条记录的详细信息
      if (response.data.length > 0) {
        console.log('第一条提现记录:', response.data[0]);
      }
    }
  } catch (err) {
    console.error('加载提现记录失败:', err);
  } finally {
    isLoadingWithdrawRecords.value = false;
  }
};

// 格式化日期（使用北京时间）
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')} ${String(beijingTime.getHours()).padStart(2, '0')}:${String(beijingTime.getMinutes()).padStart(2, '0')}`;
};

// 获取状态样式（简化：只有成功状态）
const getStatusStyle = (status: number) => {
  // 0: 提现成功
  return { text: '提现成功', class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
};

// 提交提现申请
const submitWithdraw = async () => {
  if (!alipayAccount.value.trim() || !alipayName.value.trim()) {
    alert('请填写完整的支付宝信息');
    return;
  }

  isSubmittingWithdraw.value = true;

  try {
    // 调用后端提现接口
    const response = await submitWithdrawRequest({
      userId: userId.value,
      employeeId: empId.value,
      amount: withdrawAmount.value,
      alipayAccount: alipayAccount.value,
      alipayName: alipayName.value,
      goldAmount: lastMonthGold.value
    });

    if (response.success) {
      // 更新剩余金币
      if (response.data && response.data.remainingGold !== undefined) {
        lastMonthGold.value = response.data.remainingGold;
      }
      withdrawSuccess.value = true;
      // 3秒后关闭弹窗
      setTimeout(() => {
        closeWithdrawModal();
      }, 3000);
    } else {
      alert(response.message || '提现申请提交失败');
    }
  } catch (err) {
    console.error('提现申请失败:', err);
    alert('提现申请提交失败，请稍后重试');
  } finally {
    isSubmittingWithdraw.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0b] text-white pb-12 relative overflow-hidden">
    <!-- 背景装饰光晕 -->
    <div class="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
    <div class="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
    <div class="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

    <!-- Header -->
    <header class="bg-black/40 backdrop-blur-xl border-b border-white/5 pt-8 pb-5 px-6 flex justify-between items-center sticky top-0 z-20">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-linear-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <TrendingUp class="text-white w-5 h-5" />
        </div>
        <div class="flex flex-col">
          <span class="font-bold text-sm tracking-widest uppercase bg-linear-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">广告变现系统</span>
          <span class="text-[10px] text-zinc-400 font-bold tracking-wider">员工ID：{{ empId }} · 已登录{{ loginDays }}天</span>
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
              <div class="flex justify-between items-start">
                <div>
                  <p class="text-zinc-500 text-[9px] uppercase tracking-wider mb-1">上月累计金币</p>
                  <p class="text-lg font-light tracking-tight text-blue-400">{{ Math.floor(lastMonthGold).toLocaleString() }}</p>
                </div>
                <div class="flex flex-col gap-1.5">
                  <button 
                    @click="withdrawEnabled ? openWithdrawModal() : null"
                    :disabled="!withdrawEnabled"
                    class="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-1"
                    :class="withdrawEnabled 
                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/30 cursor-pointer' 
                      : 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 cursor-not-allowed'"
                  >
                    <Wallet class="w-3 h-3" />
                    提现
                  </button>
                  <button 
                    @click="openWithdrawRecordsModal"
                    class="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/30 cursor-pointer"
                  >
                    <CreditCard class="w-3 h-3" />
                    记录
                  </button>
                </div>
              </div>
            </div>
            <div class="group relative bg-linear-to-br from-emerald-500 to-teal-700 p-4 rounded-[1.25rem] shadow-xl shadow-emerald-500/10 overflow-hidden transition-all hover:scale-[1.02]">
              <div class="absolute top-0 right-0 w-16 h-16 bg-white/10 blur-2xl rounded-full -mr-8 -mt-8" />
              <p class="text-emerald-100/60 text-[9px] uppercase tracking-wider mb-1">本月累计金币</p>
              <p class="text-lg font-bold text-white tracking-tight">{{ Math.floor(currentMonthGold).toLocaleString() }}</p>
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
              <p class="text-lg font-light tracking-tight text-amber-400">{{ Math.floor(todayCoins).toLocaleString() }}</p>
            </div>
          </div>
      </div>

      <!-- 今日目标进度条和额外金币奖励 -->
      <div v-if="todayTarget >= 0" class="px-4 py-2">
        <div class="flex gap-3 items-center">
          <!-- 进度条 - 占3/4 -->
          <div class="w-3/4 space-y-2">
            <div class="flex justify-between items-center text-[9px]">
              <span class="text-zinc-500 uppercase tracking-wider">今日目标进度</span>
              <span class="text-purple-400 font-bold">{{ todayTarget > 0 ? `${Math.min(100, Math.floor((todayCoins / todayTarget) * 100))}%` : '未设置' }}</span>
            </div>
            <div class="h-2 bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
              <div 
                class="h-full bg-linear-to-r from-purple-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                :style="{ width: todayTarget > 0 ? `${Math.min(100, (todayCoins / todayTarget) * 100)}%` : '0%' }"
              />
            </div>
            <div class="flex justify-between text-[8px] text-zinc-600">
              <span>{{ Math.floor(todayCoins).toLocaleString() }} 金币</span>
              <span>目标 {{ todayTarget.toLocaleString() }} 金币</span>
            </div>
            <div v-if="todayTarget > 0" class="text-[7px] text-zinc-500 text-center mt-1">
              {{ todayCoins >= todayTarget ? '✓ 已达标可领取' : `✗ 还差 ${Math.floor(todayTarget - todayCoins).toLocaleString()} 金币` }}
            </div>
          </div>

          <!-- 领取额外金币按钮 - 占1/4 -->
          <div class="w-1/4 shrink-0">
            <!-- 已领取提示 -->
            <div
              v-if="hasClaimedBonus"
              class="w-full h-full py-1.5 px-2 rounded-lg text-center text-[8px] font-bold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex flex-col items-center justify-center"
            >
              已领取
            </div>

            <!-- 领取按钮 -->
            <button
              v-else-if="bonusGold > 0"
              @click="handleClaimBonus"
              :disabled="isClaimingBonus || todayCoins < todayTarget || todayTarget === 0"
              class="w-full h-full py-1.5 px-2 rounded-lg font-bold text-[9px] uppercase tracking-widest transition-all border flex flex-col items-center justify-center gap-0.5 relative overflow-hidden group"
              :class="[
                isClaimingBonus || todayCoins < todayTarget || todayTarget === 0
                  ? 'bg-zinc-800/50 border-zinc-700 text-zinc-600 cursor-not-allowed' 
                  : 'bg-linear-to-br from-amber-400 via-orange-500 to-red-500 text-white border-amber-300/50 shadow-[0_0_20px_rgba(245,158,11,0.4),0_0_40px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6),0_0_60px_rgba(245,158,11,0.3)] hover:scale-[1.05] active:scale-[0.95]'
              ]"
            >
              <!-- 动态背景光效 -->
              <div 
                v-if="!isClaimingBonus && todayCoins >= todayTarget && todayTarget > 0"
                class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"
              />
              <!-- 脉冲光圈 -->
              <div 
                v-if="!isClaimingBonus && todayCoins >= todayTarget && todayTarget > 0"
                class="absolute inset-0 rounded-lg animate-pulse bg-linear-to-r from-amber-500/20 via-orange-500/30 to-red-500/20"
              />
              <!-- 灰色脉冲光圈（未完成目标或未设置目标时） -->
              <div 
                v-if="!isClaimingBonus && (todayCoins < todayTarget || todayTarget === 0)"
                class="absolute inset-0 rounded-lg animate-pulse bg-linear-to-r from-zinc-500/10 via-zinc-600/20 to-zinc-500/10"
              />
              <!-- 图标 -->
              <Coins class="w-3 h-3 relative z-10" :class="{ 'animate-spin': isClaimingBonus, 'animate-bounce': !isClaimingBonus && todayCoins >= todayTarget && todayTarget > 0 }" />
              <span class="text-center leading-tight relative z-10">{{ isClaimingBonus ? '领取中...' : `奖${bonusGold}金币` }}</span>
            </button>
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
            class="relative w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 transition-all active:scale-90 border-2"
            :class="[
              isWatching 
                ? 'bg-zinc-900/80 border-zinc-800 text-zinc-600 cursor-not-allowed' 
                : 'bg-linear-to-br from-zinc-800 to-black border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-emerald-500/50'
            ]"
          >
            <div :class="{ 'animate-spin': isWatching }">
              <PlayCircle class="w-16 h-16" :class="isWatching ? 'text-zinc-700' : 'text-emerald-400'" />
            </div>
            <div class="text-center">
              <span class="block text-base font-black uppercase tracking-widest leading-none">
                {{ isWatching ? '正在加载' : '点击赚取金币' }}
              </span>
            </div>
          </button>
        </div>


        <p class="mt-4 text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-medium">
          {{ isWatching ? '正在为您匹配优质广告资源' : '广告激励已就绪' }}
        </p>
        
        <!-- 金币奖励弹窗 -->
        <transition name="reward-popup">
          <div v-if="showRewardPopup" class="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none bg-black/50">
            <div class="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-10 py-6 rounded-2xl font-bold shadow-2xl flex items-center gap-4 border-2 border-white/50 animate-bounce pointer-events-auto">
              <Coins class="w-10 h-10 text-white" />
              <span class="text-3xl">+{{ Math.floor(rewardAmount) }} 金币</span>
            </div>
          </div>
        </transition>
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
                <span class="text-sm font-bold text-amber-400 font-mono group-hover:scale-110 transition-transform">+{{ Math.floor(record.amount) }}</span>
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
                  <span class="text-sm font-bold text-amber-400 font-mono">+{{ Math.floor(record.amount) }}</span>
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

    <!-- 提现弹窗 -->
    <transition name="modal">
      <div v-if="showWithdrawModal" class="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-0 sm:p-6">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeWithdrawModal" />
        <div class="relative w-full max-w-md bg-[#0f0f11] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col max-h-[85vh]">
          <!-- 弹窗头部 -->
          <div class="px-8 py-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#0f0f11] z-10">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                <Wallet class="w-4 h-4 text-blue-400" />
              </div>
              <h3 class="text-sm font-bold uppercase tracking-widest">申请提现</h3>
            </div>
            <button 
              @click="closeWithdrawModal"
              class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white"
            >
              <LogOut class="w-4 h-4 rotate-90" />
            </button>
          </div>
          
          <!-- 弹窗内容 -->
          <div class="flex-1 overflow-y-auto no-scrollbar p-6">
            <!-- 成功状态 -->
            <div v-if="withdrawSuccess" class="text-center py-12">
              <div class="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 class="text-lg font-bold text-white mb-2">提现申请已提交</h4>
              <p class="text-sm text-zinc-500">财务将在3个工作日内处理您的提现申请</p>
            </div>
            
            <!-- 提现表单 -->
            <div v-else class="space-y-6">
              <!-- 提现金额 -->
              <div class="bg-white/3 border border-white/5 rounded-2xl p-4">
                <p class="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">可提现金额</p>
                <div class="flex items-baseline gap-1">
                  <span class="text-3xl font-bold text-blue-400">¥{{ withdrawAmount }}</span>
                  <span class="text-sm text-zinc-500">元</span>
                </div>
                <p class="text-[10px] text-zinc-600 mt-2">
                  {{ Math.floor(lastMonthGold).toLocaleString() }} 金币 ÷ 1000 = ¥{{ withdrawAmount }}
                </p>
              </div>
              
              <!-- 支付宝账号 -->
              <div class="space-y-2">
                <label class="text-[10px] text-zinc-500 uppercase tracking-wider">支付宝账号</label>
                <input 
                  v-model="alipayAccount"
                  type="text"
                  placeholder="请输入支付宝账号"
                  class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              
              <!-- 支付宝姓名 -->
              <div class="space-y-2">
                <label class="text-[10px] text-zinc-500 uppercase tracking-wider">支付宝姓名</label>
                <input 
                  v-model="alipayName"
                  type="text"
                  placeholder="请输入支付宝实名姓名"
                  class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              
              <!-- 提示信息 -->
              <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p class="text-[10px] text-amber-400 leading-relaxed">
                  <span class="font-bold">提示：</span>提现申请提交后，财务将在3个工作日内完成打款。请确保支付宝信息准确无误。
                </p>
              </div>
            </div>
          </div>
          
          <!-- 弹窗底部 -->
          <div v-if="!withdrawSuccess" class="p-6 border-t border-white/5">
            <button 
              @click="submitWithdraw"
              :disabled="isSubmittingWithdraw || withdrawAmount <= 0 || !alipayAccount.trim() || !alipayName.trim()"
              class="w-full py-4 rounded-xl bg-linear-to-r from-blue-500 to-blue-600 text-white font-bold uppercase tracking-widest text-sm hover:from-blue-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="isSubmittingWithdraw" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {{ isSubmittingWithdraw ? '提交中...' : '确认提现' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 提现记录弹窗 -->
    <transition name="modal">
      <div v-if="showWithdrawRecordsModal" class="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-0 sm:p-6">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeWithdrawRecordsModal" />
        <div class="relative w-full max-w-md bg-[#0f0f11] border-t sm:border border-white/10 rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col max-h-[85vh]">
          <!-- 弹窗头部 -->
          <div class="px-8 py-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#0f0f11] z-10">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                <CreditCard class="w-4 h-4 text-blue-400" />
              </div>
              <h3 class="text-sm font-bold uppercase tracking-widest">提现记录</h3>
            </div>
            <button 
              @click="closeWithdrawRecordsModal"
              class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white"
            >
              <LogOut class="w-4 h-4 rotate-90" />
            </button>
          </div>
          
          <!-- 弹窗内容 -->
          <div class="flex-1 overflow-y-auto no-scrollbar p-6">
            <!-- 加载状态 -->
            <div v-if="isLoadingWithdrawRecords" class="py-20 text-center">
              <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                <CreditCard class="w-5 h-5 text-zinc-700" />
              </div>
              <p class="text-xs text-zinc-600 uppercase tracking-widest">加载中...</p>
            </div>
            
            <!-- 空状态 -->
            <div v-else-if="withdrawRecords.length === 0" class="py-20 text-center">
              <div class="w-16 h-16 bg-zinc-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard class="w-8 h-8 text-zinc-600" />
              </div>
              <p class="text-sm text-zinc-500 mb-1">暂无提现记录</p>
              <p class="text-[10px] text-zinc-600">您的提现申请将显示在这里</p>
            </div>
            
            <!-- 提现记录列表 -->
            <div v-else class="space-y-3">
              <div 
                v-for="record in withdrawRecords" 
                :key="record._id" 
                class="bg-white/3 border border-white/5 rounded-2xl p-4 space-y-3"
              >
                <!-- 头部：金额和状态 -->
                <div class="flex justify-between items-start">
                  <div>
                    <p class="text-lg font-bold text-blue-400">¥{{ record.amount }}</p>
                    <p class="text-[10px] text-zinc-600 mt-0.5">{{ Math.floor(record.goldAmount).toLocaleString() }} 金币</p>
                  </div>
                  <span 
                    class="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border"
                    :class="getStatusStyle(record.status).class"
                  >
                    {{ getStatusStyle(record.status).text }}
                  </span>
                </div>
                
                <!-- 支付宝信息 -->
                <div class="pt-3 border-t border-white/5 space-y-1">
                  <div class="flex justify-between text-[11px]">
                    <span class="text-zinc-500">支付宝账号</span>
                    <span class="text-zinc-300">{{ record.alipayAccount }}</span>
                  </div>
                  <div class="flex justify-between text-[11px]">
                    <span class="text-zinc-500">支付宝姓名</span>
                    <span class="text-zinc-300">{{ record.alipayName }}</span>
                  </div>
                </div>
                
                <!-- 时间 -->
                <div class="pt-2 border-t border-white/5">
                  <p class="text-[10px] text-zinc-600 font-mono">{{ formatDate(record.createTime) }}</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 弹窗底部 -->
          <div class="p-6 border-t border-white/5 text-center">
            <p class="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
              共计 {{ withdrawRecords.length }} 条提现记录
            </p>
          </div>
        </div>
      </div>
    </transition>
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

/* 金币奖励弹窗动画 */
.reward-popup-enter-active, .reward-popup-leave-active {
  transition: all 0.3s ease-out;
}
.reward-popup-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.reward-popup-enter-to {
  opacity: 1;
  transform: scale(1);
}
.reward-popup-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

@keyframes bounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.animate-bounce {
  animation: bounce 0.6s ease-in-out infinite;
}
</style>
