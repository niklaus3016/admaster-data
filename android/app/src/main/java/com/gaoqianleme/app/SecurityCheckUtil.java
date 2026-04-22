package com.yuexuxingzuo.app;

import android.content.Context;
import android.os.Build;
import android.os.Debug;
import android.provider.Settings;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;

public class SecurityCheckUtil {

    private static final String TAG = "SecurityCheckUtil";

    public static boolean isRooted() {
        return checkRootMethod1() || checkRootMethod2() || checkRootMethod3();
    }

    private static boolean checkRootMethod1() {
        String[] paths = {
            "/system/app/Superuser.apk",
            "/system/xbin/su",
            "/system/bin/su",
            "/system/sbin/su",
            "/su/bin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/data/local/su"
        };

        for (String path : paths) {
            if (new File(path).exists()) {
                Log.w(TAG, "检测到Root文件: " + path);
                return true;
            }
        }
        return false;
    }

    private static boolean checkRootMethod2() {
        String pathEnv = System.getenv("PATH");
        if (pathEnv == null) return false;
        String[] envPaths = pathEnv.split(":");
        for (String path : envPaths) {
            if (new File(path, "su").exists()) {
                Log.w(TAG, "检测到su在PATH中: " + path);
                return true;
            }
        }
        return false;
    }

    private static boolean checkRootMethod3() {
        String buildTags = Build.TAGS;
        return buildTags != null && buildTags.contains("test-keys");
    }

    public static boolean isBootloaderUnlocked(Context context) {
        try {
            String bootloaderStatus = Build.BOOTLOADER;
            Log.d(TAG, "Bootloader: " + bootloaderStatus);

            if (bootloaderStatus != null) {
                bootloaderStatus = bootloaderStatus.toLowerCase();
                if (bootloaderStatus.contains("unlocked") || bootloaderStatus.contains("test") || bootloaderStatus.contains("engineering")) {
                    Log.w(TAG, "检测到Bootloader已解锁: " + bootloaderStatus);
                    return true;
                }
            }

            return checkBootloaderStatusFromProps();
        } catch (Exception e) {
            Log.e(TAG, "检测Bootloader状态失败: " + e.getMessage());
            return false;
        }
    }

    private static boolean checkBootloaderStatusFromProps() {
        BufferedReader reader = null;
        try {
            File propFile = new File("/system/build.prop");
            if (propFile.exists()) {
                reader = new BufferedReader(new FileReader(propFile));
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.contains("ro.bootloader") && (line.contains("unlocked") || line.contains("test"))) {
                        Log.w(TAG, "检测到Bootloader已解锁 (build.prop): " + line);
                        return true;
                    }
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "读取build.prop失败: " + e.getMessage());
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (IOException e) {
                    Log.e(TAG, "关闭文件流失败: " + e.getMessage());
                }
            }
        }
        return false;
    }

    public static boolean isXposedInstalled() {
        return checkXposedMethod1() || checkXposedMethod2();
    }

    private static boolean checkXposedMethod1() {
        String[] xposedPaths = {
            "/system/framework/XposedBridge.jar",
            "/system/lib/libxposed_art.so",
            "/system/lib64/libxposed_art.so",
            "/data/data/de.robv.android.xposed.installer"
        };

        for (String path : xposedPaths) {
            if (new File(path).exists()) {
                Log.w(TAG, "检测到Xposed文件: " + path);
                return true;
            }
        }
        return false;
    }

    private static boolean checkXposedMethod2() {
        try {
            Class.forName("de.robv.android.xposed.XposedBridge");
            Log.w(TAG, "检测到Xposed Bridge类");
            return true;
        } catch (ClassNotFoundException e) {
            // Xposed未安装
        }
        return false;
    }

    // 检测USB调试是否开启
    public static boolean isUsbDebugEnabled(Context context) {
        try {
            // 方法1：检查ADB_ENABLED设置
            int adbEnabled = Settings.Secure.getInt(
                context.getContentResolver(),
                Settings.Secure.ADB_ENABLED,
                0
            );

            if (adbEnabled == 1) {
                Log.w(TAG, "检测到USB调试已开启 (ADB_ENABLED=1)");
                return true;
            }

            // 方法2：检查是否有调试器连接
            if (Debug.isDebuggerConnected()) {
                Log.w(TAG, "检测到调试器已连接");
                return true;
            }

            return false;
        } catch (Exception e) {
            Log.e(TAG, "检测USB调试状态失败: " + e.getMessage());
            return false;
        }
    }

    public static SecurityCheckResult performSecurityCheck(Context context) {
        SecurityCheckResult result = new SecurityCheckResult();

        result.isRooted = isRooted();
        result.isBootloaderUnlocked = isBootloaderUnlocked(context);
        result.isXposedInstalled = isXposedInstalled();
        result.isUsbDebugEnabled = isUsbDebugEnabled(context);
        result.isSecure = !result.isRooted && !result.isBootloaderUnlocked
                          && !result.isXposedInstalled && !result.isUsbDebugEnabled;

        Log.d(TAG, "安全检测结果: " + result);
        return result;
    }

    public static class SecurityCheckResult {
        public boolean isRooted;
        public boolean isBootloaderUnlocked;
        public boolean isXposedInstalled;
        public boolean isUsbDebugEnabled;
        public boolean isSecure;

        @Override
        public String toString() {
            return "SecurityCheckResult{" +
                    "isRooted=" + isRooted +
                    ", isBootloaderUnlocked=" + isBootloaderUnlocked +
                    ", isXposedInstalled=" + isXposedInstalled +
                    ", isUsbDebugEnabled=" + isUsbDebugEnabled +
                    ", isSecure=" + isSecure +
                    '}';
        }
    }
}