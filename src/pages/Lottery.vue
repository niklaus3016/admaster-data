<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import { Ticket, Trophy, Sparkles, Coins, Clock, TrendingUp } from 'lucide-vue-next';
import { useLocalStorage } from '../composables/useLocalStorage';
import { getLotteryPool, getCurrentLotteryTickets, getLotteryHistory, getLotteryResult, generateLotteryTicket, getUserInfo, getLastLotteryTicket, getLotterySettings } from '../api/apiService';

// 响应式数据
const poolStatus = ref({ currentAmount: 0, totalAmount: 0, lastDrawTime: '' });
const lotteryTickets = ref<any[]>([]);
const previousTickets = ref<any[]>([]);
const showPreviousTickets = ref(false);
const pastDraws = ref<any[]>([]);
const userInfo = ref({ currentMonthGold: 0 });
const isSpinning = ref(false);
const result = ref<string | null>(null);
const winAmount = ref(0);
const currentTicket = ref<string | null>(null);
const countdown = ref({ h: '00', m: '00', s: '00' });
const lotterySettings = ref({
  adCountThreshold: 100,
  firstPrizePercentage: 0.5,
  secondPrizePercentage: 0.3,
  thirdPrizePercentage: 0.2,
  firstPrizeCount: 1,
  secondPrizeCount: 2,
  thirdPrizeCount: 3
}); // 默认值
let timerInterval: any = null;
const isLoading = ref(true);

// 计算属性
const formattedPoolAmount = computed(() => {
  const amount = poolStatus.value.currentAmount;
  if (isNaN(amount)) return '0.00';
  const fixedAmount = amount.toFixed(2);
  const parts = fixedAmount.split('.');
  parts[0] = parseInt(parts[0]).toLocaleString('zh-CN');
  return parts.join('.');
});

const formattedUserCoins = computed(() => {
  return userInfo.value.currentMonthGold.toLocaleString();
});

// 加载数据
const loadData = async () => {
  isLoading.value = true;
  try {
    // 加载奖金池状态
    const poolResponse = await getLotteryPool();
    if (poolResponse.success && poolResponse.data) {
      poolStatus.value = poolResponse.data;
    }

    // 加载用户奖券
    // 使用新的userId格式
    const userId = 'user_8202_1772466028893';
    const employeeId = localStorage.getItem('employeeId');
    if (userId) {
      const ticketsResponse = await getCurrentLotteryTickets(userId);
      console.log('getCurrentLotteryTickets响应:', ticketsResponse);
      if (ticketsResponse.success && ticketsResponse.data) {
        console.log('实际获取到的彩票数量:', ticketsResponse.data.tickets.length);
        lotteryTickets.value = ticketsResponse.data.tickets || [];
        console.log('待开奖奖券:', lotteryTickets.value);
      }

      // 加载用户信息
      if (employeeId) {
        const userResponse = await getUserInfo(userId, employeeId);
        if (userResponse.success && userResponse.data) {
          userInfo.value = userResponse.data;
        }
      }
    }

    // 加载开奖历史
    const historyResponse = await getLotteryHistory();
    if (historyResponse.data) {
      pastDraws.value = historyResponse.data.history || [];
      console.log('开奖历史数据:', pastDraws.value);
    }

    // 加载最新开奖结果
    const resultResponse = await getLotteryResult();
    if (resultResponse.success && resultResponse.data) {
      // 可以在这里处理最新开奖结果
    }

    // 加载彩票设置
    const settingsResponse = await getLotterySettings();
    if (settingsResponse.success && settingsResponse.data) {
      lotterySettings.value = settingsResponse.data;
    }

    // 加载上一期彩票数据
    if (userId) {
      const lastTicketResponse = await getLastLotteryTicket(userId);
      console.log('getLastLotteryTicket响应:', lastTicketResponse);
      if (lastTicketResponse.success && lastTicketResponse.data) {
        // 检查是否中奖（根据后端返回的数据判断）
        const lastTicket = lastTicketResponse.data;
        console.log('上一期彩票数据:', lastTicket);
        
        // 检查后端返回的中奖状态
        let isWinner = lastTicket.status.includes('中奖');
        let prize = lastTicket.status;
        console.log('初始中奖状态:', { isWinner, prize });
        
        console.log('最终中奖状态:', { isWinner, prize });
        previousTickets.value = [{
          ticketNumber: lastTicket.ticketNumber,
          createdAt: lastTicket.createdAt,
          status: lastTicket.status,
          isWinner: isWinner,
          prize: prize
        }];
        console.log('previousTickets:', previousTickets.value);
      } else {
        previousTickets.value = [];
      }
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    isLoading.value = false;
  }
};

// 模拟开奖（实际开奖由后端定时执行）
const drawLottery = () => {
  if (lotteryTickets.value.length === 0 || isSpinning.value) return;
  
  isSpinning.value = true;
  result.value = null;
  
  // 模拟开奖过程
  setTimeout(() => {
    const rand = Math.random();
    if (rand > 0.98) {
      winAmount.value = Math.floor(poolStatus.value.totalAmount * 0.5);
      result.value = '一等奖';
    } else if (rand > 0.9) {
      winAmount.value = Math.floor(poolStatus.value.totalAmount * 0.3);
      result.value = '二等奖';
    } else if (rand > 0.7) {
      winAmount.value = Math.floor(poolStatus.value.totalAmount * 0.2);
      result.value = '三等奖';
    } else {
      winAmount.value = 0;
      result.value = '未中奖';
    }
    
    // 更新用户金币
    userInfo.value.currentMonthGold += winAmount.value;
    
    // 添加到开奖历史
    if (winAmount.value > 0) {
      const newDraw = {
        id: Date.now().toString(),
        time: new Date().toLocaleDateString(),
        number: '123456', // 模拟票号
        prize: result.value,
        amount: winAmount.value,
        user: localStorage.getItem('employeeId') || '0000'
      };
      pastDraws.value = [newDraw, ...pastDraws.value].slice(0, 10);
    }
    
    isSpinning.value = false;
  }, 2000);
};

// 更新倒计时
const updateCountdown = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(22, 0, 0, 0);

  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const diff = target.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');

  countdown.value = { h, m, s };
};

// 生命周期钩子
let poolRefreshInterval: any = null;

onMounted(() => {
  loadData();
  updateCountdown();
  timerInterval = setInterval(updateCountdown, 1000);
  // 每5秒自动刷新奖金池数据
  poolRefreshInterval = setInterval(() => {
    // 只刷新奖金池数据，避免频繁加载所有数据
    const poolResponse = getLotteryPool();
    poolResponse.then(response => {
      if (response.success && response.data) {
        poolStatus.value = response.data;
      }
    });
  }, 5000); // 5秒刷新一次
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (poolRefreshInterval) clearInterval(poolRefreshInterval);
});

// 监听开奖状态
watch(isSpinning, (spinning) => {
  if (!spinning && lotteryTickets.value.length > 0) {
    // 可以在这里添加自动开奖逻辑
  }
});
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0b] text-white pb-32 relative overflow-x-hidden">
    <!-- 背景装饰光晕 -->
    <div class="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none" />
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

    <!-- Header -->
    <header class="bg-black/40 backdrop-blur-xl border-b border-white/5 pt-8 pb-5 px-6 flex justify-between items-center sticky top-0 z-20">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Ticket class="text-white w-5 h-5" />
        </div>
        <div class="flex flex-col">
          <span class="font-bold text-sm tracking-widest uppercase bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">幸运彩票</span>
          <span class="text-[10px] text-zinc-400 font-bold tracking-wider">超级大奖，福利大派送！</span>
        </div>
      </div>
      <div class="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
        <span class="text-xs font-mono text-amber-400">{{ lotteryTickets.length }}</span>
        <Ticket class="w-3 h-3 text-amber-500" />
      </div>
    </header>

    <main class="max-w-md mx-auto px-6 mt-6 space-y-6 relative z-10">
      <!-- 奖金池 -->
      <div class="relative group bg-gradient-to-br from-zinc-900 to-black p-8 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl text-center">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        
        <div class="flex items-center justify-center gap-2 mb-3">
          <p class="text-[10px] uppercase tracking-[0.3em] text-zinc-500">当前奖金池累计</p>
          <Coins class="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div class="flex items-center justify-center">
          <span class="text-4xl font-black tracking-tighter text-amber-500 font-mono animate-breath inline-block">
            {{ formattedPoolAmount }}
          </span>
        </div>

        <div class="mt-6 flex justify-center gap-4">
          <div class="px-3 py-1 rounded-full bg-white/5 border border-white/5 flex items-center gap-2">
            <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span class="text-[9px] text-zinc-400 uppercase tracking-widest">系统自动累积</span>
          </div>
        </div>
      </div>

      <!-- 下次系统开奖倒计时 -->
      <div class="flex flex-col items-center py-0.5">
        <div class="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/5 border border-amber-500/10 mb-5">
          <Clock class="w-2 h-2 text-amber-500 animate-pulse" />
          <span class="text-[9px] uppercase tracking-[0.3em] text-amber-500 font-bold">开奖倒计时</span>
        </div>
        
        <div class="flex items-center gap-4">
          <!-- 小时 -->
          <div class="flex flex-col items-center gap-1">
            <div class="w-11 h-13 bg-zinc-900/80 rounded-lg border border-white/5 flex items-center justify-center shadow-inner">
              <span class="text-xl font-black font-mono text-emerald-400 tracking-tight">{{ countdown.h }}</span>
            </div>
            <span class="text-[9px] text-zinc-600 font-bold">时</span>
          </div>
          
          <span class="text-zinc-700 font-bold mt-[-16px]">:</span>
          
          <!-- 分钟 -->
          <div class="flex flex-col items-center gap-1">
            <div class="w-11 h-13 bg-zinc-900/80 rounded-lg border border-white/5 flex items-center justify-center shadow-inner">
              <span class="text-xl font-black font-mono text-emerald-400 tracking-tight">{{ countdown.m }}</span>
            </div>
            <span class="text-[9px] text-zinc-600 font-bold">分</span>
          </div>
          
          <span class="text-zinc-700 font-bold mt-[-16px]">:</span>
          
          <!-- 秒 -->
          <div class="flex flex-col items-center gap-1">
            <div class="w-11 h-13 bg-zinc-900/80 rounded-lg border border-white/5 flex items-center justify-center shadow-inner">
              <span class="text-xl font-black font-mono text-emerald-400 tracking-tight">{{ countdown.s }}</span>
            </div>
            <span class="text-[9px] text-zinc-600 font-bold">秒</span>
          </div>
        </div>
        
        <p class="mt-1 text-[8px] text-zinc-700 uppercase tracking-widest">每晚 22:00 准时开奖</p>
      </div>

      <!-- 我的幸运彩票 -->
      <div class="w-full py-6 px-6 rounded-[2rem] bg-white/[0.01] border border-white/[0.03] relative overflow-hidden">
        <div class="flex justify-between items-end mb-4 relative z-10 px-2">
          <div class="flex flex-col gap-1">
            <h3 class="text-[11px] uppercase tracking-[0.3em] text-zinc-500 font-black">我的幸运彩票</h3>
            <div class="flex items-center gap-2">
              <span class="text-xl font-black text-white">{{ lotteryTickets.length }}</span>
              <span class="text-[9px] text-zinc-600 uppercase tracking-widest">张待开奖</span>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="showPreviousTickets = !showPreviousTickets" class="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] text-zinc-400 uppercase tracking-[0.2em] font-bold hover:bg-white/10 transition-colors">
              {{ showPreviousTickets ? '隐藏' : '显示' }}上期彩票
            </button>
            <div v-if="isSpinning" class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
              <div class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              <span class="text-[9px] text-amber-500 font-bold uppercase tracking-[0.2em]">正在校验中</span>
            </div>
          </div>
        </div>

        <!-- 彩票列表 -->
        <div v-if="lotteryTickets.length > 0" class="grid grid-cols-2 gap-3 relative z-10">
          <div 
            v-for="(ticket, index) in lotteryTickets.slice(0, 4)" 
            :key="ticket.ticketNumber" 
            class="ticket-card group relative flex flex-col h-24 cursor-pointer transition-all active:scale-[0.96]"
          >
            <!-- 票面主体 -->
            <div class="relative flex-1 bg-zinc-900/60 border border-white/5 rounded-xl flex flex-col items-center justify-center overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent pointer-events-none" />
              
              <span class="text-[7px] text-zinc-600 uppercase tracking-[0.2em] font-bold mb-1">Ticket No.</span>
              <span class="text-lg font-mono font-black text-amber-500 tracking-widest drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                {{ ticket.ticketNumber || '000000' }}
              </span>
              <span class="text-[7px] text-zinc-500 font-mono mt-0.5 opacity-60">{{ new Date(ticket.createdAt || new Date()).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.') }}</span>
              
              <!-- 装饰虚线 (底部) -->
              <div class="absolute bottom-2 left-2 right-2 border-t border-dashed border-white/5" />
              
              <!-- 流光效果 -->
              <div class="shimmer-effect" />
            </div>

            <!-- 侧边切口装饰 -->
            <div class="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-[#0a0a0b] rounded-full border border-white/5" />
            <div class="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-[#0a0a0b] rounded-full border border-white/5" />
            
            <!-- 底部状态栏 -->
            <div class="mt-1 flex items-center justify-center gap-1.5">
              <div class="w-1 h-1 rounded-full bg-amber-500/40" />
              <span class="text-[7px] text-zinc-500 uppercase tracking-widest font-bold">{{ ticket.status || '待开奖' }}</span>
            </div>
          </div>
          
          <div v-if="lotteryTickets.length > 4" class="col-span-2 pt-2 text-center">
            <button class="text-[9px] text-zinc-600 uppercase tracking-[0.3em] font-bold hover:text-zinc-400 transition-colors">
              查看其余 {{ lotteryTickets.length - 4 }} 张彩票
            </button>
          </div>
        </div>

        <!-- 上一期彩票 -->
        <div v-if="showPreviousTickets && previousTickets.length > 0" class="mt-6 pt-4 border-t border-white/5 relative z-10">
          <h4 class="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-bold mb-3 px-2">上一期彩票</h4>
          <div class="grid grid-cols-2 gap-3">
            <div 
              v-for="(ticket, index) in previousTickets.slice(0, 4)" 
              :key="ticket.ticketNumber" 
              class="ticket-card group relative flex flex-col h-24 cursor-pointer transition-all active:scale-[0.96]"
            >
              <!-- 票面主体 -->
              <div class="relative flex-1 bg-zinc-900/60 border border-white/5 rounded-xl flex flex-col items-center justify-center overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent pointer-events-none" />
                
                <span class="text-[7px] text-zinc-600 uppercase tracking-[0.2em] font-bold mb-1">Ticket No.</span>
                <span class="text-lg font-mono font-black text-amber-500 tracking-widest drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                  {{ ticket.ticketNumber || '000000' }}
                </span>
                <span class="text-[7px] text-zinc-500 font-mono mt-0.5 opacity-60">{{ new Date(ticket.createdAt || new Date()).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.') }}</span>
                
                <!-- 装饰虚线 (底部) -->
                <div class="absolute bottom-2 left-2 right-2 border-t border-dashed border-white/5" />
                
                <!-- 流光效果 -->
                <div class="shimmer-effect" />
                
                <!-- 中奖标签 -->
                <div v-if="ticket.isWinner" class="absolute top-0 right-0 pointer-events-none">
                  <div class="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[8px] font-black uppercase tracking-widest py-1 px-3 rounded-bl-lg shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse">
                    {{ ticket.prize || '中奖' }}
                  </div>
                </div>
                
                <!-- 未中奖标签 -->
                <div v-else class="absolute top-0 right-0 pointer-events-none">
                  <div class="bg-gradient-to-r from-zinc-700 to-zinc-800 text-zinc-300 text-[8px] font-bold uppercase tracking-widest py-1 px-3 rounded-bl-lg">
                    未中奖
                  </div>
                </div>
              </div>

              <!-- 侧边切口装饰 -->
              <div class="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-[#0a0a0b] rounded-full border border-white/5" />
              <div class="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-[#0a0a0b] rounded-full border border-white/5" />
              
              <!-- 底部状态栏 -->
              <div class="mt-1 flex items-center justify-center gap-1.5">
                <div class="w-1 h-1 rounded-full" :class="ticket.isWinner ? 'bg-amber-500/40' : 'bg-zinc-700/40'" />
                <span class="text-[7px] text-zinc-500 uppercase tracking-widest font-bold">{{ ticket.status || '已开奖' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="!lotteryTickets.length" class="py-8 flex flex-col items-center justify-center gap-3 opacity-20 relative z-10">
          <div class="w-12 h-12 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
            <Ticket class="w-6 h-6 text-zinc-600" />
          </div>
          <div class="text-center">
            <p class="text-[11px] uppercase tracking-[0.3em] text-zinc-600 font-black">暂无幸运彩票</p>
            <p class="text-[9px] text-zinc-700 mt-1">观看广告即可自动获得幸运彩票</p>
          </div>
        </div>

        <!-- 开奖结果浮层 -->
        <transition 
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="result" class="absolute inset-0 z-20 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
            <div class="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Trophy v-if="winAmount > 0" class="w-8 h-8 text-amber-400 animate-bounce" />
              <Ticket v-else class="w-8 h-8 text-zinc-600" />
            </div>
            <h4 class="text-2xl font-black tracking-[0.2em] uppercase mb-1" :class="winAmount > 0 ? 'text-amber-400' : 'text-zinc-500'">
              {{ result }}
            </h4>
            <p v-if="winAmount > 0" class="text-lg font-mono text-emerald-400 font-bold">+{{ winAmount.toLocaleString() }} 金币</p>
            <p class="text-[10px] text-zinc-500 font-mono mt-4 tracking-widest">号码: {{ currentTicket }}</p>
            <button @click="result = null" class="mt-6 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-zinc-400 hover:bg-white/10 transition-colors">
              知道了
            </button>
          </div>
        </transition>

        <!-- 装饰背景 -->
        <div class="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
      </div>

      <!-- 开奖记录 -->
        <div class="space-y-4">
          <h3 class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold px-2">往期开奖记录（最近7期）</h3>
        <div class="bg-white/[0.02] rounded-[2rem] border border-white/[0.05] overflow-hidden">
          <div class="divide-y divide-white/[0.03] max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div 
              v-for="(draw, index) in pastDraws.slice(0, 7)" 
              :key="draw.issueNumber || index"
              class="px-6 py-4 flex flex-col items-start hover:bg-white/[0.01] transition-colors"
            >
              <div class="flex justify-between w-full items-center mb-2">
                <span class="text-[13px] font-bold text-amber-400">奖池总金额：{{ (draw.poolAmount || 0).toLocaleString() }} 金币</span>
                <span class="text-[9px] text-zinc-600">{{ draw.drawTime ? new Date(draw.drawTime).toLocaleDateString('zh-CN') : '未知时间' }}</span>
              </div>
              <div class="w-full space-y-1">
                <!-- 处理 winners 是对象的情况 -->
                <div v-if="draw.winners && typeof draw.winners === 'object' && !Array.isArray(draw.winners)">
                  <div v-if="draw.winners.firstPrize && draw.winners.firstPrize.length > 0" class="flex flex-col">
                    <div class="flex items-center gap-0">
                      <span class="text-[12px] text-amber-400 w-12">一等奖：</span>
                      <span class="text-[12px] text-amber-400">{{ (draw.firstPrize || 0).toLocaleString() }} 金币</span>
                    </div>
                    <div v-for="(winner, index) in draw.winners.firstPrize" :key="index" class="flex items-center gap-3 ml-12 mt-1">
                      <span class="text-[10px] text-zinc-400">中奖用户：{{ winner.employeeId || '未知' }}</span>
                      <span class="text-[10px] text-zinc-500">|</span>
                      <span class="text-[10px] text-zinc-400">中奖号码：{{ winner.ticketNumber || '未知' }}</span>
                    </div>
                  </div>
                  <div v-if="draw.winners.secondPrize && draw.winners.secondPrize.length > 0" class="flex flex-col">
                    <div class="flex items-center gap-0">
                      <span class="text-[12px] text-amber-400 w-12">二等奖：</span>
                      <span class="text-[12px] text-amber-400">{{ (draw.secondPrize || 0).toLocaleString() }} 金币</span>
                    </div>
                    <div v-for="(winner, index) in draw.winners.secondPrize" :key="index" class="flex items-center gap-3 ml-12 mt-1">
                      <span class="text-[10px] text-zinc-400">中奖用户：{{ winner.employeeId || '未知' }}</span>
                      <span class="text-[10px] text-zinc-500">|</span>
                      <span class="text-[10px] text-zinc-400">中奖号码：{{ winner.ticketNumber || '未知' }}</span>
                    </div>
                  </div>
                  <div v-if="draw.winners.thirdPrize && draw.winners.thirdPrize.length > 0" class="flex flex-col">
                    <div class="flex items-center gap-0">
                      <span class="text-[12px] text-amber-400 w-12">三等奖：</span>
                      <span class="text-[12px] text-amber-400">{{ (draw.thirdPrize || 0).toLocaleString() }} 金币</span>
                    </div>
                    <div v-for="(winner, index) in draw.winners.thirdPrize" :key="index" class="flex items-center gap-3 ml-12 mt-1">
                      <span class="text-[10px] text-zinc-400">中奖用户：{{ winner.employeeId || '未知' }}</span>
                      <span class="text-[10px] text-zinc-500">|</span>
                      <span class="text-[10px] text-zinc-400">中奖号码：{{ winner.ticketNumber || '未知' }}</span>
                    </div>
                  </div>
                </div>
                <!-- 处理 winners 是数组的情况 -->
                <div v-else-if="draw.winners && Array.isArray(draw.winners)">
                  <div v-for="(winner, index) in draw.winners" :key="index" class="flex flex-col">
                    <div class="flex items-center gap-0">
                      <span class="text-[12px] text-amber-400 w-12">中奖：</span>
                      <span class="text-[12px] text-amber-400">{{ (winner.amount || 0).toLocaleString() }} 金币</span>
                    </div>
                    <div class="flex items-center gap-3 ml-12 mt-1">
                      <span class="text-[10px] text-zinc-400">中奖用户：{{ winner.employeeId || '未知' }}</span>
                      <span class="text-[10px] text-zinc-500">|</span>
                      <span class="text-[10px] text-zinc-400">中奖号码：{{ winner.ticketNumber || '未知' }}</span>
                    </div>
                  </div>
                </div>
                <!-- 没有中奖信息的情况 -->
                <div v-else class="flex items-center gap-0">
                  <span class="text-[12px] text-amber-400 w-12">中奖：</span>
                  <span class="text-[10px] text-zinc-400">暂无中奖信息</span>
                </div>
              </div>
            </div>
            <div v-if="pastDraws.length === 0" class="px-6 py-8 flex justify-center items-center">
              <span class="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">暂无开奖记录</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 规则说明 -->
      <div class="w-full p-4 pb-4 rounded-3xl bg-white/[0.02] border border-white/5">
        <h4 class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4">开奖规则</h4>
        <ul class="space-y-3 text-[11px] text-zinc-400 leading-relaxed">
          <li class="flex gap-3">
            <span class="text-amber-500">01</span>
            每观看 {{ lotterySettings.adCountThreshold }} 个广告自动获得一张幸运彩票。
          </li>
          <li class="flex gap-3">
            <span class="text-amber-500">02</span>
            每张彩票包含唯一的 6 位数字号码。
          </li>
          <li class="flex gap-3">
            <span class="text-amber-500">03</span>
            系统每晚 22:00 自动进行一次开奖，处理所有待开奖彩票。
          </li>
          <li class="flex gap-3">
            <span class="text-amber-500">04</span>
            奖池金额由系统设定并持续累积。
          </li>
          <li class="flex gap-3">
            <span class="text-amber-500">05</span>
            奖金分配：按照一等奖{{ Math.round(lotterySettings.firstPrizePercentage * 100) }}%（{{ lotterySettings.firstPrizeCount }}人）、二等奖{{ Math.round(lotterySettings.secondPrizePercentage * 100) }}%（{{ lotterySettings.secondPrizeCount }}人）、三等奖{{ Math.round(lotterySettings.thirdPrizePercentage * 100) }}%（{{ lotterySettings.thirdPrizeCount }}人）分配奖金。
          </li>
        </ul>
      </div>
    </main>

    <!-- 底部导航栏 -->
    <div class="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-xl border-t border-white/5 py-3 px-6 z-50">
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
          class="flex flex-col items-center transition-all duration-300"
          :class="$route.path === '/lottery' ? 'text-emerald-400 scale-105' : 'text-zinc-400 hover:text-zinc-300'"
        >
          <Ticket class="w-6 h-6 mb-1" />
          <span class="text-xs font-medium">幸运彩票</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes breath {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 0px rgba(245, 158, 11, 0));
  }
  50% {
    transform: scale(1.05);
    filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.5));
  }
}

@keyframes shimmer {
  0% { transform: translateX(-150%) skewX(-20deg); }
  100% { transform: translateX(150%) skewX(-20deg); }
}

.animate-breath {
  animation: breath 3s ease-in-out infinite;
  display: inline-block;
}

.shimmer-effect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to right,
    transparent,
    rgba(255, 255, 255, 0.03),
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.03),
    transparent
  );
  animation: shimmer 3s infinite;
  pointer-events: none;
}

.ticket-card:hover .shimmer-effect {
  animation-duration: 1.5s;
}
</style>