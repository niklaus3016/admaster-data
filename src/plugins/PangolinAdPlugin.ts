import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface PangolinAdPlugin {
  init(options: { appId: string }): Promise<void>;
  loadRewardVideoAd(options: { adUnitId: string }): Promise<void>;
  showRewardVideoAd(): Promise<{
    rewardVerify: boolean;
    rewardAmount: number;
    rewardName: string;
    bidECPM: number;
  }>;
  isReady(): Promise<{ ready: boolean }>;
  addListener(
    eventName: 'onAdLoaded',
    listenerFunc: (info: { bidECPM: number }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onAdFailed',
    listenerFunc: (error: { code: number; message: string }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onAdShow',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onAdClick',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onAdClose',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onVideoComplete',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onRewardVerify',
    listenerFunc: (info: {
      rewardVerify: boolean;
      rewardAmount: number;
      rewardName: string;
      bidECPM: number;
    }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'onAdSkip',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  removeAllListeners(): Promise<void>;
}

export const PangolinAd = registerPlugin<PangolinAdPlugin>('PangolinAd');
