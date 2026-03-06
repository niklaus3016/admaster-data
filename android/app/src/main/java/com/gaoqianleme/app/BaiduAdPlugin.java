package com.gaoqianleme.app;

import android.app.Activity;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "BaiduAd")
public class BaiduAdPlugin extends Plugin {
    
    private static final String TAG = "BaiduAdPlugin";
    
    @PluginMethod
    public void loadRewardVideoAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId == null || adId.isEmpty()) {
            call.reject("广告ID不能为空");
            return;
        }
        
        Log.d(TAG, "加载广告ID: " + adId);
        
        // 由于暂时无法正确集成百度SDK，使用模拟数据
        // 先保存call，后续可以替换为真实SDK调用
        Log.d(TAG, "使用模拟广告数据");
        call.resolve();
    }
    
    @PluginMethod
    public void showRewardVideoAd(PluginCall call) {
        Log.d(TAG, "显示广告");
        
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity 为空");
            return;
        }
        
        activity.runOnUiThread(() -> {
            try {
                // 模拟广告播放，2秒后完成
                new android.os.Handler().postDelayed(() -> {
                    // 模拟获得奖励
                    double ecpm = Math.random() * 500 + 100;
                    Log.d(TAG, "模拟广告完成，ECPM: " + ecpm);
                    
                    JSObject result = new JSObject();
                    result.put("ecpm", ecpm);
                    result.put("rewardVerify", true);
                    result.put("rewardAmount", (int) (ecpm * 0.5));
                    result.put("rewardName", "金币");
                    
                    try {
                        notifyListeners("onRewardVerify", result);
                    } catch (Exception e) {
                        Log.e(TAG, "通知奖励失败", e);
                    }
                    
                    call.resolve();
                }, 2000);
            } catch (Exception e) {
                Log.e(TAG, "展示广告异常: " + e.getMessage(), e);
                call.reject("展示广告异常: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", true);
        call.resolve(result);
    }
}
