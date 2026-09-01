package com.chaoxushengbei.app;

import android.app.ActivityManager;
import android.app.Application;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.webkit.WebView;

import com.baidu.mobads.sdk.api.AdSettings;
import com.baidu.mobads.sdk.api.BDAdConfig;
import com.baidu.mobads.sdk.api.BDDialogParams;
import com.baidu.mobads.sdk.api.MobadsPermissionSettings;

public class MainApplication extends Application {

    private static final String TAG = "MainApplication";
    private static final String APP_ID = "f270327c";

    @Override
    public void onCreate() {
        super.onCreate();

        Log.d(TAG, "Application onCreate");

        // 适配 Android P+：WebView 多进程时需设置 DataDirectorySuffix，避免 WebView 数据目录冲突
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            String processName = getProcessName(this);
            // 非主进程（包名）时设置 suffix，主进程保持默认
            if (!"com.chaoxushengbei.app".equals(processName)) {
                WebView.setDataDirectorySuffix(processName);
            }
        }

        String deviceId = getMyDeviceId();
        Log.d(TAG, "========================================");
        Log.d(TAG, "设备 ID: " + deviceId);
        Log.d(TAG, "请将此设备 ID 添加到百度联盟后台的测试设备列表中");
        Log.d(TAG, "========================================");

        // 仅主进程初始化 SDK（避免激励视频等子进程重复初始化）
        if (getProcessName(this).startsWith("com.chaoxushengbei.app")) {
            initBaiduAdSDK();
        }
    }

    private String getMyDeviceId() {
        try {
            return Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Exception e) {
            Log.e(TAG, "获取设备ID失败: " + e.getMessage());
            return "unknown";
        }
    }

    private void initBaiduAdSDK() {
        try {
            Log.d(TAG, "开始初始化百度广告SDK，App ID: " + APP_ID);

            final BDAdConfig bdAdConfig = new BDAdConfig.Builder()
                    .setAppName("潮序圣杯")
                    .setAppsid(APP_ID)
                    .setBDAdInitListener(new BDAdConfig.BDAdInitListener() {
                        @Override
                        public void success() {
                            Log.d(TAG, "✅ 百度广告SDK初始化成功");
                        }

                        @Override
                        public void fail() {
                            Log.e(TAG, "❌ 百度广告SDK初始化失败");
                        }
                    })
                    // 下载弹窗配置：底部弹出 + 无动画
                    .setDialogParams(new BDDialogParams.Builder()
                            .setDlDialogType(BDDialogParams.TYPE_BOTTOM_POPUP)
                            .setDlDialogAnimStyle(BDDialogParams.ANIM_STYLE_NONE)
                            .build())
                    // debug 日志开关，调试阶段打开，上线前需关闭
                    .setDebug(true)
                    .build(this);

            // preInit：预先加载 SDK 资源（不依赖隐私协议授权）
            bdAdConfig.preInit();

            // init：必须在用户"同意隐私协议"后方可调用
            // 当前 App 无独立隐私协议流程，延迟 1 秒后调用 init 保证 SDK 完全可用
            Handler handler = new Handler(Looper.getMainLooper());
            Runnable runnable = new Runnable() {
                @Override
                public void run() {
                    bdAdConfig.init();
                    Log.d(TAG, "百度广告SDK init 已调用");
                }
            };
            handler.postDelayed(runnable, 1000);

            // 合规设置：APP ICON 资源，系统通知使用
            AdSettings.setNotificationIcon(R.mipmap.ic_launcher);

            // 权限设置（v9.460 仅保留 location/storage/limitPersonalAds，
            // setPermissionReadDeviceID/setPermissionAppList 已移除）
            MobadsPermissionSettings.setPermissionLocation(true);
            MobadsPermissionSettings.setPermissionStorage(true);
            // 限制 SDK 个性化广告推荐（合规相关，true=限制）
            MobadsPermissionSettings.setLimitPersonalAds(false);

            Log.d(TAG, "百度广告SDK preInit 已调用，1 秒后执行 init");
        } catch (Exception e) {
            Log.e(TAG, "百度广告SDK初始化异常: " + e.getMessage(), e);
        }
    }

    /**
     * 获取当前进程名
     */
    private String getProcessName(Context context) {
        if (context == null) return null;
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager == null) return null;
        for (ActivityManager.RunningAppProcessInfo processInfo : manager.getRunningAppProcesses()) {
            if (processInfo.pid == android.os.Process.myPid()) {
                return processInfo.processName;
            }
        }
        return null;
    }
}
