import { WebPlugin } from '@capacitor/core';
import type { BaiduAdPlugin } from './BaiduAdPlugin';

export class BaiduAdPluginWeb extends WebPlugin implements BaiduAdPlugin {
  async loadRewardVideoAd(options: { adId: string }): Promise<void> {
    console.log('Web 环境不支持百度原生广告，请使用 H5 SDK');
    return Promise.resolve();
  }

  async showRewardVideoAd(): Promise<void> {
    console.log('Web 环境不支持百度原生广告，请使用 H5 SDK');
    return Promise.resolve();
  }

  async isReady(): Promise<{ ready: boolean }> {
    return { ready: false };
  }
}
