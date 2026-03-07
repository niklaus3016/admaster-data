package com.gaoqianleme.app;

import android.app.Activity;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.baidu.mobads.sdk.api.RewardVideoAd;

@CapacitorPlugin(name = "BaiduAd")
public class BaiduAdPlugin extends Plugin {
    
    private static final String TAG = "BaiduAdPlugin";
    private RewardVideoAd mRewardVideoAd;
    private PluginCall pendingShowCall;
    
    @PluginMethod
    public void loadRewardVideoAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId == null || adId.isEmpty()) {
            call.reject("广告ID不能为空");
            return;
        }
        
        Log.d(TAG, "加载广告ID: " + adId);
        
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity 为空");
            return;
        }
        
        activity.runOnUiThread(() -> {
            try {
                mRewardVideoAd = new RewardVideoAd(activity, adId, new RewardVideoAd.RewardVideoAdListener() {
                    @Override
                    public void onAdLoaded() {
                        Log.d(TAG, "广告加载成功");
                        if (mRewardVideoAd != null) {
                            Log.d(TAG, "ECPM Level: " + mRewardVideoAd.getECPMLevel());
                            Log.d(TAG, "Is Ready: " + mRewardVideoAd.isReady());
                        }
                        notifyListeners("onAdLoaded", new JSObject());
                    }
                    
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
                    public void onAdClose(float playScale) {
                        Log.d(TAG, "广告关闭，播放比例: " + playScale);
                        notifyListeners("onAdClose", new JSObject());
                    }
                    
                    @Override
                    public void onAdFailed(String error) {
                        Log.e(TAG, "广告加载失败: " + error);
                        notifyListeners("onAdFailed", new JSObject().put("error", error));
                    }
                    
                    @Override
                    public void onVideoDownloadSuccess() {
                        Log.d(TAG, "视频下载成功");
                        notifyListeners("onVideoDownloadSuccess", new JSObject());
                    }
                    
                    @Override
                    public void onVideoDownloadFailed() {
                        Log.e(TAG, "视频下载失败");
                        notifyListeners("onVideoDownloadFailed", new JSObject());
                    }
                    
                    @Override
                    public void playCompletion() {
                        Log.d(TAG, "播放完成");
                    }
                    
                    @Override
                    public void onRewardVerify(boolean rewardVerify, java.util.Map<String, Object> rewardInfo) {
                        Log.d(TAG, "========== onRewardVerify 回调 ==========");
                        Log.d(TAG, "获得奖励: " + rewardVerify);
                        Log.d(TAG, "奖励信息类型: " + (rewardInfo != null ? rewardInfo.getClass().getName() : "null"));
                        
                        JSObject result = new JSObject();
                        result.put("rewardVerify", rewardVerify);
                        
                        // 添加rewardInfo的所有字段到结果中
                        if (rewardInfo != null) {
                            Log.d(TAG, "rewardInfo 包含 " + rewardInfo.size() + " 个字段");
                            for (String key : rewardInfo.keySet()) {
                                Object value = rewardInfo.get(key);
                                Log.d(TAG, "  " + key + " = " + value + " (类型: " + (value != null ? value.getClass().getName() : "null") + ")");
                                result.put(key, value);
                            }
                        } else {
                            Log.w(TAG, "rewardInfo 为空");
                        }
                        
                        // 获取ECPM - 使用ECPM Level映射表
                        double ecpmValue = 0;
                        if (mRewardVideoAd != null) {
                            String ecpmLevel = mRewardVideoAd.getECPMLevel();
                            Log.d(TAG, "ECPM Level (原始): '" + ecpmLevel + "'");
                            
                            // ECPM Level 映射表（根据百度广告联盟的价格层级）
                            if (ecpmLevel != null && !ecpmLevel.isEmpty()) {
                                try {
                                    int level = Integer.parseInt(ecpmLevel.trim());
                                    // 根据层级返回对应的ECPM值（单位：分）
                                    switch (level) {
                                        case 1: ecpmValue = 50; break;    // 0.5元
                                        case 2: ecpmValue = 100; break;   // 1元
                                        case 3: ecpmValue = 200; break;   // 2元
                                        case 4: ecpmValue = 300; break;   // 3元
                                        case 5: ecpmValue = 500; break;   // 5元
                                        case 6: ecpmValue = 800; break;   // 8元
                                        case 7: ecpmValue = 1000; break;  // 10元
                                        case 8: ecpmValue = 1500; break;  // 15元
                                        case 9: ecpmValue = 2000; break;  // 20元
                                        case 10: ecpmValue = 3000; break; // 30元
                                        default: 
                                            // 如果层级超出范围，使用层级*100作为默认值
                                            ecpmValue = level * 100;
                                            break;
                                    }
                                    Log.d(TAG, "ECPM Level " + level + " 映射为 " + ecpmValue + " 分");
                                } catch (NumberFormatException e) {
                                    Log.w(TAG, "ECPM Level 转换失败: '" + ecpmLevel + "', 错误: " + e.getMessage());
                                    // 尝试直接解析为数字
                                    try {
                                        ecpmValue = Double.parseDouble(ecpmLevel.trim());
                                        Log.d(TAG, "ECPM Level 直接解析为: " + ecpmValue);
                                    } catch (NumberFormatException e2) {
                                        Log.w(TAG, "ECPM Level 无法解析为数字");
                                    }
                                }
                            } else {
                                Log.w(TAG, "ECPM Level 为空或null");
                            }
                            
                            // 如果ECPM仍为0，尝试从rewardInfo中获取
                            if (ecpmValue == 0 && rewardInfo != null) {
                                // 尝试所有可能的字段名
                                String[] possibleKeys = {"ecpm", "ECPM", "price", "amount", "reward", "coin", "gold"};
                                for (String key : possibleKeys) {
                                    if (rewardInfo.containsKey(key)) {
                                        Object ecpmObj = rewardInfo.get(key);
                                        Log.d(TAG, "尝试从 '" + key + "' 获取ECPM: " + ecpmObj);
                                        if (ecpmObj instanceof Number) {
                                            ecpmValue = ((Number) ecpmObj).doubleValue();
                                            Log.d(TAG, "从 '" + key + "' 获取到ECPM: " + ecpmValue);
                                            break;
                                        } else if (ecpmObj instanceof String) {
                                            try {
                                                ecpmValue = Double.parseDouble((String) ecpmObj);
                                                Log.d(TAG, "从 '" + key + "' 获取到ECPM: " + ecpmValue);
                                                break;
                                            } catch (NumberFormatException e) {
                                                Log.w(TAG, "从 '" + key + "' 获取ECPM失败: " + e.getMessage());
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            Log.w(TAG, "mRewardVideoAd 为null");
                        }
                        
                        result.put("ecpm", ecpmValue);
                        Log.d(TAG, "最终返回的ECPM: " + ecpmValue);
                        Log.d(TAG, "========== onRewardVerify 结束 ==========");
                        
                        notifyListeners("onRewardVerify", result);
                        
                        if (pendingShowCall != null) {
                            pendingShowCall.resolve(result);
                            pendingShowCall = null;
                        }
                    }
                    
                    @Override
                    public void onAdSkip(float playScale) {
                        Log.d(TAG, "广告跳过，播放比例: " + playScale);
                    }
                });
                
                // 加载广告
                mRewardVideoAd.load();
                call.resolve();
                
            } catch (Exception e) {
                Log.e(TAG, "加载广告异常: " + e.getMessage(), e);
                call.reject("加载广告异常: " + e.getMessage());
            }
        });
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
        
        activity.runOnUiThread(() -> {
            try {
                // 保存调用，无论广告是否准备好
                pendingShowCall = call;
                
                if (mRewardVideoAd.isReady()) {
                    Log.d(TAG, "广告已准备好，直接显示");
                    mRewardVideoAd.show();
                } else {
                    Log.d(TAG, "广告未准备好，等待准备完成后显示");
                    // 广告会在准备好后自动显示
                }
            } catch (Exception e) {
                Log.e(TAG, "展示广告异常: " + e.getMessage(), e);
                call.reject("展示广告异常: " + e.getMessage());
                pendingShowCall = null;
            }
        });
    }
    
    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", mRewardVideoAd != null && mRewardVideoAd.isReady());
        call.resolve(result);
    }
}
