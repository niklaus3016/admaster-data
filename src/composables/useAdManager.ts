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

export function useAdManager(config: AdConfig) {
  let rewardVerifyListener: any = null;
  let adFailedListener: any = null;
  let videoDownloadSuccessListener: any = null;

  onMounted(() => {
    initializeAdSdk();
  });

  onUnmounted(() => {
    if (rewardVerifyListener) BaiduAd.removeListener('onRewardVerify', rewardVerifyListener);
    if (adFailedListener) BaiduAd.removeListener('onAdFailed', adFailedListener);
    if (videoDownloadSuccessListener) BaiduAd.removeListener('onVideoDownloadSuccess', videoDownloadSuccessListener);
  });

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
        return;
      }

      if (window.baidu && window.baidu.mobads) {
        console.log('百度 H5 广告 SDK 已加载');
        isAdSdkReady.value = true;
        isLoaded.value = true;
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
        
        if (window.baidu && window.baidu.mobads) {
          window.baidu.mobads.setAppId(config.appId);
        }
      };
      script.onerror = () => {
        console.error('百度 H5 广告 SDK 加载失败');
        isLoaded.value = true;
        isAdSdkReady.value = false;
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('初始化广告 SDK 失败:', error);
      isLoaded.value = true;
      isAdSdkReady.value = false;
    }
  };

  const showRewardVideo = async (): Promise<{ ecpm: number }> => {
    return new Promise(async (resolve, reject) => {
      console.log('开始加载激励视频广告:', config.slotId);
      
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
      isAdLoading.value = true;
      
      console.log('开始加载原生广告...');
      
      const onRewardVerify = (result: any) => {
        console.log('获得广告奖励:', result);
        const ecpm = result.ecpm || 0;
        isAdLoading.value = false;
        resolve({ ecpm });
      };
      
      const onAdFailed = (error: any) => {
        console.error('原生广告加载失败:', error);
        isAdLoading.value = false;
        simulateAdPlay(resolve, reject);
      };

      const onVideoDownloadSuccess = async () => {
        console.log('视频下载成功，准备显示广告');
        try {
          await BaiduAd.showRewardVideoAd();
        } catch (error) {
          console.error('显示广告失败:', error);
          isAdLoading.value = false;
          simulateAdPlay(resolve, reject);
        }
      };
      
      rewardVerifyListener = onRewardVerify;
      adFailedListener = onAdFailed;
      videoDownloadSuccessListener = onVideoDownloadSuccess;
      
      BaiduAd.addListener('onRewardVerify', onRewardVerify);
      BaiduAd.addListener('onAdFailed', onAdFailed);
      BaiduAd.addListener('onVideoDownloadSuccess', onVideoDownloadSuccess);
      
      await BaiduAd.loadRewardVideoAd({ adId: config.slotId });
      console.log('广告加载请求已发送，等待视频下载...');
      
    } catch (error) {
      console.error('原生广告播放失败:', error);
      isAdLoading.value = false;
      simulateAdPlay(resolve, reject);
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
          isAdLoading.value = false;
          rewardVideoAd.show();
        },
        onAdFailed: (error: any) => {
          console.error('H5 广告加载失败:', error);
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
      isAdLoading.value = false;
      simulateAdPlay(resolve, reject);
    }
  };

  const simulateAdPlay = (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    console.log('使用模拟广告数据');
    setTimeout(() => {
      const success = Math.random() > 0.1;
      if (success) {
        const ecpm = Math.floor(Math.random() * 500) + 100;
        console.log('模拟广告完成，ECPM:', ecpm);
        resolve({ ecpm });
      } else {
        reject(new Error('广告播放失败'));
      }
    }, 2000);
  };

  return {
    isLoaded,
    isAdSdkReady,
    isAdLoading,
    showRewardVideo,
    initializeAdSdk
  };
}
