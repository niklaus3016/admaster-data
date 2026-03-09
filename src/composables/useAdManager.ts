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
  let currentSlotIndex = 0; // 当前广告位索引
  let adSuccess = false; // 广告是否已成功
  let triedSlots = 0; // 已经尝试过的广告位数量
  
  // 获取下一个广告位（轮询模式）
  const getNextSlotId = (): string => {
    if (!config.slotIds || config.slotIds.length === 0) {
      throw new Error('广告位配置为空');
    }
    const slotId = config.slotIds[currentSlotIndex];
    console.log(`当前轮询广告位: ${slotId} (${currentSlotIndex + 1}/${config.slotIds.length})`);
    // 递增索引，循环使用
    currentSlotIndex = (currentSlotIndex + 1) % config.slotIds.length;
    triedSlots++;
    return slotId;
  };
  
  // 重置广告状态
  const resetAdState = () => {
    adSuccess = false;
    currentSlotIndex = 0;
    triedSlots = 0;
  };

  onMounted(() => {
    initializeAdSdk();
  });

  onUnmounted(() => {
    cleanupListeners();
  });

  const cleanupListeners = () => {
    if (rewardVerifyListener) BaiduAd.removeListener('onRewardVerify', rewardVerifyListener);
    if (adFailedListener) BaiduAd.removeListener('onAdFailed', adFailedListener);
    if (videoDownloadSuccessListener) BaiduAd.removeListener('onVideoDownloadSuccess', videoDownloadSuccessListener);
    if (videoDownloadFailedListener) BaiduAd.removeListener('onVideoDownloadFailed', videoDownloadFailedListener);
    if (adLoadedListener) BaiduAd.removeListener('onAdLoaded', adLoadedListener);
    if (adCloseListener) BaiduAd.removeListener('onAdClose', adCloseListener);
    if (timeoutId) clearTimeout(timeoutId);
    if (retryTimeoutId) clearTimeout(retryTimeoutId);
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
      // 重置广告状态
      resetAdState();
      
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
          console.warn('百度 H5 广告 SDK 未就绪，使用模拟数据');
          simulateAdPlay(resolve, reject);
          return;
        }

        await showH5Ad(resolve, reject);
      } catch (error) {
        console.error('显示广告失败:', error);
        simulateAdPlay(resolve, reject);
      }
    });
  };

  const showNativeAd = async (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    try {
      // 清理之前的所有监听器和定时器
      cleanupListeners();
      
      isAdLoading.value = true;
      lastError.value = '';
      
      console.log('开始加载原生广告...');
      
      // 获取下一个广告位
      const selectedSlotId = getNextSlotId();
      console.log('选择的广告位:', selectedSlotId);
      
      const onAdLoaded = () => {
        console.log('✅ 广告加载成功回调');
      };

      const onRewardVerify = (result: any) => {
        console.log('========== 广告奖励回调 ==========');
        console.log('完整结果对象:', result);
        console.log('rewardVerify:', result.rewardVerify);
        console.log('ecpm:', result.ecpm);
        console.log('所有属性:');
        for (const key in result) {
          console.log(`  ${key}:`, result[key]);
        }
        console.log('===================================');
        
        if (timeoutId) clearTimeout(timeoutId);
        if (retryTimeoutId) clearTimeout(retryTimeoutId);
        const ecpm = result.ecpm || 0;
        isAdLoading.value = false;
        isAdReady.value = false;
        adSuccess = true; // 标记广告成功
        cleanupListeners();
        
        // 只有当 resolve 函数还存在时才调用，避免超时后重复处理
        if (resolve) {
          resolve({ ecpm });
        }
      };
      
      const onAdFailed = (error: any) => {
        const errorMsg = error?.error || error || '未知错误';
        console.warn('⚠️ 广告加载失败:', errorMsg);
        lastError.value = '广告加载失败: ' + errorMsg;
        
        if (timeoutId) clearTimeout(timeoutId);
        
        // 如果广告已经成功，不再重试
        if (adSuccess) {
          console.log('广告已成功，不再重试');
          return;
        }
        
        // 检查是否已经尝试了所有广告位
        if (triedSlots >= config.slotIds.length) {
          console.log('所有广告位都已尝试，使用模拟数据');
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          simulateAdPlay(resolve, reject);
          return;
        }
        
        console.log('立即尝试下一个广告位...');
        retryTimeoutId = setTimeout(() => {
          // 再次检查广告是否已成功
          if (adSuccess) {
            console.log('广告已成功，取消重试');
            return;
          }
          
          // 再次检查是否已经尝试了所有广告位
          if (triedSlots >= config.slotIds.length) {
            console.log('所有广告位都已尝试，使用模拟数据');
            isAdReady.value = false;
            isAdLoading.value = false;
            cleanupListeners();
            simulateAdPlay(resolve, reject);
            return;
          }
          
          console.log('尝试下一个广告位...');
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          
          if (currentResolve && currentReject) {
            showNativeAd(currentResolve, currentReject);
          }
        }, 0);
        
        return;
      };

      const onVideoDownloadSuccess = async () => {
        console.log('✅ 视频下载成功，准备显示广告');
        try {
          isAdReady.value = true;
          isAdLoading.value = false;
          // 广告已成功加载，清除超时定时器
          if (timeoutId) {
            clearTimeout(timeoutId);
            console.log('✅ 广告已成功加载，清除超时定时器');
          }
          if (retryTimeoutId) {
            clearTimeout(retryTimeoutId);
            console.log('✅ 清除重试定时器');
          }
          console.log('✅ 广告位加载成功，准备播放');
          await BaiduAd.showRewardVideoAd();
          console.log('✅ 广告显示命令已发送');
        } catch (error) {
          const errorMsg = error?.message || error || '未知错误';
          console.error('❌ 显示广告失败:', errorMsg);
          lastError.value = '显示广告失败: ' + errorMsg;
          if (timeoutId) clearTimeout(timeoutId);
          if (retryTimeoutId) clearTimeout(retryTimeoutId);
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          simulateAdPlay(resolve, reject);
        }
      };

      const onVideoDownloadFailed = () => {
        console.warn('⚠️ 视频下载失败');
        lastError.value = '视频下载失败，可能是广告填充不足';
        
        if (timeoutId) clearTimeout(timeoutId);
        
        // 如果广告已经成功，不再重试
        if (adSuccess) {
          console.log('广告已成功，不再重试');
          return;
        }
        
        // 检查是否已经尝试了所有广告位
        if (triedSlots >= config.slotIds.length) {
          console.log('所有广告位都已尝试，使用模拟数据');
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          simulateAdPlay(resolve, reject);
          return;
        }
        
        console.log('立即尝试下一个广告位...');
        retryTimeoutId = setTimeout(() => {
          // 再次检查广告是否已成功
          if (adSuccess) {
            console.log('广告已成功，取消重试');
            return;
          }
          
          // 再次检查是否已经尝试了所有广告位
          if (triedSlots >= config.slotIds.length) {
            console.log('所有广告位都已尝试，使用模拟数据');
            isAdReady.value = false;
            isAdLoading.value = false;
            cleanupListeners();
            simulateAdPlay(resolve, reject);
            return;
          }
          
          console.log('尝试下一个广告位...');
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          
          if (currentResolve && currentReject) {
            showNativeAd(currentResolve, currentReject);
          }
        }, 0);
        
        return;
      };
      
      const onAdClose = () => {
        console.log('✅ 广告关闭回调');
        if (timeoutId) clearTimeout(timeoutId);
        if (retryTimeoutId) clearTimeout(retryTimeoutId);
        isAdReady.value = false;
        isAdLoading.value = false;
        cleanupListeners();
      };
      
      adLoadedListener = onAdLoaded;
      rewardVerifyListener = onRewardVerify;
      adFailedListener = onAdFailed;
      videoDownloadSuccessListener = onVideoDownloadSuccess;
      videoDownloadFailedListener = onVideoDownloadFailed;
      let adCloseListener = onAdClose;
      
      BaiduAd.addListener('onAdLoaded', onAdLoaded);
      BaiduAd.addListener('onRewardVerify', onRewardVerify);
      BaiduAd.addListener('onAdFailed', onAdFailed);
      BaiduAd.addListener('onVideoDownloadSuccess', onVideoDownloadSuccess);
      BaiduAd.addListener('onVideoDownloadFailed', onVideoDownloadFailed);
      BaiduAd.addListener('onAdClose', onAdClose);
      
      console.log('调用 loadRewardVideoAd...');
      await BaiduAd.loadRewardVideoAd({ adId: selectedSlotId });
      console.log('✅ 广告加载请求已发送，等待回调...');
      
      timeoutId = setTimeout(() => {
        // 如果广告已经成功，不再使用模拟数据
        if (adSuccess) {
          console.log('广告已成功，取消超时处理');
          return;
        }
        
        // 检查是否已经尝试了所有广告位
        if (triedSlots >= config.slotIds.length) {
          console.warn('⏱️ 广告加载超时（15秒），所有广告位都已尝试，使用模拟数据');
          lastError.value = '广告加载超时，可能是网络问题或广告填充不足';
          
          if (retryTimeoutId) clearTimeout(retryTimeoutId);
          isAdReady.value = false;
          isAdLoading.value = false;
          cleanupListeners();
          simulateAdPlay(resolve, reject);
        } else {
          console.log('广告加载超时（15秒），但还有广告位未尝试，继续轮询');
        }
      }, 15000);
      
    } catch (error) {
      const errorMsg = error?.message || error || '未知错误';
      console.error('❌ 原生广告播放失败:', errorMsg);
      lastError.value = '广告播放失败: ' + errorMsg;
      if (timeoutId) clearTimeout(timeoutId);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      isAdReady.value = false;
      isAdLoading.value = false;
      cleanupListeners();
      simulateAdPlay(resolve, reject);
    }
  };

  const showH5Ad = (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    isAdLoading.value = true;

    try {
      // 获取下一个广告位
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
          simulateAdPlay(resolve, reject);
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
            resolve({ ecpm: Math.floor(Math.random() * 500) + 100 });
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
      simulateAdPlay(resolve, reject);
    }
  };

  const simulateAdPlay = (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    console.log('⚠️ 使用模拟广告数据');
    setTimeout(() => {
      const success = Math.random() > 0.1;
      if (success) {
        const ecpm = Math.floor(Math.random() * 500) + 100;
        console.log('模拟广告完成，ECPM:', ecpm);
        // 使用模拟数据后清理监听器
        cleanupListeners();
        resolve({ ecpm });
      } else {
        // 失败时也清理监听器
        cleanupListeners();
        reject(new Error('广告播放失败'));
      }
    }, 2000);
  };

  return {
    isLoaded,
    isAdSdkReady,
    isAdLoading,
    isAdReady,
    lastError,
    showRewardVideo,
    initializeAdSdk
  };
}
