package com.jianxuqingdan.app;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.app.ActivityManager;
import android.view.accessibility.AccessibilityManager;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

public class RiskDetector {
    public static class RiskResult {
        public boolean hasRisk;
        public String riskDescription;

        public RiskResult(boolean hasRisk, String riskDescription) {
            this.hasRisk = hasRisk;
            this.riskDescription = riskDescription;
        }
    }

    public static RiskResult checkAllRisks(Context context) {
        List<String> risks = new ArrayList<>();

        // 检测1：开发者选项 + USB调试 + 无线调试
        if (isDeveloperOptionsEnabled(context)) {
            risks.add("开发者选项已开启");
        }
        if (isUsbDebuggingEnabled(context)) {
            risks.add("USB调试已开启");
        }
        if (isWirelessDebuggingEnabled(context)) {
            risks.add("无线调试已开启");
        }

        // 检测2：Root + Xposed/LSPosed/Magisk
        if (isRooted()) {
            risks.add("设备已Root");
        }
        if (isXposedInstalled(context)) {
            risks.add("Xposed框架已安装");
        }
        if (isMagiskInstalled(context)) {
            risks.add("Magisk框架已安装");
        }

        // 检测3：无障碍服务 + 自动点击/连点器
        if (isAccessibilityServiceRunning(context)) {
            risks.add("无障碍服务已开启");
        }
        if (isAutoClickerInstalled(context)) {
            risks.add("检测到自动点击/连点器工具");
        }

        // 检测4：投屏/屏幕镜像 + 录屏
        if (isScreenCastingActive(context)) {
            risks.add("检测到投屏/录屏环境");
        }

        // 检测5：模拟器 + 云手机 + 应用多开/分身
        if (isEmulator()) {
            risks.add("检测到模拟器环境");
        }
        if (isCloudPhone(context)) {
            risks.add("检测到云手机环境");
        }
        if (isAppCloned(context)) {
            risks.add("检测到应用多开/分身环境");
        }

        if (risks.isEmpty()) {
            return new RiskResult(false, "");
        } else {
            String riskDesc = String.join("、", risks);
            return new RiskResult(true, riskDesc);
        }
    }

    // ========== 检测方法实现 ==========

    private static boolean isDeveloperOptionsEnabled(Context context) {
        try {
            int enabled = Settings.Secure.getInt(context.getContentResolver(), Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0);
            return enabled == 1;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isUsbDebuggingEnabled(Context context) {
        try {
            int enabled = Settings.Secure.getInt(context.getContentResolver(), Settings.Global.ADB_ENABLED, 0);
            return enabled == 1;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isWirelessDebuggingEnabled(Context context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                int enabled = Settings.Global.getInt(context.getContentResolver(), "adb_wifi_enabled", 0);
                return enabled == 1;
            }
        } catch (Exception e) {
            // 忽略低版本
        }
        return false;
    }

    private static boolean isRooted() {
        String[] paths = {
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su"
        };

        for (String path : paths) {
            if (new File(path).exists()) {
                return true;
            }
        }

        try {
            Process process = Runtime.getRuntime().exec("which su");
            BufferedReader in = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line = in.readLine();
            in.close();
            return line != null && !line.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isXposedInstalled(Context context) {
        try {
            // 检查常见Xposed包名
            String[] packages = {
                "de.robv.android.xposed",
                "de.robv.android.xposed.installer",
                "io.github.libxposed",
                "io.github.libxposed.service"
            };

            PackageManager pm = context.getPackageManager();
            for (String pkg : packages) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    return true;
                } catch (PackageManager.NameNotFoundException ignored) {}
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private static boolean isMagiskInstalled(Context context) {
        try {
            String[] packages = {
                "com.topjohnwu.magisk"
            };

            PackageManager pm = context.getPackageManager();
            for (String pkg : packages) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    return true;
                } catch (PackageManager.NameNotFoundException ignored) {}
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private static boolean isAccessibilityServiceRunning(Context context) {
        try {
            AccessibilityManager accessibilityManager = 
                (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
            if (accessibilityManager != null && accessibilityManager.isEnabled()) {
                return accessibilityManager.getEnabledAccessibilityServiceList(-1).size() > 0;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private static boolean isAutoClickerInstalled(Context context) {
        try {
            String[] packages = {
                "com.truedevelopersstudio.automatictap.autoclicker",
                "com.samsung.accessory",
                "com.touchsprite.android",
                "com.gamehelper",
                "com.an.autoclicker",
                "com.kaydev.autoclicker",
                "autoclicker.clicker.fast.tap",
                "cn.auto.clicker",
                "com.auto.clicker.tap"
            };

            PackageManager pm = context.getPackageManager();
            for (String pkg : packages) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    return true;
                } catch (PackageManager.NameNotFoundException ignored) {}
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private static boolean isScreenCastingActive(Context context) {
        try {
            // 检测1：检查常见投屏软件是否安装
            String[] castingPackages = {
                "com.hpplay.sdk.source", // 乐播投屏
                "com.hpplay.app",
                "com.xiaomi.mirror", // 小米投屏
                "com.huawei.castscreen", // 华为投屏
                "com.samsung.castscreen", // 三星投屏
                "com.letv.castscreen", // 乐视投屏
                "com.airplay.android", // AirPlay
                "tv.danmaku.bili" // 哔哩哔哩投屏
            };
            
            PackageManager pm = context.getPackageManager();
            for (String pkg : castingPackages) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    // 检查应用是否正在运行
                    ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
                    if (am != null) {
                        List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
                        for (ActivityManager.RunningAppProcessInfo process : processes) {
                            if (process.processName.equals(pkg)) {
                                return true;
                            }
                        }
                    }
                } catch (PackageManager.NameNotFoundException ignored) {}
            }
            
            // 检测2：检查服务类名关键词
            ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (am != null) {
                List<ActivityManager.RunningServiceInfo> services = am.getRunningServices(100);
                for (ActivityManager.RunningServiceInfo service : services) {
                    String serviceName = service.service.getClassName().toLowerCase();
                    if (serviceName.contains("cast") || 
                        serviceName.contains("mirror") || 
                        serviceName.contains("screenrecord") || 
                        serviceName.contains("media_projection")) {
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private static boolean isEmulator() {
        try {
            String brand = Build.BRAND.toLowerCase();
            String device = Build.DEVICE.toLowerCase();
            String product = Build.PRODUCT.toLowerCase();
            String hardware = Build.HARDWARE.toLowerCase();
            String manufacturer = Build.MANUFACTURER.toLowerCase();

            String[] emuKeywords = {
                "google_sdk", "sdk_gphone", "emulator", "sdk", 
                "genymotion", "nox", "bluestacks", "memu", 
                "ldplayer", "mumu", "ddmlib"
            };

            for (String keyword : emuKeywords) {
                if (brand.contains(keyword) || 
                    device.contains(keyword) || 
                    product.contains(keyword) ||
                    hardware.contains(keyword) || 
                    manufacturer.contains(keyword)) {
                    return true;
                }
            }

            if (Build.FINGERPRINT.contains("generic")) {
                return true;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private static boolean isCloudPhone(Context context) {
        try {
            String[] cloudPackages = {
                "com.xiaomi.cloud", "com.huawei.cloud", 
                "com.taobao.taobao", "com.aliyun.gslb", 
                "com.netease.nis.eagleeye", "com.hihonor.cloud",
                "com.aweme.cloudphone", "com.baidu.cloudgame"
            };

            PackageManager pm = context.getPackageManager();
            for (String pkg : cloudPackages) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    return true;
                } catch (PackageManager.NameNotFoundException ignored) {}
            }

            String[] cloudKeywords = {"cloud", "vps", "virtual", "android-on"};
            String manufacturer = Build.MANUFACTURER.toLowerCase();
            for (String keyword : cloudKeywords) {
                if (manufacturer.contains(keyword)) {
                    return true;
                }
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private static boolean isAppCloned(Context context) {
        try {
            String[] clonePackages = {
                "com.lbe.parallel", "com.parallel.space", 
                "com.clone.space", "com.bly.parallel",
                "com.excelliance.kxqp", "com.applist.applist"
            };

            PackageManager pm = context.getPackageManager();
            for (String pkg : clonePackages) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    return true;
                } catch (PackageManager.NameNotFoundException ignored) {}
            }

            String processName = context.getApplicationInfo().processName;
            if (processName != null && (processName.contains(":") || processName.contains("clone"))) {
                return true;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }
}
