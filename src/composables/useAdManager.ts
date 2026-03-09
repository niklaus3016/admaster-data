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
  let adSuccess = false;
  let triedSlots = 0;
  let slotTimeoutId: any = null;
  let currentSessionId = 0; // 当前会话ID，用于区分不同的广告请求
  const MAX_RETRY_ROUNDS = 2;
  const SLOT_TIMEOUT = 3000;
  
  const generateSimulatedEcpm = (slotId: string): number => {
    const ecpmRanges: { [key: string]: [number, number] } = {
      '19188423': [400, 500],
      '19188422': [200, 300],
      '19188421': [100, 150],
      '19183768': [80, 100],
      '19188420': [50, 80],
      '19188419': [50, 80],
      '19188418': [30, 50],
      '19188417': [20, 30],
      '19181348': [1, 20]
    };
    
    const range = ecpmRanges[slotId];
    if (!range) {
      return 0;
    }
    
    const min = range[0];
    const max = range[1];
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  const getNextSlotId = (): string => {
    if (!config.slotIds || config.slotIds.length === 0) {
      throw new Error('广告位配置为空');
    }
    const slotId = config.slotIds[currentSlotIndex];
    const currentRound = Math.floor(triedSlots / config.slotIds.length) + 1;
    const positionInRound = (triedSlots % config.slotIds.length) + 1;
    console.log(`当前轮询广告位: ${slotId} (第${currentRound}轮 ${positionInRound}/${config.slotIds.length})`);
    currentSlotIndex = (currentSlotIndex + 1) % config.slotIds.length;
    triedSlots++;
    return slotId;
  };
  
  const resetAdState = () => {
    adSuccess = false;
    currentSlotIndex = 0;
    triedSlots = 0;
    isAdLoading.value = false;
    isAdReady.value = false;
    currentSessionId++; // 增加会话ID，标记新的广告请求
    console.log(`🆕 新会话开始，会话ID: ${currentSessionId}`);
  };

  onMounted(() => {
    initializeAdSdk();
  });

  onUnmounted(() => {
    cleanupListeners();
  });

  const cleanupListeners = () => {
    console.log('🔄 清理广告监听器...');
    
    if (rewardVerifyListener) {
      try {
        BaiduAd.removeListener('onRewardVerify', rewardVerifyListener);
        rewardVerifyListener = null;
      } catch (e) {
        console.warn('移除 onRewardVerify 监听器失败:', e);
      }
    }
    
    if (adFailedListener) {
      try {
        BaiduAd.removeListener('onAdFailed', adFailedListener);
        adFailedListener = null;
      } catch (e) {
        console.warn('移除 onAdFailed 监听器失败:', e);
      }
    }
    
    if (videoDownloadSuccessListener) {
      try {
        BaiduAd.removeListener('onVideoDownloadSuccess', videoDownloadSuccessListener);
        videoDownloadSuccessListener = null;
      } catch (e) {
        console.warn('移除 onVideoDownloadSuccess 监听器失败:', e);
      }
    }
    
    if (videoDownloadFailedListener) {
      try {
        BaiduAd.removeListener('onVideoDownloadFailed', videoDownloadFailedListener);
        videoDownloadFailedListener = null;
      } catch (e) {
        console.warn('移除 onVideoDownloadFailed 监听器失败:', e);
      }
    }
    
    if (adLoadedListener) {
      try {
        BaiduAd.removeListener('onAdLoaded', adLoadedListener);
        adLoadedListener = null;
      } catch (e) {
        console.warn('移除 onAdLoaded 监听器失败:', e);
      }
    }
    
    if (adCloseListener) {
      try {
        BaiduAd.removeListener('onAdClose', adCloseListener);
        adCloseListener = null;
      } catch (e) {
        console.warn('移除 onAdClose 监听器失败:', e);
      }
    }
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    if (retryTimeoutId) {
      clearTimeout(retryTimeoutId);
      retryTimeoutId = null;
    }
    
    if (slotTimeoutId) {
      clearTimeout(slotTimeoutId);
      slotTimeoutId = null;
    }
    
    console.log('✅ 监听器清理完成');
  };

  const isNativeApp = () => {
    return typeof window !== 'undefined' && 
           (window as any).Capacitor !== undefined &&
           (window as any).Capacitor.getPlatform() === 'android';
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

      if (window.baidu && window.baidu.mobads) {
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
        
        if (window.baidu && window.baidu.mobads) {
          window.baidu.mobads.setAppId(config.appId);
        }
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

  const showRewardVideo = async (): Promise<{ ecpm: number }> => {
    return new Promise(async (resolve, reject) => {
      // 完全重置状态
      resetAdState();
      currentResolve = null;
      currentReject = null;
      
      console.log('========== 开始加载激励视频广告 ==========');
      console.log('所有广告位:', config.slotIds);
      console.log('是否原生环境:', isNativeApp());
      console.log('广告是否已准备:', isAdReady.value);
      
      currentResolve = resolve;
      currentReject = reject;
      
      try {
        if (isNativeApp()) {
          console.log('使用百度原生广告插件');
          await showNativeAd(resolve, reject);
          return;
        }

        if (!isAdSdkReady.value || !window.baidu || !window.baidu.mobads) {
          console.warn('百度 H5 广告 SDK 未就绪');
          showNoAdAvailable(reject);
          return;
        }

        await showH5Ad(resolve, reject);
      } catch (error) {
        console.error('显示广告失败:', error);
        showNoAdAvailable(reject);
      } finally {
        if (!adSuccess) {
          isAdLoading.value = false;
          isAdReady.value = false;
        }
      }
    });
  };

  const showNativeAd = async (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    // 保存当前会话ID，用于验证回调是否属于当前会话
    const sessionId = currentSessionId;
    
    try {
      // 清理之前的所有监听器和定时器
      cleanupListeners();
      
      // 重置所有监听器变量
      adLoadedListener = null;
      rewardVerifyListener = null;
      adFailedListener = null;
      videoDownloadSuccessListener = null;
      videoDownloadFailedListener = null;
      adCloseListener = null;
      
      isAdLoading.value = true;
      lastError.value = '';
      
      console.log('开始加载原生广告...');
      
      const selectedSlotId = getNextSlotId();
      console.log('选择的广告位:', selectedSlotId);
      
      // 检查会话ID是否匹配，如果不匹配说明有新的广告请求
      const checkSession = () => {
        if (sessionId !== currentSessionId) {
          console.log(`会话ID不匹配，当前: ${currentSessionId}, 回调: ${sessionId}，忽略此回调`);
          return false;
        }
        return true;
      };
      
      const onAdLoaded = () => {
        if (!checkSession()) return;
        console.log('✅ 广告加载成功回调');
      };

      const onRewardVerify = (result: any) => {
        if (!checkSession()) return;
        
        console.log('========== 广告奖励回调 ==========');
        console.log('完整结果对象:', result);
        console.log('rewardVerify:', result.rewardVerify);
        console.log('ecpm:', result.ecpm);
        console.log('===================================');
        
        if (slotTimeoutId) clearTimeout(slotTimeoutId);
        
        let ecpm = result.ecpm || 0;
        
        const currentSlotId = config.slotIds[(currentSlotIndex - 1 + config.slotIds.length) % config.slotIds.length];
        
        if (currentSlotId !== '19188426' && ecpm === 0) {
          console.log('保价位广告，生成模拟 ECPM');
          ecpm = generateSimulatedEcpm(currentSlotId);
        }
        
        isAdLoading.value = false;
        isAdReady.value = false;
        adSuccess = true;
        
        console.log('✅ 广告奖励回调，清理所有监听器');
        cleanupListeners();
        
        console.log('✅ 广告成功，返回 ECPM:', ecpm);
        resolve({ ecpm });
        
        currentResolve = null;
        currentReject = null;
      };
      
      const onAdFailed = (error: any) => {
        if (!checkSession()) return;
        
        const errorMsg = error?.error || error || '未知错误';
        console.warn('⚠️ 广告加载失败:', errorMsg);
        lastError.value = '广告加载失败: ' + errorMsg;
        
        if (slotTimeoutId) clearTimeout(slotTimeoutId);
        
        if (adSuccess) {
          console.log('广告已成功，不再重试');
          return;
        }
        
        const maxSlots = config.slotIds.length * MAX_RETRY_ROUNDS;
        if (triedSlots >= maxSlots) {
          console.log(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试，暂无合适广告`);
          isAdReady.value = false;
          isAdLoading.value = false;
          showNoAdAvailable(reject);
          return;
        }
        
        console.log('立即尝试下一个广告位...');
        
        if (adSuccess) {
          console.log('广告已成功，取消重试');
          return;
        }
        
        if (triedSlots >= maxSlots) {
          console.log(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试，暂无合适广告`);
          isAdReady.value = false;
          isAdLoading.value = false;
          showNoAdAvailable(reject);
          return;
        }
        
        console.log('尝试下一个广告位...');
        isAdReady.value = false;
        isAdLoading.value = false;
        cleanupListeners();
        
        if (currentResolve && currentReject) {
          showNativeAd(currentResolve, currentReject);
        }
      };

      const onVideoDownloadSuccess = async () => {
        if (!checkSession()) return;
        
        console.log('✅ 视频下载成功，准备显示广告');
        try {
          if (adSuccess) {
            console.log('广告已成功，忽略重复的视频下载成功回调');
            cleanupListeners();
            return;
          }
          
          adSuccess = true;
          
          if (slotTimeoutId) {
            clearTimeout(slotTimeoutId);
            console.log('✅ 清除单层超时定时器');
          }
          
          isAdReady.value = true;
          isAdLoading.value = false;
          
          console.log('✅ 广告位加载成功，准备播放');
          await BaiduAd.showRewardVideoAd();
          console.log('✅ 广告显示命令已发送');
        } catch (error) {
          const errorMsg = error?.message || error || '未知错误';
          console.error('❌ 显示广告失败:', errorMsg);
          lastError.value = '显示广告失败: ' + errorMsg;
          
          // 广告显示失败，重置adSuccess，允许重试
          adSuccess = false;
          
          if (timeoutId) clearTimeout(timeoutId);
          if (retryTimeoutId) clearTimeout(retryTimeoutId);
          if (slotTimeoutId) clearTimeout(slotTimeoutId);
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          
          // 检查是否还可以重试
          const maxSlots = config.slotIds.length * MAX_RETRY_ROUNDS;
          if (triedSlots >= maxSlots) {
            console.log(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试，暂无合适广告`);
            showNoAdAvailable(reject);
            return;
          }
          
          // 继续轮询下一个广告位
          console.log('广告显示失败，尝试下一个广告位...');
          if (currentResolve && currentReject) {
            showNativeAd(currentResolve, currentReject);
          }
        }
      };

      const onVideoDownloadFailed = () => {
        if (!checkSession()) return;
        
        console.warn('⚠️ 视频下载失败');
        lastError.value = '视频下载失败，可能是广告填充不足';
        
        if (slotTimeoutId) clearTimeout(slotTimeoutId);
        
        if (adSuccess) {
          console.log('广告已成功，不再重试');
          return;
        }
        
        const maxSlots = config.slotIds.length * MAX_RETRY_ROUNDS;
        if (triedSlots >= maxSlots) {
          console.log(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试，暂无合适广告`);
          isAdReady.value = false;
          isAdLoading.value = false;
          showNoAdAvailable(reject);
          return;
        }
        
        console.log('立即尝试下一个广告位...');
        
        if (adSuccess) {
          console.log('广告已成功，取消重试');
          return;
        }
        
        if (triedSlots >= maxSlots) {
          console.log(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试，暂无合适广告`);
          isAdReady.value = false;
          isAdLoading.value = false;
          showNoAdAvailable(reject);
          return;
        }
        
        console.log('尝试下一个广告位...');
        isAdReady.value = false;
        isAdLoading.value = false;
        cleanupListeners();
        
        if (currentResolve && currentReject) {
          showNativeAd(currentResolve, currentReject);
        }
      };
      
      const onAdClose = () => {
        if (!checkSession()) return;
        
        console.log('✅ 广告关闭回调');
        if (timeoutId) clearTimeout(timeoutId);
        if (retryTimeoutId) clearTimeout(retryTimeoutId);
        if (slotTimeoutId) clearTimeout(slotTimeoutId);
        isAdReady.value = false;
        isAdLoading.value = false;
        console.log('✅ 广告关闭，清理监听器');
        cleanupListeners();
        
        console.log('广告关闭，重置状态');
        currentResolve = null;
        currentReject = null;
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
      
      console.log('调用 loadRewardVideoAd...');
      await BaiduAd.loadRewardVideoAd({ adId: selectedSlotId });
      console.log('✅ 广告加载请求已发送，等待回调...');
      
      slotTimeoutId = setTimeout(() => {
        if (!checkSession()) return;
        
        if (adSuccess) {
          console.log('广告已成功，取消单层超时处理');
          return;
        }
        
        console.warn(`⏱️ 单层广告加载超时（${SLOT_TIMEOUT}ms），尝试下一个广告位`);
        
        const maxSlots = config.slotIds.length * MAX_RETRY_ROUNDS;
        if (triedSlots >= maxSlots) {
          console.warn(`所有${MAX_RETRY_ROUNDS}轮广告位都已尝试，暂无合适广告`);
          isAdReady.value = false;
          isAdLoading.value = false;
          showNoAdAvailable(reject);
          return;
        }
        
        cleanupListeners();
        
        if (currentResolve && currentReject) {
          showNativeAd(currentResolve, currentReject);
        }
      }, SLOT_TIMEOUT);
      
    } catch (error) {
      const errorMsg = error?.message || error || '未知错误';
      console.error('❌ 原生广告播放失败:', errorMsg);
      lastError.value = '广告播放失败: ' + errorMsg;
      if (timeoutId) clearTimeout(timeoutId);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      isAdReady.value = false;
      isAdLoading.value = false;
      showNoAdAvailable(reject);
    }
  };

  const showH5Ad = (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    isAdLoading.value = true;

    try {
      const selectedSlotId = getNextSlotId();
      console.log('选择的H5广告位:', selectedSlotId);
      
      const rewardVideoAd = window.baidu.mobads.RewardVideoAd({
        slotId: selectedSlotId,
        appId: config.appId,
        onAdLoaded: () => {
          console.log('H5 广告加载成功');
          isAdReady.value = true;
          isAdLoading.value = false;
          rewardVideoAd.show();
        },
        onAdFailed: (error: any) => {
          console.error('H5 广告加载失败:', error);
          isAdReady.value = false;
          isAdLoading.value = false;
          showNoAdAvailable(reject);
        },
        onAdShow: () => {
          console.log('H5 广告开始播放');
        },
        onAdClose: () => {
          console.log('H5 广告关闭');
        },
        onAdReward: (reward: any) => {
          console.log('获得 H5 广告奖励:', reward);
          const ecpm = reward?.ecpm || reward?.amount || 0;
          isAdReady.value = false;
          if (ecpm > 0) {
            resolve({ ecpm });
          } else {
            showNoAdAvailable(reject);
          }
        },
        onAdClick: () => {
          console.log('用户点击了 H5 广告');
        }
      });

      rewardVideoAd.load();
    } catch (error) {
      console.error('H5 广告初始化失败:', error);
      isAdReady.value = false;
      isAdLoading.value = false;
      showNoAdAvailable(reject);
    }
  };

  const showNoAdAvailable = (reject: (reason?: any) => void) => {
    console.log('⚠️ 所有广告位都已尝试，暂无合适广告');
    lastError.value = '暂无合适广告匹配，请稍后重试';
    isAdLoading.value = false;
    isAdReady.value = false;
    adSuccess = false;
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
