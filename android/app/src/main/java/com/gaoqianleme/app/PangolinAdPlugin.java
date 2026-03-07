package com.gaoqianleme.app;

import android.app.Activity;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.bytedance.sdk.openadsdk.TTAdManager;
import com.bytedance.sdk.openadsdk.TTAdConstant;
import com.bytedance.sdk.openadsdk.TTAdSdk;
import com.bytedance.sdk.openadsdk.TTAdConfig;
import com.bytedance.sdk.openadsdk.TTRewardVideoAd;
import com.bytedance.sdk.openadsdk.AdSlot;
import com.bytedance.sdk.openadsdk.TTRewardVideoAd.RewardAdInteractionListener;

@CapacitorPlugin(name = "PangolinAd")
public class PangolinAdPlugin extends Plugin {
    
    private static final String TAG = "PangolinAdPlugin";
    private TTRewardVideoAd mRewardVideoAd;
    private PluginCall pendingShowCall;
    private String appId = "你的穿山甲AppId";
    
    @PluginMethod
    public void init(PluginCall call) {
        String appIdParam = call.getString("appId");
        if (appIdParam != null && !appIdParam.isEmpty()) {
            appId = appIdParam;
        }
        
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity 为空");
            return;
        }
        
        try {
            // 初始化穿山甲SDK
            TTAdSdk.init(activity, new TTAdConfig.Builder()
                    .appId(appId)
                    .useTextureView(true)
                    .appName("广告大师")
                    .titleBarTheme(TTAdConstant.TITLE_BAR_THEME_DARK)
                    .build());
            
            Log.d(TAG, "穿山甲SDK初始化成功");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "穿山甲SDK初始化失败: " + e.getMessage(), e);
            call.reject("初始化失败: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void loadRewardVideoAd(PluginCall call) {
        String adId = call.getString("adUnitId");
        if (adId == null || adId.isEmpty()) {
            call.reject("广告位ID不能为空");
            return;
        }
        
        Log.d(TAG, "加载广告位ID: " + adId);
        
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity 为空");
            return;
        }
        
        try {
            TTAdManager adManager = TTAdSdk.getAdManager();
            if (adManager == null) {
                call.reject("穿山甲SDK未初始化");
                return;
            }
            
            // 创建广告请求参数
            AdSlot adSlot = new AdSlot.Builder()
                    .setCodeId(adId)
                    .setSupportDeepLink(true)
                    .setImageAcceptedSize(1080, 1920)
                    .setRewardName("金币")
                    .setRewardAmount(1)
                    .setUserID("用户ID")
                    .build();
            
            // 加载激励视频广告
            mRewardVideoAd = adManager.createRewardVideoAd(adSlot);
            
            // 设置广告交互监听器
            mRewardVideoAd.setRewardAdInteractionListener(new RewardAdInteractionListener() {
                @Override
                public void onAdLoaded() {
                    Log.d(TAG, "广告加载成功");
                    
                    // 获取bidECPM
                    int bidECPM = 0;
                    try {
                        bidECPM = mRewardVideoAd.getECPM();
                    } catch (Exception e) {
                        Log.w(TAG, "获取ECPM失败: " + e.getMessage());
                    }
                    
                    Log.d(TAG, "Bid ECPM: " + bidECPM);
                    
                    JSObject adInfo = new JSObject();
                    adInfo.put("bidECPM", bidECPM);
                    notifyListeners("onAdLoaded", adInfo);
                    
                    if (pendingShowCall != null) {
                        pendingShowCall.resolve(adInfo);
                        pendingShowCall = null;
                    }
                }
                
                @Override
                public void onAdShow() {
                    Log.d(TAG, "广告展示");
                    notifyListeners("onAdShow", new JSObject());
                }
                
                @Override
                public void onAdVideoBarClick() {
                    Log.d(TAG, "广告视频栏点击");
                    notifyListeners("onAdClick", new JSObject());
                }
                
                @Override
                public void onAdClose() {
                    Log.d(TAG, "广告关闭");
                    notifyListeners("onAdClose", new JSObject());
                }
                
                @Override
                public void onVideoComplete() {
                    Log.d(TAG, "视频播放完成");
                    notifyListeners("onVideoComplete", new JSObject());
                }
                
                @Override
                public void onRewardVerify(boolean rewardVerify, int rewardAmount, String rewardName) {
                    Log.d(TAG, "奖励验证: " + rewardVerify + ", 奖励数量: " + rewardAmount + ", 奖励名称: " + rewardName);
                    
                    JSObject result = new JSObject();
                    result.put("rewardVerify", rewardVerify);
                    result.put("rewardAmount", rewardAmount);
                    result.put("rewardName", rewardName);
                    
                    // 获取bidECPM
                    int bidECPM = 0;
                    try {
                        bidECPM = mRewardVideoAd.getECPM();
                    } catch (Exception e) {
                        Log.w(TAG, "获取ECPM失败: " + e.getMessage());
                    }
                    result.put("bidECPM", bidECPM);
                    Log.d(TAG, "最终返回的Bid ECPM: " + bidECPM);
                    
                    notifyListeners("onRewardVerify", result);
                    
                    if (pendingShowCall != null) {
                        pendingShowCall.resolve(result);
                        pendingShowCall = null;
                    }
                }
                
                @Override
                public void onSkippedVideo() {
                    Log.d(TAG, "视频被跳过");
                    notifyListeners("onAdSkip", new JSObject());
                }
                
                @Override
                public void onError(int code, String message) {
                    Log.e(TAG, "广告加载失败: " + code + ", " + message);
                    JSObject errorObj = new JSObject();
                    errorObj.put("code", code);
                    errorObj.put("message", message);
                    notifyListeners("onAdFailed", errorObj);
                    
                    if (pendingShowCall != null) {
                        pendingShowCall.reject("广告加载失败: " + message);
                        pendingShowCall = null;
                    }
                }
            });
            
            // 加载广告
            mRewardVideoAd.loadAd(adSlot);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "加载广告异常: " + e.getMessage(), e);
            call.reject("加载广告异常: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void showRewardVideoAd(PluginCall call) {
        Log.d(TAG, "显示广告");
        
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity 为空");
            return;
        }
        
        if (mRewardVideoAd == null) {
            call.reject("广告未加载");
            return;
        }
        
        try {
            pendingShowCall = call;
            mRewardVideoAd.showRewardVideoAd(activity);
        } catch (Exception e) {
            Log.e(TAG, "展示广告异常: " + e.getMessage(), e);
            call.reject("展示广告异常: " + e.getMessage());
            pendingShowCall = null;
        }
    }
    
    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", mRewardVideoAd != null);
        call.resolve(result);
    }
}