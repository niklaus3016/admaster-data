package com.gaoqianleme.app;

import android.app.Application;
import android.content.Context;
import android.util.Log;

import com.baidu.mobads.sdk.api.BDAdConfig;
import com.baidu.mobads.sdk.api.MobadsPermissionSettings;

public class MainApplication extends Application {

    private static final String TAG = "MainApplication";
    private static final String APP_ID = "2882303761520501672";

    @Override
    public void onCreate() {
        super.onCreate();
        
        Log.d(TAG, "Application onCreate");
        
        initBaiduAdSDK();
    }

    private void initBaiduAdSDK() {
        try {
            Log.d(TAG, "开始初始化百度广告SDK，App ID: " + APP_ID);
            
            BDAdConfig bdAdConfig = new BDAdConfig.Builder()
                    .setAppName("搞钱乐么")
                    .setAppsid(APP_ID)
                    .setBDAdInitListener(new BDAdConfig.BDAdInitListener() {
                        @Override
                        public void success() {
                            Log.d(TAG, "百度广告SDK初始化成功");
                        }

                        @Override
                        public void fail() {
                            Log.e(TAG, "百度广告SDK初始化失败");
                        }
                    })
                    .setDebug(true)
                    .build(this);
            
            bdAdConfig.init();
            
            MobadsPermissionSettings.setPermissionReadDeviceID(true);
            MobadsPermissionSettings.setPermissionAppList(true);
            MobadsPermissionSettings.setPermissionLocation(true);
            MobadsPermissionSettings.setPermissionStorage(true);
            
            Log.d(TAG, "百度广告SDK初始化完成");
        } catch (Exception e) {
            Log.e(TAG, "百度广告SDK初始化异常: " + e.getMessage(), e);
        }
    }
}
