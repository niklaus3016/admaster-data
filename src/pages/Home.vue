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

// 播放金币到账语音提示
const playCoinSound = (goldAmount: number) => {
  try {
    // 取消之前的语音
    window.speechSynthesis.cancel();
    
    // 根据金币数量使用不同的开心文案
    const gold = Math.floor(goldAmount);
    let message = '';
    
    if (gold > 500) {
      message = `哇塞！太厉害了！恭喜你赚了${gold}金币！你简直是赚钱小能手！`;
    } else if (gold >= 400) {
      message = `太棒了！恭喜你赚了${gold}金币！超级厉害！`;
    } else if (gold >= 300) {
      message = `哇！恭喜你赚了${gold}金币！太厉害了！`;
    } else if (gold >= 200) {
      message = `太好了！恭喜你赚了${gold}金币！继续加油哦！`;
    } else if (gold >= 100) {
      message = `恭喜你赚了${gold}金币！真不错呀！`;
    } else if (gold >= 50) {
      message = `恭喜你赚了${gold}金币！加油加油！`;
    } else {
      message = `恭喜你又赚了${gold}金币！继续努力哦！`;
    }
    
    // 使用 Web Speech API 播报语音
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;      // 稍快一点更活泼
    utterance.pitch = 1.5;     // 更高的音调更开心
    utterance.volume = 1.0;
    
    // 获取所有可用语音，优先选择中文女声
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice => 
      voice.lang.includes('zh') && 
      (voice.name.includes('Female') || voice.name.includes('女') || voice.name.includes('Xiaoxiao'))
    ) || voices.find(voice => voice.lang.includes('zh')) || voices[0];
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    // 播放语音
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.log('播放语音失败:', err);
  }
};
const records = ref<Record[]>([]);
const isLoading = ref(false);
const isLoadingRecords = ref(false);
const error = ref('');

const isWatching = ref(false);
const showReward = ref<number | null>(null);
const showAllRecords = ref(false);
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
  if (!userId.value) return;
  
  try {
    const response = await getLoginStats(userId.value);
    if (response.success && response.data) {
      loginDays.value = response.data.loginDays || 0;
    }
  } catch (err) {
    console.error('加载登录统计失败:', err);
  }
};

// 加载金币记录
const loadGoldRecords = async () => {
  if (!userId.value) return;
  
  isLoadingRecords.value = true;
  
  try {
    const response = await getGoldLogs(userId.value);
    if (response.success && response.data) {
      const logs = response.data;
      
      // 转换记录格式
      records.value = logs.map((log: any) => ({
        id: log.id,
        time: new Date(log.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        amount: log.amount
      }));
      
      // 计算今日金币
      const today = new Date().toDateString();
      todayCoins.value = logs
        .filter((log: any) => new Date(log.createdAt).toDateString() === today)
        .reduce((sum: number, log: any) => sum + log.amount, 0);
      
      // 计算本月和上月金币
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      currentMonthGold.value = logs
        .filter((log: any) => {
          const logDate = new Date(log.createdAt);
          return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
        })
        .reduce((sum: number, log: any) => sum + log.amount, 0);
      
      lastMonthGold.value = logs
        .filter((log: any) => {
          const logDate = new Date(log.createdAt);
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return logDate.getMonth() === lastMonth && logDate.getFullYear() === lastYear;
        })
        .reduce((sum: number, log: any) => sum + log.amount, 0);
      
      // 检查是否有额外奖励可领取
      if (todayCoins.value >= todayTarget.value && !hasClaimedBonus.value) {
        bonusGold.value = 500;
      }
    }
  } catch (err) {
    console.error('加载金币记录失败:', err);
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
    console.log('========== 开始处理广告观看 ==========');
    console.log('userId:', userId.value);
    console.log('empId:', empId.value);
    
    // 调用广告管理逻辑
    const result = await showRewardVideo();
    
    console.log('广告返回结果:', result);
    console.log('ecpm值:', result.ecpm);
    console.log('ecpm类型:', typeof result.ecpm);
    
    // 检查参数是否有效
    if (!userId.value || !empId.value) {
      console.error('缺少必要参数:', { userId: userId.value, empId: empId.value });
      error.value = '缺少必要参数，请重新登录';
      isWatching.value = false;
      return;
    }
    
    // 调用后端发放金币接口
    console.log('调用rewardGold:', { 
      userId: userId.value, 
      empId: empId.value, 
      ecpm: result.ecpm 
    });
    
    const rewardResponse = await rewardGold(userId.value, empId.value, result.ecpm);
    
    console.log('rewardGold响应:', rewardResponse);
    
    if (rewardResponse.success && rewardResponse.data) {
      const earned = rewardResponse.data.gold;
      console.log('获得金币:', earned, '准备播放语音和显示动画');
      // 更新本地状态
      currentMonthGold.value = rewardResponse.data.currentMonthGold;
      // 播放金币到账语音提示
      playCoinSound(earned);
      // 显示奖励动画
      showReward.value = earned;
      console.log('showReward已设置为:', earned);
      // 重新加载金币记录（会自动计算今日金币）
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
    console.log('========== 广告观看处理结束 ==========');
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
      playCoinSound(earned);
      showReward.value = earned;
      hasClaimedBonus.value = true;
      bonusGold.value = 0;
      await loadGoldRecords();
      setTimeout(() => {
        showReward.value = null;
      }, 3000);
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

// 处理提现
const handleWithdraw = async () => {
  if (!userId.value || !alipayAccount.value || !alipayName.value || withdrawAmount.value <= 0) {
    error.value = '请填写完整的提现信息';
    return;
  }
  
  isSubmittingWithdraw.value = true;
  
  try {
    const response = await submitWithdrawRequest({
      userId: userId.value,
      amount: withdrawAmount.value,
      alipayAccount: alipayAccount.value,
      alipayName: alipayName.value
    });
    
    if (response.success) {
      withdrawSuccess.value = true;
      // 3秒后关闭弹窗
      setTimeout(() => {
        showWithdrawModal.value = false;
        withdrawSuccess.value = false;
        withdrawAmount.value = 0;
        alipayAccount.value = '';
        alipayName.value = '';
        // 重新加载金币记录
        loadGoldRecords();
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

// 加载提现记录
const loadWithdrawRecords = async () => {
  if (!userId.value) return;
  
  isLoadingWithdrawRecords.value = true;
  
  try {
    const response = await getWithdrawRecords(userId.value);
    if (response.success && response.data) {
      withdrawRecords.value = response.data;
    }
  } catch (err) {
    console.error('加载提现记录失败:', err);
  } finally {
    isLoadingWithdrawRecords.value = false;
  }
};

// 退出登录
const handleLogout = () => {
  localStorage.removeItem('userId');
  localStorage.removeItem('empId');
  localStorage.removeItem('userName');
  router.push('/login');
};

// 广告管理
const { showRewardVideo, isAdReady, isAdLoading } = useAdManager();

// 调试信息
const debugMessages = ref<string[]>([]);

const addDebugMessage = (message: string) => {
  debugMessages.value.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  // 最多保存20条信息
  if (debugMessages.value.length > 20) {
    debugMessages.value.shift();
  }
};

// 监听关键事件
window.addEventListener('speechSynthesisStart', () => {
  addDebugMessage('语音播放开始');
});

window.addEventListener('speechSynthesisEnd', () => {
  addDebugMessage('语音播放结束');
});

// 生命周期
onMounted(async () => {
  if (!userId.value) {
    router.push('/login');
    return;
  }
  
  isLoading.value = true;
  
  try {
    // 记录登录
    await recordLogin(userId.value);
    // 加载登录统计
    await loadLoginStats();
    // 加载金币记录
    await loadGoldRecords();
  } catch (err) {
    console.error('初始化失败:', err);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- 导航栏 -->
    <nav class="bg-white shadow-md p-4">
      <div class="container mx-auto flex justify-between items-center">
        <div class="flex items-center space-x-2">
          <Coins class="h-6 w-6 text-yellow-500" />
          <span class="text-xl font-bold text-gray-800">金币任务</span>
        </div>
        <div class="flex items-center space-x-4">
          <button @click="showWithdrawRecordsModal = true" class="flex items-center space-x-1 text-gray-600 hover:text-blue-500">
            <History class="h-5 w-5" />
            <span>提现记录</span>
          </button>
          <button @click="handleLogout" class="flex items-center space-x-1 text-gray-600 hover:text-red-500">
            <LogOut class="h-5 w-5" />
            <span>退出</span>
          </button>
        </div>
      </div>
    </nav>

    <!-- 主内容 -->
    <main class="flex-1 container mx-auto p-4">
      <!-- 金币统计卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-gray-600 font-medium">本月金币</h3>
            <TrendingUp class="h-5 w-5 text-green-500" />
          </div>
          <p class="text-2xl font-bold text-gray-800">{{ currentMonthGold }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-gray-600 font-medium">上月金币</h3>
            <TrendingUp class="h-5 w-5 text-green-500" />
          </div>
          <p class="text-2xl font-bold text-gray-800">{{ lastMonthGold }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-gray-600 font-medium">今日金币</h3>
            <Coins class="h-5 w-5 text-yellow-500" />
          </div>
          <p class="text-2xl font-bold text-gray-800">{{ todayCoins }}</p>
          <p class="text-sm text-gray-500 mt-1">目标: {{ todayTarget }} 金币</p>
        </div>
      </div>

      <!-- 今日目标奖励 -->
      <div v-if="todayCoins >= todayTarget && !hasClaimedBonus" class="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg shadow p-4 mb-6 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold">🎉 今日目标达成！</h3>
            <p class="mt-1">额外奖励 {{ bonusGold }} 金币</p>
          </div>
          <button 
            @click="handleClaimBonus"
            :disabled="isClaimingBonus"
            class="bg-white text-yellow-600 px-4 py-2 rounded-lg font-bold hover:bg-yellow-100 disabled:opacity-50"
          >
            {{ isClaimingBonus ? '领取中...' : '立即领取' }}
          </button>
        </div>
      </div>

      <!-- 主要操作区 -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-4">赚取金币</h2>
        
        <!-- 广告按钮 -->
        <button 
          @click="handleWatchAd"
          :disabled="isWatching || !isAdReady"
          class="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          <PlayCircle class="h-6 w-6" />
          <span>{{ isWatching ? '广告观看中...' : isAdLoading ? '广告加载中...' : '观看广告赚金币' }}</span>
        </button>
        
        <!-- 错误提示 -->
        <div v-if="error" class="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
          {{ error }}
        </div>
      </div>

      <!-- 金币奖励动画 -->
      <div v-if="showReward" class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
        <div class="bg-yellow-400 text-white px-8 py-4 rounded-full shadow-lg text-2xl font-bold animate-bounce">
          +{{ showReward }} 金币
        </div>
      </div>

      <!-- 金币记录 -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-800">最近收益记录</h2>
          <button @click="showAllRecords = !showAllRecords" class="text-blue-500 hover:underline">
            {{ showAllRecords ? '收起' : '查看更多' }}
          </button>
        </div>
        
        <div v-if="isLoadingRecords" class="text-center py-4">
          加载中...
        </div>
        
        <div v-else-if="records.length === 0" class="text-center py-4 text-gray-500">
          暂无记录
        </div>
        
        <div v-else class="space-y-3">
          <div 
            v-for="record in showAllRecords ? records : records.slice(0, 5)" 
            :key="record.id"
            class="flex justify-between items-center p-3 border-b border-gray-100"
          >
            <div>
              <p class="text-gray-800 font-medium">金币奖励</p>
              <p class="text-sm text-gray-500">{{ record.time }}</p>
            </div>
            <p class="text-green-600 font-bold">+{{ record.amount }}</p>
          </div>
        </div>
      </div>

      <!-- 提现区域 -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-4">提现</h2>
        
        <div v-if="!withdrawEnabled" class="text-center py-8 text-gray-500">
          提现功能暂未开放
        </div>
        
        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-gray-700 mb-2">支付宝账号</label>
              <input 
                v-model="alipayAccount"
                type="text" 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入支付宝账号"
              />
            </div>
            <div>
              <label class="block text-gray-700 mb-2">支付宝姓名</label>
              <input 
                v-model="alipayName"
                type="text" 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入真实姓名"
              />
            </div>
          </div>
          
          <div>
            <label class="block text-gray-700 mb-2">提现金额</label>
            <input 
              v-model.number="withdrawAmount"
              type="number" 
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入提现金额"
              min="1000"
              step="1000"
            />
            <p class="text-sm text-gray-500 mt-1">最低提现金额: 1000 金币</p>
          </div>
          
          <button 
            @click="showWithdrawModal = true"
            class="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600"
          >
            申请提现
          </button>
        </div>
      </div>

      <!-- 调试信息区域 -->
      <div class="bg-gray-100 rounded-lg p-4 mb-6">
        <h3 class="text-lg font-bold text-gray-800 mb-2">调试信息</h3>
        <div class="max-h-40 overflow-y-auto bg-white p-3 rounded-lg text-sm">
          <div v-if="debugMessages.length === 0" class="text-gray-500">
            暂无调试信息
          </div>
          <div v-else class="space-y-1">
            <div v-for="(message, index) in debugMessages" :key="index" class="text-gray-700">
              {{ message }}
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 底部导航 -->
    <footer class="bg-white shadow-inner py-4">
      <div class="container mx-auto text-center text-gray-600">
        <p>金币任务 v1.0</p>
      </div>
    </footer>

    <!-- 提现确认弹窗 -->
    <div v-if="showWithdrawModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 class="text-xl font-bold text-gray-800 mb-4">确认提现</h3>
        
        <div v-if="withdrawSuccess" class="text-center py-6">
          <div class="text-green-500 text-4xl mb-2">✅</div>
          <p class="text-gray-800 font-medium">提现申请已提交</p>
          <p class="text-gray-500 mt-1">我们将尽快处理您的提现请求</p>
        </div>
        
        <div v-else>
          <div class="space-y-4">
            <div>
              <p class="text-gray-700">支付宝账号: {{ alipayAccount }}</p>
            </div>
            <div>
              <p class="text-gray-700">支付宝姓名: {{ alipayName }}</p>
            </div>
            <div>
              <p class="text-gray-700">提现金额: {{ withdrawAmount }} 金币</p>
            </div>
          </div>
          
          <div class="mt-6 flex space-x-3">
            <button 
              @click="showWithdrawModal = false"
              class="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button 
              @click="handleWithdraw"
              :disabled="isSubmittingWithdraw"
              class="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {{ isSubmittingWithdraw ? '提交中...' : '确认提现' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 提现记录弹窗 -->
    <div v-if="showWithdrawRecordsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-800">提现记录</h3>
          <button @click="showWithdrawRecordsModal = false" class="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        
        <div v-if="isLoadingWithdrawRecords" class="text-center py-4">
          加载中...
        </div>
        
        <div v-else-if="withdrawRecords.length === 0" class="text-center py-8 text-gray-500">
          暂无提现记录
        </div>
        
        <div v-else class="space-y-3">
          <div 
            v-for="record in withdrawRecords" 
            :key="record.id"
            class="p-3 border-b border-gray-100"
          >
            <div class="flex justify-between items-center">
              <p class="text-gray-800 font-medium">{{ record.amount }} 金币</p>
              <span 
                :class="{
                  'text-green-600': record.status === 'success',
                  'text-yellow-600': record.status === 'pending',
                  'text-red-600': record.status === 'failed'
                }"
              >
                {{ record.status === 'success' ? '成功' : record.status === 'pending' ? '处理中' : '失败' }}
              </span>
            </div>
            <p class="text-sm text-gray-500 mt-1">{{ new Date(record.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes bounce {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
  }
}

.animate-bounce {
  animation: bounce 1s ease-in-out;
}
</style>