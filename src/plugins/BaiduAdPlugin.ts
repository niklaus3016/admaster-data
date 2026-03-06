import { registerPlugin } from '@capacitor/core';

export interface BaiduAdPlugin {
  loadRewardVideoAd(options: { adId: string }): Promise<void>;
  showRewardVideoAd(): Promise<void>;
  isReady(): Promise<{ ready: boolean }>;
}

const BaiduAd = registerPlugin<BaiduAdPlugin>('BaiduAd', {
  web: () => import('./BaiduAdPluginWeb').then(m => new m.BaiduAdPluginWeb()),
});

export default BaiduAd;
