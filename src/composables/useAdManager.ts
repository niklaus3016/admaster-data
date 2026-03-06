import { ref, onMounted } from 'vue';

// 声明全局类型
declare global {
  interface Window {
    baidu?: any;
    _baidu?: any;
    // Capacitor 原生插件
    RewardVideoAd?: {
      loadAd: (options: { adId: string }) => Promise<void>;
      showAd: () => Promise<{ ecpm: number }>;
    };
  }
}

interface AdConfig {
  appId: string;
  slotId: string;
}

// 广告加载状态
const isLoaded = ref(false);
const isAdSdkReady = ref(false);
const isAdLoading = ref(false);

export function useAdManager(config: AdConfig) {
  // 初始化广告 SDK
  onMounted(() => {
    initializeAdSdk();
  });

  // 检测是否在原生 APP 环境中
  const isNativeApp = () => {
    return typeof window !== 'undefined' && 
           (window as any).Capacitor !== undefined;
  };

  // 加载广告SDK
  const initializeAdSdk = () => {
    if (typeof window === 'undefined') return;

    // 检查是否有原生广告插件（Capacitor 插件）
    if (window.RewardVideoAd) {
      console.log('原生广告插件已就绪');
      isAdSdkReady.value = true;
      isLoaded.value = true;
      return;
    }

    // 检查是否已经加载百度 H5 SDK
    if (window.baidu && window.baidu.mobads) {
      console.log('百度广告 SDK 已加载');
      isAdSdkReady.value = true;
      isLoaded.value = true;
      return;
    }

    // 在 Web 环境中尝试加载百度 H5 SDK
    if (!isNativeApp()) {
      console.log('尝试加载百度 H5 广告 SDK');
      const script = document.createElement('script');
      script.src = 'https://mobads.baidu.com/js/mobads.js';
      script.async = true;
      script.onload = () => {
        console.log('百度广告 SDK 加载成功');
        isAdSdkReady.value = true;
        isLoaded.value = true;
        
        if (window.baidu && window.baidu.mobads) {
          window.baidu.mobads.setAppId(config.appId);
        }
      };
      script.onerror = () => {
        console.error('百度广告 SDK 加载失败');
        isLoaded.value = true;
        isAdSdkReady.value = false;
      };
      document.head.appendChild(script);
    } else {
      console.log('原生 APP 环境，等待原生插件加载');
      isLoaded.value = true;
      isAdSdkReady.value = false;
    }
  };

  // 显示激励视频广告
  const showRewardVideo = async (): Promise<{ ecpm: number }> => {
    return new Promise((resolve, reject) => {
      console.log('开始加载激励视频广告:', config.slotId);
      console.log('SDK 状态:', { isAdSdkReady: isAdSdkReady.value, hasNative: !!window.RewardVideoAd });
      
      // 检查是否有原生广告插件
      if (window.RewardVideoAd) {
        console.log('使用原生广告插件');
        showNativeAd(resolve, reject);
        return;
      }
      
      // 检查 H5 SDK 是否准备就绪
      if (!isAdSdkReady.value || !window.baidu || !window.baidu.mobads) {
        console.warn('广告 SDK 未就绪，使用模拟数据');
        simulateAdPlay(resolve, reject);
        return;
      }

      // 使用 H5 广告 SDK
      showH5Ad(resolve, reject);
    });
  };

  // 显示原生广告（Capacitor 插件）
  const showNativeAd = async (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    try {
      isAdLoading.value = true;
      
      // 加载广告
      await window.RewardVideoAd!.loadAd({ adId: config.slotId });
      
      // 显示广告并获取奖励
      const result = await window.RewardVideoAd!.showAd();
      
      console.log('原生广告完成，ECPM:', result.ecpm);
      isAdLoading.value = false;
      resolve({ ecpm: result.ecpm });
    } catch (error) {
      console.error('原生广告播放失败:', error);
      isAdLoading.value = false;
      reject(error);
    }
  };

  // 显示 H5 广告
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
          // 失败后使用模拟数据
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

  // 模拟广告播放（用于开发测试或 SDK 失败时）
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
