import { ref, onMounted } from 'vue';

// 声明全局百度广告 SDK 类型
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

// 广告加载状态
const isLoaded = ref(false);
const isAdSdkReady = ref(false);
const isAdLoading = ref(false);

export function useAdManager(config: AdConfig) {
  // 初始化广告 SDK
  onMounted(() => {
    initializeAdSdk();
  });

  // 加载百度广告 SDK
  const initializeAdSdk = () => {
    if (typeof window === 'undefined') return;

    // 检查是否已经加载
    if (window.baidu && window.baidu.mobads) {
      console.log('百度广告 SDK 已加载');
      isAdSdkReady.value = true;
      isLoaded.value = true;
      return;
    }

    // 创建脚本标签加载百度广告 SDK
    const script = document.createElement('script');
    script.src = 'https://mobads.baidu.com/js/mobads.js';
    script.async = true;
    script.onload = () => {
      console.log('百度广告 SDK 加载成功');
      isAdSdkReady.value = true;
      isLoaded.value = true;
      
      // 初始化 SDK
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
  };

  // 显示激励视频广告
  const showRewardVideo = async (): Promise<{ ecpm: number }> => {
    return new Promise((resolve, reject) => {
      console.log('开始加载激励视频广告:', config.slotId);
      
      // 检查 SDK 是否准备就绪
      if (!isAdSdkReady.value || !window.baidu || !window.baidu.mobads) {
        console.warn('百度广告 SDK 未就绪，使用模拟数据');
        // 开发环境使用模拟数据
        simulateAdPlay(resolve, reject);
        return;
      }

      // 设置广告加载状态
      isAdLoading.value = true;

      // 创建激励视频广告实例
      const rewardVideoAd = window.baidu.mobads.RewardVideoAd({
        slotId: config.slotId,
        appId: config.appId,
        // 广告加载成功回调
        onAdLoaded: () => {
          console.log('激励视频广告加载成功');
          isAdLoading.value = false;
          // 显示广告
          rewardVideoAd.show();
        },
        // 广告加载失败回调
        onAdFailed: (error: any) => {
          console.error('激励视频广告加载失败:', error);
          isAdLoading.value = false;
          reject(new Error('广告加载失败: ' + (error?.message || '未知错误')));
        },
        // 广告展示回调
        onAdShow: () => {
          console.log('激励视频广告开始播放');
        },
        // 广告关闭回调
        onAdClose: () => {
          console.log('激励视频广告关闭');
        },
        // 广告奖励回调 - 用户观看完整视频后触发
        onAdReward: (reward: any) => {
          console.log('获得广告奖励:', reward);
          // 百度联盟返回的 ECPM 值
          const ecpm = reward?.ecpm || reward?.amount || 0;
          if (ecpm > 0) {
            resolve({ ecpm });
          } else {
            // 如果没有 ECPM，使用默认值
            resolve({ ecpm: Math.floor(Math.random() * 500) + 100 });
          }
        },
        // 广告点击回调
        onAdClick: () => {
          console.log('用户点击了广告');
        }
      });

      // 加载广告
      rewardVideoAd.load();
    });
  };

  // 模拟广告播放（用于开发测试）
  const simulateAdPlay = (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    console.log('使用模拟广告数据');
    // 模拟广告加载时间
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% 成功率
      if (success) {
        // 模拟 ECPM 值，范围在 100-600 之间
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
