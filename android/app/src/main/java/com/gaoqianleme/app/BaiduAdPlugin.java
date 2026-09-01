package com.jixucesu.app;

import android.app.Activity;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.baidu.mobads.sdk.api.RewardVideoAd;
import com.baidu.mobads.sdk.api.BiddingListener;

import java.util.HashMap;
import java.util.LinkedHashMap;

@CapacitorPlugin(name = "BaiduAd")
public class BaiduAdPlugin extends Plugin {

    private static final String TAG = "BaiduAdPlugin";
    private RewardVideoAd mRewardVideoAd;
    private PluginCall pendingShowCall;
    // 竞价结果上报状态（每个广告位只上报一次：赢或输）
    private boolean biddingReported = false;
    private int currentBidFloor = 0;
    // 当前加载的广告位是否为竞价位（bidFloor>0），竞价上报仅对竞价位执行
    private boolean currentIsBidding = false;
    
    @PluginMethod
    public void loadRewardVideoAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId == null || adId.isEmpty()) {
            call.reject("广告ID不能为空");
            return;
        }
        
        Log.d(TAG, "加载广告ID: " + adId);
        
        // 竞价底价（单位：分，仅bidding模式广告位生效，0表示不设置）
        int bidFloor = call.getInt("bidFloor", 0);
        biddingReported = false;
        currentBidFloor = bidFloor;
        currentIsBidding = bidFloor > 0;
        
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
                        Log.d(TAG, currentIsBidding ? "广告加载成功（竞价获胜）" : "广告加载成功");
                        if (mRewardVideoAd != null) {
                            String ecpm = mRewardVideoAd.getECPMLevel();
                            Log.d(TAG, "ECPM Level: " + ecpm + " (此时可能为0，真实价格在视频下载后)");
                            Log.d(TAG, "Is Ready: " + mRewardVideoAd.isReady());
                            // 竞价协议（仅竞价位）：广告返回=获胜，价格已知则立即上报biddingSuccess；
                            // 若价格尚未返回(为0)，等onVideoDownloadSuccess后再上报
                            if (currentIsBidding) {
                                double price = parseEcpm(ecpm);
                                if (price > 0) {
                                    reportBiddingSuccess(price);
                                }
                            }
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
                        
                        // 如果onRewardVerify没有被触发，广告关闭时resolve pendingShowCall
                        if (pendingShowCall != null) {
                            Log.d(TAG, "广告关闭时resolve pendingShowCall");
                            JSObject result = new JSObject();
                            result.put("rewardVerify", true);
                            result.put("ecpm", 0);
                            pendingShowCall.resolve(result);
                            pendingShowCall = null;
                        }
                    }
                    
                    @Override
                    public void onAdFailed(String error) {
                        Log.e(TAG, "广告加载失败: " + error);
                        // 竞价协议（仅竞价位）：未拿到广告=竞价失败，上报biddingFail(reason=203输给其他方)
                        if (currentIsBidding) {
                            reportBiddingFail();
                        }
                        notifyListeners("onAdFailed", new JSObject().put("error", error));
                    }

                    @Override
                    public void onVideoDownloadSuccess() {
                        Log.d(TAG, "视频下载成功");
                        // 兜底（仅竞价位）：onAdLoaded时价格未返回，此时getECPMLevel为真实价格
                        if (currentIsBidding && !biddingReported && mRewardVideoAd != null) {
                            double price = parseEcpm(mRewardVideoAd.getECPMLevel());
                            reportBiddingSuccess(price > 0 ? price : currentBidFloor);
                        }
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
                        Log.d(TAG, "获得奖励: " + rewardVerify);
                        Log.d(TAG, "奖励信息: " + rewardInfo);
                        
                        JSObject result = new JSObject();
                        result.put("rewardVerify", rewardVerify);
                        
                        // 添加rewardInfo的所有字段到结果中
                        if (rewardInfo != null) {
                            for (String key : rewardInfo.keySet()) {
                                result.put(key, rewardInfo.get(key));
                            }
                        }
                        
                        // 获取ECPM
                        double ecpmValue = 0;
                        if (mRewardVideoAd != null) {
                            String ecpmLevel = mRewardVideoAd.getECPMLevel();
                            Log.d(TAG, "ECPM Level: " + ecpmLevel);
                            
                            try {
                                if (ecpmLevel != null && !ecpmLevel.isEmpty()) {
                                    ecpmValue = Double.parseDouble(ecpmLevel);
                                }
                            } catch (NumberFormatException e) {
                                Log.w(TAG, "ECPM Level 转换失败: " + ecpmLevel);
                                // 如果ecpmLevel不是数字，尝试从rewardInfo中获取
                                if (rewardInfo != null && rewardInfo.containsKey("ecpm")) {
                                    Object ecpmObj = rewardInfo.get("ecpm");
                                    if (ecpmObj instanceof Number) {
                                        ecpmValue = ((Number) ecpmObj).doubleValue();
                                    } else if (ecpmObj instanceof String) {
                                        try {
                                            ecpmValue = Double.parseDouble((String) ecpmObj);
                                        } catch (NumberFormatException e2) {
                                            Log.w(TAG, "从rewardInfo获取ecpm失败");
                                        }
                                    }
                                }
                            }
                        }
                        
                        result.put("ecpm", ecpmValue);
                        Log.d(TAG, "最终返回的ECPM: " + ecpmValue);
                        
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
                
                // 设置竞价底价（仅bidding模式生效，单位：分）
                if (bidFloor > 0) {
                    try {
                        mRewardVideoAd.setBidFloor(bidFloor);
                        Log.d(TAG, "设置竞价底价: " + bidFloor + " 分");
                    } catch (Throwable e) {
                        Log.w(TAG, "setBidFloor 调用失败(当前SDK版本可能不支持): " + e.getMessage());
                    }
                }
                
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
                if (mRewardVideoAd.isReady()) {
                    pendingShowCall = call;
                    mRewardVideoAd.show();
                } else {
                    call.reject("广告未准备好");
                }
            } catch (Exception e) {
                Log.e(TAG, "展示广告异常: " + e.getMessage(), e);
                call.reject("展示广告异常: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", mRewardVideoAd != null && mRewardVideoAd.isReady());
        call.resolve(result);
    }

    /**
     * 解析getECPMLevel返回的价格（分），非法值返回0
     */
    private double parseEcpm(String ecpmLevel) {
        if (ecpmLevel == null || ecpmLevel.isEmpty()) return 0;
        try {
            return Double.parseDouble(ecpmLevel);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * 竞价获胜上报（百度 v9.460 新协议：百青藤竞胜，回传二价方信息）
     * 字段类型：adn/ad_t/bid_t 为 Integer；ad_n/ad_ti 为 String；ad_time 为 Long（秒级时间戳）
     * 单 SDK 集成场景无二价方信息，ad_n/ad_ti 传空字符串，adn 用百度固定值 9
     */
    private void reportBiddingSuccess(double ecpm) {
        if (mRewardVideoAd == null || biddingReported) return;
        try {
            LinkedHashMap<String, Object> biddingMap = new LinkedHashMap<>();
            // 二价/百青藤出价（单位：分，String 类型）
            biddingMap.put("ecpm", String.valueOf((int) ecpm));
            // 二价方 DSP id（百度=9，Integer 类型；单 SDK 场景固定 9）
            biddingMap.put("adn", 9);
            // 二价方物料类型（4=竖版视频，Integer 类型）
            biddingMap.put("ad_t", 4);
            // 二价方广告主名称（单 SDK 集成无法获取，传空字符串）
            biddingMap.put("ad_n", "");
            // 竞价时间，秒级时间戳
            biddingMap.put("ad_time", System.currentTimeMillis() / 1000);
            // 竞价类型（1：分层保价；2：价格标签；3：bidding；4：其他）
            biddingMap.put("bid_t", 3);
            // 二价方广告主标题（单 SDK 集成无法获取，传空字符串）
            biddingMap.put("ad_ti", "");
            mRewardVideoAd.biddingSuccess(biddingMap, new BiddingListener() {
                @Override
                public void onBiddingResult(boolean success, String msg, HashMap<String, Object> data) {
                    Log.d(TAG, "biddingSuccess 上报回调: success=" + success + ", msg=" + msg);
                }
            });
            biddingReported = true;
            Log.d(TAG, "✅ 竞价获胜已上报(v9.460新协议), ecpm=" + (int) ecpm + "分");
        } catch (Throwable e) {
            Log.w(TAG, "biddingSuccess 调用失败: " + e.getMessage());
        }
    }

    /**
     * 竞价失败上报（百度 v9.460 新协议：百青藤竞败，回传竞胜方信息）
     * 字段类型：adn/ad_t/bid_t/reason/is_s/is_c 为 Integer；ad_n/ad_ti 为 String；ad_time 为 Long
     * 单 SDK 集成场景无竞胜方信息，用合理默认值
     */
    private void reportBiddingFail() {
        if (mRewardVideoAd == null || biddingReported) return;
        try {
            LinkedHashMap<String, Object> biddingMap = new LinkedHashMap<>();
            // 竞胜方出价（单位：分，String 类型；单 SDK 场景用底价兜底）
            biddingMap.put("ecpm", String.valueOf(currentBidFloor));
            // 竞胜方 DSP id（百度=9，Integer 类型）
            biddingMap.put("adn", 9);
            // 竞胜方物料类型（4=竖版视频，Integer 类型）
            biddingMap.put("ad_t", 4);
            // 竞胜方广告主名称（单 SDK 集成无法获取，传空字符串）
            biddingMap.put("ad_n", "");
            // 竞价时间，秒级时间戳
            biddingMap.put("ad_time", System.currentTimeMillis() / 1000);
            // 竞价类型（3=bidding，Integer 类型）
            biddingMap.put("bid_t", 3);
            // 失败原因（203=输给其他竞价方，Integer 类型）
            biddingMap.put("reason", 203);
            // 是否曝光（Integer 类型，1=已曝光）
            biddingMap.put("is_s", 1);
            // 是否点击（Integer 类型，0=未点击）
            biddingMap.put("is_c", 0);
            // 竞胜方广告主标题（单 SDK 集成无法获取，传空字符串）
            biddingMap.put("ad_ti", "");
            mRewardVideoAd.biddingFail(biddingMap, new BiddingListener() {
                @Override
                public void onBiddingResult(boolean success, String msg, HashMap<String, Object> data) {
                    Log.d(TAG, "biddingFail 上报回调: success=" + success + ", msg=" + msg);
                }
            });
            biddingReported = true;
            Log.d(TAG, "✅ 竞价失败已上报(v9.460新协议,reason=203)");
        } catch (Throwable e) {
            Log.w(TAG, "biddingFail 调用失败: " + e.getMessage());
        }
    }
}
