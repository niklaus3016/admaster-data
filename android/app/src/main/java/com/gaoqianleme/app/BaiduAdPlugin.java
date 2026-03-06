package com.gaoqianleme.app;

import android.app.Activity;
import android.util.Log;

import com.baidu.mobads.rewardvideo.RewardVideoAd;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BaiduAd")
public class BaiduAdPlugin extends Plugin {
    
    private static final String TAG = "BaiduAdPlugin";
    private RewardVideoAd rewardVideoAd;
    private PluginCall pendingCall;
    
    @PluginMethod
    public void loadRewardVideoAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId == null || adId.isEmpty()) {
            call.reject("广告ID不能为空");
            return;
        }
        
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity 为空");
            return;
        }
        
        pendingCall = call;
        
        activity.runOnUiThread(() -> {
            try {
                rewardVideoAd = new RewardVideoAd(activity, adId, new RewardVideoAd.RewardVideoAdListener() {
                    @Override
                    public void onAdShow() {
                        Log.d(TAG, "广告展示");
                        notifyListeners("onAdShow", new JSObject());
                    }
                    
                    @Override
                    public void onAdClick() {
                        Log.d(TAG, "广告点击");
                        notifyListeners("onAdClick", new JSObject());
                    }
                    
                    @Override
                    public void onAdClose() {
                        Log.d(TAG, "广告关闭");
                        notifyListeners("onAdClose", new JSObject());
                    }
                    
                    @Override
                    public void onAdFailed(String msg) {
                        Log.e(TAG, "广告加载失败: " + msg);
                        if (pendingCall != null) {
                            pendingCall.reject("广告加载失败: " + msg);
                            pendingCall = null;
                        }
                    }
                    
                    @Override
                    public void onVideoDownloadSuccess() {
                        Log.d(TAG, "视频下载成功");
                        if (pendingCall != null) {
                            pendingCall.resolve();
                            pendingCall = null;
                        }
                    }
                    
                    @Override
                    public void onVideoDownloadFailed() {
                        Log.e(TAG, "视频下载失败");
                        if (pendingCall != null) {
                            pendingCall.reject("视频下载失败");
                            pendingCall = null;
                        }
                    }
                    
                    @Override
                    public void onRewardVerify(boolean rewardVerify, int rewardAmount, String rewardName, double ecpm) {
                        Log.d(TAG, "获得奖励 - ecpm: " + ecpm + ", verify: " + rewardVerify);
                        JSObject result = new JSObject();
                        result.put("ecpm", ecpm);
                        result.put("rewardVerify", rewardVerify);
                        result.put("rewardAmount", rewardAmount);
                        result.put("rewardName", rewardName);
                        notifyListeners("onRewardVerify", result);
                    }
                });
                
                rewardVideoAd.load();
                
            } catch (Exception e) {
                Log.e(TAG, "加载广告异常: " + e.getMessage());
                if (pendingCall != null) {
                    pendingCall.reject("加载广告异常: " + e.getMessage());
                    pendingCall = null;
                }
            }
        });
    }
    
    @PluginMethod
    public void showRewardVideoAd(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity 为空");
            return;
        }
        
        if (rewardVideoAd == null) {
            call.reject("广告未加载");
            return;
        }
        
        activity.runOnUiThread(() -> {
            try {
                if (rewardVideoAd.isReady()) {
                    rewardVideoAd.show();
                    call.resolve();
                } else {
                    call.reject("广告未准备好");
                }
            } catch (Exception e) {
                Log.e(TAG, "展示广告异常: " + e.getMessage());
                call.reject("展示广告异常: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", rewardVideoAd != null && rewardVideoAd.isReady());
        call.resolve(result);
    }
}
