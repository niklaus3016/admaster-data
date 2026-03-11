import { ref, onMounted, onUnmounted } from 'vue';
import BaiduAd from '../plugins/BaiduAdPlugin';

declare global {
  interface Window {
    baidu?: any;
    _baidu?: any;
  }
}

interface AdConfig {
  appId: string;
  slotIds: string[];
}

const isLoaded = ref(false);
const isAdSdkReady = ref(false);
const isAdLoading = ref(false);
const isAdReady = ref(false);
const lastError = ref('');
const preloadAd = ref(false);

export function useAdManager(config: AdConfig) {
  let rewardVerifyListener: any = null;
  let adFailedListener: any = null;
  let videoDownloadSuccessListener: any = null;
  let videoDownloadFailedListener: any = null;
  let adLoadedListener: any = null;
  let adCloseListener: any = null;
  let timeoutId: any = null;
  let retryTimeoutId: any = null;
  let currentResolve: any = null;
  let currentReject: any = null;
  let currentSlotIndex = 0;
  let triedSlots = 0;
  let slotTimeoutId: any = null;
  let currentSessionId = 0;
  let isProcessing = false; // 是否正在处理广告，防止并发
  const MAX_RETRY_ROUNDS = 1; // 轮询1遍即可
  const SLOT_TIMEOUT = 3000;
  
  const generateSimulatedEcpm = (slotId: string): number => {
    const ecpmRanges: { [key: string]: [number, number] } = {
      '19188698': [1400, 1500], // 保价1500
      '19202078': [1200, 1400], // 保价1400
      '19202080': [1000, 1200], // 保价1200
      '19188424': [800, 1000],  // 保价1000
      '19188704': [500, 800],    // 保价800
      '19202085': [400, 500],    // 保价500
      '19188706': [300, 400],    // 保价400
      '19202092': [200, 300],    // 保价300
      '19188709': [180, 200],    // 保价200
      '19202094': [150, 180],    // 保价180
      '19188421': [130, 150],    // 保价150
      '19202097': [100, 130],    // 保价130
      '19183768': [80, 100],     // 保价100
      '19188420': [60, 80],      // 保价80
      '19202099': [40, 60],      // 保价60
      '19202100': [20, 40],      // 保价40
      '19188427': [10, 20],       // 竞价
      '19202101': [1, 10]         // 保价10
    };
    
    const range = ecpmRanges[slotId];
    if (!range) return 0;
    return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  };
  
  const getNextSlotId = (): string => {
    if (!config.slotIds?.length) throw new Error('广告位配置为空');
    const slotId = config.slotIds[currentSlotIndex];
    const currentRound = Math.floor(triedSlots / config.slotIds.length) + 1;
    const positionInRound = (triedSlots % config.slotIds.length) + 1;
    console.log(`当前轮询广告位: ${slotId} (第${currentRound}轮 ${positionInRound}/${config.slotIds.length})`);
    currentSlotIndex = (currentSlotIndex + 1) % config.slotIds.length;
    triedSlots++;
    return slotId;
  };
  
  const resetAdState = () => {
    currentSlotIndex = 0;
    triedSlots = 0;
    isAdLoading.value = false;
    isAdReady.value = false;
    currentSessionId++;
    console.log(`🆕 新会话开始，会话ID: ${currentSessionId}`);
  };

  onMounted(() => initializeAdSdk());
  onUnmounted(() => cleanupListeners());

  const cleanupListeners = () => {
    console.log('🔄 清理广告监听器...');
    
    const listeners = [
      { name: 'onRewardVerify', handler: rewardVerifyListener },
      { name: 'onAdFailed', handler: adFailedListener },
      { name: 'onVideoDownloadSuccess', handler: videoDownloadSuccessListener },
      { name: 'onVideoDownloadFailed', handler: videoDownloadFailedListener },
      { name: 'onAdLoaded', handler: adLoadedListener },
      { name: 'onAdClose', handler: adCloseListener }
    ];
    
    listeners.forEach(({ name, handler }) => {
      if (handler) {
        try {
          BaiduAd.removeListener(name, handler);
        } catch (e) {
          console.warn(`移除 ${name} 监听器失败:`, e);
        }
      }
    });
    
    rewardVerifyListener = null;
    adFailedListener = null;
    videoDownloadSuccessListener = null;
    videoDownloadFailedListener = null;
    adLoadedListener = null;
    adCloseListener = null;
    
    [timeoutId, retryTimeoutId, slotTimeoutId].forEach(id => {
      if (id) {
        clearTimeout(id);
        id = null;
      }
    });
    
    console.log('✅ 监听器清理完成');
  };

  const isNativeApp = () => {
    return typeof window !== 'undefined' && 
           (window as any).Capacitor?.getPlatform() === 'android';
  };

  const initializeAdSdk = async () => {
    if (typeof window === 'undefined') return;

    try {
      if (isNativeApp()) {
        console.log('原生 Android 环境，使用百度原生 SDK');
        isAdSdkReady.value = true;
        isLoaded.value = true;
        preloadAd.value = true;
        return;
      }

      if (window.baidu?.mobads) {
        console.log('百度 H5 广告 SDK 已加载');
        isAdSdkReady.value = true;
        isLoaded.value = true;
        preloadAd.value = true;
        return;
      }

      console.log('尝试加载百度 H5 广告 SDK');
      const script = document.createElement('script');
      script.src = 'https://mobads.baidu.com/js/mobads.js';
      script.async = true;
      script.onload = () => {
        console.log('百度 H5 广告 SDK 加载成功');
        isAdSdkReady.value = true;
        isLoaded.value = true;
        preloadAd.value = true;
        window.baidu?.mobads?.setAppId?.(config.appId);
      };
      script.onerror = () => {
        console.error('百度 H5 广告 SDK 加载失败');
        isLoaded.value = true;
        isAdSdkReady.value = false;
        preloadAd.value = true;
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('初始化广告 SDK 失败:', error);
      isLoaded.value = true;
      isAdSdkReady.value = false;
      preloadAd.value = true;
    }
  };

  const showRewardVideo = async (): Promise<{ ecpm: number; slotId: string }> => {
    return new Promise(async (resolve, reject) => {
      // 防止并发请求
      if (isProcessing) {
        console.log('⚠️ 已有广告正在处理，请等待');
        reject(new Error('已有广告正在处理'));
        return;
      }
      
      isProcessing = true;
      resetAdState();
      currentResolve = resolve;
      currentReject = reject;
      
      console.log('========== 开始加载激励视频广告 ==========');
      console.log('所有广告位:', config.slotIds);
      console.log('是否原生环境:', isNativeApp());
      
      try {
        if (isNativeApp()) {
          console.log('使用百度原生广告插件');
          await showNativeAd(resolve, reject);
        } else if (!isAdSdkReady.value || !window.baidu?.mobads) {
          console.warn('百度 H5 广告 SDK 未就绪');
          showNoAdAvailable(reject);
        } else {
          await showH5Ad(resolve, reject);
        }
      } catch (error) {
        console.error('显示广告失败:', error);
        showNoAdAvailable(reject);
      }
    });
  };

  const showNativeAd = async (resolve: (value: { ecpm: number; slotId: string }) => void, reject: (reason?: any) => void) => {
    const sessionId = currentSessionId;
    let currentAdSuccess = false; // 当前广告是否成功
    
    const checkSession = () => sessionId === currentSessionId;
    
    const tryLoadAd = async (): Promise<'success' | 'failed' | 'session_expired'> => {
      if (!checkSession()) {
        console.log('会话已过期，停止加载');
        return 'session_expired';
      }
      
      // 检查是否已尝试所有轮次
      const maxSlots = config.slotIds.length * MAX_RETRY_ROUNDS;
      if (triedSlots >= maxSlots) {
        console.log(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试`);
        return 'failed';
      }
      
      // 清理之前的监听器
      cleanupListeners();
      
      const selectedSlotId = getNextSlotId();
      console.log(`尝试加载广告位: ${selectedSlotId}`);
      
      return new Promise((resolveLoad) => {
        let isResolved = false; // 标记当前加载是否已解决
        
        const resolveOnce = (result: 'success' | 'failed') => {
          if (!isResolved) {
            isResolved = true;
            resolveLoad(result);
          }
        };
        
        const onAdLoaded = () => {
          if (!checkSession()) return;
          console.log('✅ 广告加载成功回调');
        };

        const onRewardVerify = (result: any) => {
          if (!checkSession() || currentAdSuccess) return;
          
          console.log('========== 广告奖励回调 ==========');
          console.log('结果:', result);
          
          currentAdSuccess = true;
          if (slotTimeoutId) clearTimeout(slotTimeoutId);
          
          let ecpm = result.ecpm || 0;
          const currentSlotId = config.slotIds[(currentSlotIndex - 1 + config.slotIds.length) % config.slotIds.length];
          
          if (currentSlotId === '19188427') {
            console.log('竞价位广告，使用模拟 ECPM');
            ecpm = generateSimulatedEcpm(currentSlotId);
          } else if (ecpm === 0) {
            console.log('保价位广告 ECPM 为 0，生成模拟 ECPM');
            ecpm = generateSimulatedEcpm(currentSlotId);
          }
          
          isAdLoading.value = false;
          isAdReady.value = false;
          
          console.log('✅ 广告成功，返回 ECPM:', ecpm, '广告位ID:', currentSlotId);
          cleanupListeners();
          resolve({ ecpm, slotId: currentSlotId });
          
          currentResolve = null;
          currentReject = null;
          isProcessing = false;
          resolveOnce('success');
        };
        
        const onAdFailed = (error: any) => {
          if (!checkSession() || currentAdSuccess || isResolved) return;
          
          console.warn('⚠️ 广告加载失败:', error?.error || error);
          lastError.value = '广告加载失败: ' + (error?.error || error || '未知错误');
          
          if (slotTimeoutId) clearTimeout(slotTimeoutId);
          cleanupListeners();
          resolveOnce('failed');
        };

        const onVideoDownloadSuccess = async () => {
          if (!checkSession() || currentAdSuccess || isResolved) return;
          
          console.log('✅ 视频下载成功，准备显示广告');
          try {
            if (slotTimeoutId) {
              clearTimeout(slotTimeoutId);
              console.log('✅ 清除单层超时定时器');
            }
            
            isAdReady.value = true;
            isAdLoading.value = false;
            
            // 检查广告是否就绪（未过期且缓存成功）
            console.log('🔍 检查广告就绪状态...');
            try {
              const readyStatus = await BaiduAd.isReady();
              console.log('📊 广告就绪状态:', readyStatus);
              
              if (!readyStatus.ready) {
                console.warn('⚠️ 广告未就绪（可能已过期或未缓存完成）');
                // 即使isReady返回false，也尝试显示广告，因为广告可能已经加载成功
                console.log('🔄 尝试强制显示广告...');
              }
            } catch (error) {
              console.warn('⚠️ 检查广告就绪状态失败:', error);
              // 检查失败时也尝试显示广告
            }
            
            console.log('✅ 广告位加载成功且已就绪，准备播放');
            await BaiduAd.showRewardVideoAd();
            console.log('✅ 广告显示命令已发送');
          } catch (error) {
            console.error('❌ 显示广告失败:', error);
            lastError.value = '显示广告失败: ' + (error?.message || error);
            cleanupListeners();
            resolveOnce('failed');
          }
        };

        const onVideoDownloadFailed = () => {
          if (!checkSession() || currentAdSuccess || isResolved) return;
          
          console.warn('⚠️ 视频下载失败');
          lastError.value = '视频下载失败，可能是广告填充不足';
          
          if (slotTimeoutId) clearTimeout(slotTimeoutId);
          cleanupListeners();
          resolveOnce('failed');
        };
        
        const onAdClose = () => {
          if (!checkSession()) return;
          
          console.log('✅ 广告关闭回调');
          if (slotTimeoutId) clearTimeout(slotTimeoutId);
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          
          // 如果广告未成功（用户跳过或未获得奖励），标记为失败
          if (!currentAdSuccess) {
            console.log('广告关闭但未获得奖励，标记为失败');
            resolveOnce('failed');
          }
        };
        
        adLoadedListener = onAdLoaded;
        rewardVerifyListener = onRewardVerify;
        adFailedListener = onAdFailed;
        videoDownloadSuccessListener = onVideoDownloadSuccess;
        videoDownloadFailedListener = onVideoDownloadFailed;
        adCloseListener = onAdClose;
        
        BaiduAd.addListener('onAdLoaded', onAdLoaded);
        BaiduAd.addListener('onRewardVerify', onRewardVerify);
        BaiduAd.addListener('onAdFailed', onAdFailed);
        BaiduAd.addListener('onVideoDownloadSuccess', onVideoDownloadSuccess);
        BaiduAd.addListener('onVideoDownloadFailed', onVideoDownloadFailed);
        BaiduAd.addListener('onAdClose', onAdClose);
        
        BaiduAd.loadRewardVideoAd({ adId: selectedSlotId })
          .then(() => console.log('✅ 广告加载请求已发送'))
          .catch((err: any) => {
            console.error('❌ 加载广告请求失败:', err);
            if (!isResolved) {
              cleanupListeners();
              resolveOnce('failed');
            }
          });
        
        // 单层超时
        slotTimeoutId = setTimeout(() => {
          if (!checkSession() || currentAdSuccess || isResolved) return;
          
          console.warn(`⏱️ 单层广告加载超时（${SLOT_TIMEOUT}ms）`);
          cleanupListeners();
          resolveOnce('failed');
        }, SLOT_TIMEOUT);
      });
    };
    
    // 串行轮询广告位
    isAdLoading.value = true;
    
    while (true) {
      const result = await tryLoadAd();
      
      if (result === 'success') {
        // 广告成功，退出循环
        return;
      }
      
      if (result === 'session_expired') {
        // 会话过期，停止轮询
        console.log('会话已过期，停止轮询');
        isAdLoading.value = false;
        isAdReady.value = false;
        isProcessing = false;
        return;
      }
      
      // 检查是否已尝试所有轮次
      const maxSlots = config.slotIds.length * MAX_RETRY_ROUNDS;
      if (triedSlots >= maxSlots) {
        console.log(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试，暂无合适广告`);
        isAdLoading.value = false;
        isAdReady.value = false;
        isProcessing = false;
        showNoAdAvailable(reject);
        return;
      }
      
      // 继续尝试下一个广告位
      console.log('当前广告位失败，尝试下一个...');
    }
  };

  const showH5Ad = (resolve: (value: { ecpm: number; slotId: string }) => void, reject: (reason?: any) => void) => {
    isAdLoading.value = true;

    try {
      const selectedSlotId = getNextSlotId();
      console.log('选择的H5广告位:', selectedSlotId);
      
      const rewardVideoAd = window.baidu.mobads.RewardVideoAd({
        slotId: selectedSlotId,
        appId: config.appId,
        onAdLoaded: async () => {
          console.log('H5 广告加载成功');
          isAdReady.value = true;
          isAdLoading.value = false;
          
          // 检查广告是否就绪（未过期且缓存成功）
          console.log('🔍 检查 H5 广告就绪状态...');
          const isAdReadyToShow = rewardVideoAd.isReady ? rewardVideoAd.isReady() : true;
          console.log('📊 H5 广告就绪状态:', isAdReadyToShow);
          
          if (!isAdReadyToShow) {
            console.warn('⚠️ H5 广告未就绪（可能已过期或未缓存完成）');
            isAdReady.value = false;
            isProcessing = false;
            showNoAdAvailable(reject);
            return;
          }
          
          console.log('✅ H5 广告已就绪，准备播放');
          rewardVideoAd.show();
        },
        onAdFailed: (error: any) => {
          console.error('H5 广告加载失败:', error);
          isAdReady.value = false;
          isAdLoading.value = false;
          isProcessing = false;
          showNoAdAvailable(reject);
        },
        onAdShow: () => console.log('H5 广告开始播放'),
        onAdClose: () => {
          console.log('H5 广告关闭');
          isProcessing = false;
        },
        onAdReward: (reward: any) => {
          console.log('获得 H5 广告奖励:', reward);
          let ecpm = reward?.ecpm || reward?.amount || 0;
          
          if (selectedSlotId === '19188427') {
            console.log('H5 竞价位广告，使用模拟 ECPM');
            ecpm = generateSimulatedEcpm(selectedSlotId);
          } else if (ecpm === 0) {
            console.log('H5 保价位广告 ECPM 为 0，生成模拟 ECPM');
            ecpm = generateSimulatedEcpm(selectedSlotId);
          }
          
          isAdReady.value = false;
          isProcessing = false;
          if (ecpm > 0) {
            resolve({ ecpm, slotId: selectedSlotId });
          } else {
            showNoAdAvailable(reject);
          }
        },
        onAdClick: () => console.log('用户点击了 H5 广告')
      });

      rewardVideoAd.load();
    } catch (error) {
      console.error('H5 广告初始化失败:', error);
      isAdReady.value = false;
      isAdLoading.value = false;
      isProcessing = false;
      showNoAdAvailable(reject);
    }
  };

  const showNoAdAvailable = (reject: (reason?: any) => void) => {
    console.log('⚠️ 所有广告位都已尝试，暂无合适广告');
    lastError.value = '暂无合适广告匹配，请稍后重试';
    isAdLoading.value = false;
    isAdReady.value = false;
    isProcessing = false;
    currentResolve = null;
    currentReject = null;
    cleanupListeners();
    reject(new Error('暂无合适广告匹配'));
  };

  return {
    isLoaded,
    isAdSdkReady,
    isAdLoading,
    isAdReady,
    lastError,
    preloadAd,
    showRewardVideo,
    initializeAdSdk
  };
}
