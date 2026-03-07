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
  slotId: string;
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
  let timeoutId: any = null;
  let retryTimeoutId: any = null;
  let currentResolve: any = null;
  let currentReject: any = null;

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
      console.log('========== 开始加载激励视频广告 ==========');
      console.log('广告位 ID:', config.slotId);
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
          console.error('百度 H5 广告 SDK 未就绪');
          reject(new Error('广告 SDK 未就绪'));
          return;
        }

        await showH5Ad(resolve, reject);
      } catch (error) {
        console.error('显示广告失败:', error);
        reject(error);
      }
    });
  };

  const showNativeAd = async (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    try {
      isAdLoading.value = true;
      lastError.value = '';
      
      console.log('开始加载原生广告...');
      
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
        const ecpm = result.ecpm || 0;
        isAdLoading.value = false;
        isAdReady.value = false;
        cleanupListeners();
        
        // 只有当 ECPM > 0 时才认为广告成功
        if (ecpm > 0) {
          resolve({ ecpm });
        } else {
          reject(new Error('广告 ECPM 为 0，无法获得金币'));
        }
      };
      
      const onAdFailed = (error: any) => {
        const errorMsg = error?.error || error || '未知错误';
        console.warn('⚠️ 广告加载失败:', errorMsg);
        lastError.value = '广告加载失败: ' + errorMsg;
        
        if (timeoutId) clearTimeout(timeoutId);
        isAdLoading.value = false;
        isAdReady.value = false;
        cleanupListeners();
        
        reject(new Error('广告加载失败: ' + errorMsg));
      };

      const onVideoDownloadSuccess = async () => {
        console.log('✅ 视频下载成功，准备显示广告');
        try {
          isAdReady.value = true;
          isAdLoading.value = false;
          await BaiduAd.showRewardVideoAd();
          console.log('✅ 广告显示命令已发送');
        } catch (error) {
          const errorMsg = error?.message || error || '未知错误';
          console.warn('⚠️ 显示广告时遇到问题，但广告可能会继续加载:', errorMsg);
          // 不要清理监听器，因为广告可能会继续加载并显示
          // 只有当明确的错误发生时才清理监听器
        }
      };

      const onVideoDownloadFailed = () => {
        console.warn('⚠️ 视频下载失败');
        lastError.value = '视频下载失败，可能是广告填充不足';
        
        if (timeoutId) clearTimeout(timeoutId);
        isAdLoading.value = false;
        isAdReady.value = false;
        cleanupListeners();
        
        reject(new Error('视频下载失败'));
      };
      
      adLoadedListener = onAdLoaded;
      rewardVerifyListener = onRewardVerify;
      adFailedListener = onAdFailed;
      videoDownloadSuccessListener = onVideoDownloadSuccess;
      videoDownloadFailedListener = onVideoDownloadFailed;
      
      BaiduAd.addListener('onAdLoaded', onAdLoaded);
      BaiduAd.addListener('onRewardVerify', onRewardVerify);
      BaiduAd.addListener('onAdFailed', onAdFailed);
      BaiduAd.addListener('onVideoDownloadSuccess', onVideoDownloadSuccess);
      BaiduAd.addListener('onVideoDownloadFailed', onVideoDownloadFailed);
      
      console.log('调用 loadRewardVideoAd...');
      await BaiduAd.loadRewardVideoAd({ adId: config.slotId });
      console.log('✅ 广告加载请求已发送，等待回调...');
      
      timeoutId = setTimeout(() => {
        console.warn('⏱️ 广告加载超时（30秒）');
        lastError.value = '广告加载超时，可能是网络问题或广告填充不足';
        
        if (retryTimeoutId) clearTimeout(retryTimeoutId);
        isAdReady.value = false;
        isAdLoading.value = false;
        cleanupListeners();
        reject(new Error('广告加载超时'));
      }, 30000);
      
    } catch (error) {
      const errorMsg = error?.message || error || '未知错误';
      console.error('❌ 原生广告播放失败:', errorMsg);
      lastError.value = '广告播放失败: ' + errorMsg;
      if (timeoutId) clearTimeout(timeoutId);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      isAdReady.value = false;
      isAdLoading.value = false;
      cleanupListeners();
      reject(new Error('广告播放失败: ' + errorMsg));
    }
  };

  const showH5Ad = (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    isAdLoading.value = true;

    try {
      const rewardVideoAd = window.baidu.mobads.RewardVideoAd({
        slotId: config.slotId,
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
          reject(new Error('H5 广告加载失败'));
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
          isAdLoading.value = false;
          
          // 只有当 ECPM > 0 时才认为广告成功
          if (ecpm > 0) {
            resolve({ ecpm });
          } else {
            reject(new Error('广告 ECPM 为 0，无法获得金币'));
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
      reject(new Error('H5 广告初始化失败'));
    }
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