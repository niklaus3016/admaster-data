import { ref, onMounted, onUnmounted } from 'vue';
import { PangolinAd } from '../plugins/PangolinAdPlugin';

declare global {
  interface Window {
    baidu?: any;
    _baidu?: any;
  }
}

interface AdConfig {
  appId: string;
  adUnitId: string;
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
  let adLoadedListener: any = null;
  let timeoutId: any = null;
  let currentResolve: any = null;
  let currentReject: any = null;

  onMounted(() => {
    initializeAdSdk();
  });

  onUnmounted(() => {
    cleanupListeners();
  });

  const cleanupListeners = () => {
    if (rewardVerifyListener) PangolinAd.removeListener('onRewardVerify', rewardVerifyListener);
    if (adFailedListener) PangolinAd.removeListener('onAdFailed', adFailedListener);
    if (adLoadedListener) PangolinAd.removeListener('onAdLoaded', adLoadedListener);
    if (timeoutId) clearTimeout(timeoutId);
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
        console.log('原生 Android 环境，使用穿山甲原生 SDK');
        await PangolinAd.init({ appId: config.appId });
        isAdSdkReady.value = true;
        isLoaded.value = true;
        preloadAd.value = true;
        return;
      }

      // 非原生环境，使用H5广告（暂时保留百度H5广告作为备用）
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
      console.log('广告位 ID:', config.adUnitId);
      console.log('是否原生环境:', isNativeApp());
      console.log('广告是否已准备:', isAdReady.value);
      
      currentResolve = resolve;
      currentReject = reject;
      
      try {
        if (isNativeApp()) {
          console.log('使用穿山甲原生广告插件');
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
      
      const onAdLoaded = (info: any) => {
        console.log('✅ 广告加载成功回调:', info);
        isAdReady.value = true;
        isAdLoading.value = false;
      };

      const onRewardVerify = (result: any) => {
        console.log('========== 广告奖励回调 ==========');
        console.log('完整结果对象:', JSON.stringify(result));
        console.log('rewardVerify:', result?.rewardVerify);
        console.log('bidECPM (原始):', result?.bidECPM);
        console.log('bidECPM 类型:', typeof result?.bidECPM);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        // 解析 ECPM 值
        let ecpm = 0;
        if (result?.bidECPM !== undefined && result?.bidECPM !== null) {
          const ecpmRaw = result.bidECPM;
          if (typeof ecpmRaw === 'number') {
            ecpm = ecpmRaw;
          } else if (typeof ecpmRaw === 'string') {
            ecpm = parseFloat(ecpmRaw);
          }
        }
        
        console.log('解析后的 ECPM:', ecpm);
        console.log('===================================');
        
        isAdLoading.value = false;
        isAdReady.value = false;
        cleanupListeners();
        
        // 只有当 ECPM > 0 时才认为广告成功
        if (ecpm > 0) {
          resolve({ ecpm });
        } else {
          // 如果ECPM为0，使用默认值500（5元/千次）
          const defaultEcpm = 500;
          console.log('ECPM为0，使用默认值:', defaultEcpm);
          resolve({ ecpm: defaultEcpm });
        }
      };
      
      const onAdFailed = (error: any) => {
        const errorMsg = error?.message || error || '未知错误';
        console.warn('⚠️ 广告加载失败:', errorMsg);
        lastError.value = '广告加载失败: ' + errorMsg;
        
        if (timeoutId) clearTimeout(timeoutId);
        isAdLoading.value = false;
        isAdReady.value = false;
        cleanupListeners();
        
        reject(new Error('广告加载失败: ' + errorMsg));
      };
      
      adLoadedListener = onAdLoaded;
      rewardVerifyListener = onRewardVerify;
      adFailedListener = onAdFailed;
      
      PangolinAd.addListener('onAdLoaded', onAdLoaded);
      PangolinAd.addListener('onRewardVerify', onRewardVerify);
      PangolinAd.addListener('onAdFailed', onAdFailed);
      
      console.log('调用 loadRewardVideoAd...');
      await PangolinAd.loadRewardVideoAd({ adUnitId: config.adUnitId });
      console.log('✅ 广告加载请求已发送，等待回调...');
      
      // 等待广告加载完成
      timeoutId = setTimeout(async () => {
        console.warn('⏱️ 广告加载超时（30秒）');
        lastError.value = '广告加载超时，可能是网络问题或广告填充不足';
        
        isAdReady.value = false;
        isAdLoading.value = false;
        cleanupListeners();
        
        // 尝试显示广告
        try {
          const result = await PangolinAd.showRewardVideoAd();
          // 解析 ECPM 值
          let ecpm = 0;
          if (result?.bidECPM !== undefined && result?.bidECPM !== null) {
            const ecpmRaw = result.bidECPM;
            if (typeof ecpmRaw === 'number') {
              ecpm = ecpmRaw;
            } else if (typeof ecpmRaw === 'string') {
              ecpm = parseFloat(ecpmRaw);
            }
          }
          
          if (ecpm > 0) {
            resolve({ ecpm });
          } else {
            // 如果ECPM为0，使用默认值500（5元/千次）
            const defaultEcpm = 500;
            console.log('ECPM为0，使用默认值:', defaultEcpm);
            resolve({ ecpm: defaultEcpm });
          }
        } catch (error) {
          reject(new Error('广告加载超时'));
        }
      }, 30000);
      
    } catch (error) {
      const errorMsg = error?.message || error || '未知错误';
      console.error('❌ 原生广告播放失败:', errorMsg);
      lastError.value = '广告播放失败: ' + errorMsg;
      if (timeoutId) clearTimeout(timeoutId);
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
        slotId: config.adUnitId,
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
            // 如果ECPM为0，使用默认值500（5元/千次）
            const defaultEcpm = 500;
            console.log('ECPM为0，使用默认值:', defaultEcpm);
            resolve({ ecpm: defaultEcpm });
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