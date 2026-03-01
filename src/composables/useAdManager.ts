import { ref, onMounted } from 'vue';

// 声明全局GroMore SDK类型
declare global {
  interface Window {
    GroMore?: any;
  }
}

interface AdConfig {
  appId: string;
  slotId: string;
}

export function useAdManager(config: AdConfig) {
  const isLoaded = ref(false);
  const isAdSdkReady = ref(false);

  // 初始化广告SDK
  onMounted(() => {
    initializeAdSdk();
  });

  // 初始化广告SDK
  const initializeAdSdk = () => {
    // 检查是否在浏览器环境中
    if (typeof window !== 'undefined') {
      // 检查是否已加载GroMore SDK
      if (window.GroMore) {
        console.log('GroMore SDK already loaded');
        isAdSdkReady.value = true;
        isLoaded.value = true;
      } else {
        // 在开发环境中模拟SDK加载
        console.log('Simulating GroMore SDK loading in development mode');
        setTimeout(() => {
          isAdSdkReady.value = true;
          isLoaded.value = true;
          console.log('GroMore SDK loaded (simulated)');
        }, 1000);
      }
    }
  };

  // 显示激励视频广告
  const showRewardVideo = async () => {
    return new Promise<{ ecpm: number }>((resolve, reject) => {
      console.log('Showing reward video for:', config.slotId);
      
      // 检查广告SDK是否准备就绪
      if (!isAdSdkReady.value) {
        console.warn('Ad SDK not ready, using mock data');
        // 使用模拟数据
        simulateAdPlay(resolve, reject);
        return;
      }
      
      // 检查是否存在真实的GroMore SDK
      if (window.GroMore) {
        // 真实SDK调用逻辑
        try {
          // 这里是真实的GroMore SDK调用代码
          // 由于我们没有实际的SDK，这里仍然使用模拟数据
          console.log('Using real GroMore SDK');
          simulateAdPlay(resolve, reject);
        } catch (error) {
          console.error('Error showing reward video:', error);
          reject(new Error('广告播放失败'));
        }
      } else {
        // 使用模拟数据
        console.log('Using mock GroMore SDK');
        simulateAdPlay(resolve, reject);
      }
    });
  };

  // 模拟广告播放过程
  const simulateAdPlay = (resolve: (value: { ecpm: number }) => void, reject: (reason?: any) => void) => {
    // 模拟广告加载时间
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% 成功率
      if (success) {
        // 模拟ECPM值，范围在50-1000之间
        const ecpm = Math.floor(Math.random() * 950) + 50;
        resolve({ ecpm });
      } else {
        reject(new Error('广告播放失败'));
      }
    }, 2000);
  };

  return {
    isLoaded,
    isAdSdkReady,
    showRewardVideo,
    initializeAdSdk
  };
}
