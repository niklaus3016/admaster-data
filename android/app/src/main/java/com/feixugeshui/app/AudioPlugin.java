package com.feixugeshui.app;

import android.content.Context;
import android.media.MediaPlayer;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;

@CapacitorPlugin(name = "AudioPlugin")
public class AudioPlugin extends Plugin {
    private static final String TAG = "AudioPlugin";
    private MediaPlayer mediaPlayer;

    @PluginMethod
    public void play(PluginCall call) {
        String filePath = call.getString("filePath");
        Double volumeValue = call.getDouble("volume", 0.5);
        float volume = volumeValue != null ? volumeValue.floatValue() : 0.5f;
        boolean loop = call.getBoolean("loop", false);

        if (filePath == null || filePath.isEmpty()) {
            call.reject("文件路径不能为空");
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("Context 为空");
            return;
        }

        try {
            // 释放之前的播放器
            if (mediaPlayer != null) {
                mediaPlayer.release();
                mediaPlayer = null;
            }

            // 获取资源ID
            int resourceId = context.getResources().getIdentifier(
                filePath.replace(".m4a", "").replace(".mp3", "").replace(".wav", ""),
                "raw",
                context.getPackageName()
            );

            if (resourceId == 0) {
                call.reject("找不到音频文件: " + filePath);
                return;
            }

            // 创建新的播放器
            mediaPlayer = MediaPlayer.create(context, resourceId);
            if (mediaPlayer == null) {
                call.reject("创建播放器失败");
                return;
            }

            mediaPlayer.setVolume(volume, volume);
            mediaPlayer.setLooping(loop);
            mediaPlayer.start();

            Log.d(TAG, "开始播放音频: " + filePath);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "播放音频失败", e);
            call.reject("播放音频失败: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            Log.d(TAG, "暂停播放");
            call.resolve();
        } else {
            call.reject("没有正在播放的音频");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (mediaPlayer != null) {
            mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
            Log.d(TAG, "停止播放");
            call.resolve();
        } else {
            call.reject("没有正在播放的音频");
        }
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volumeValue = call.getDouble("volume", 0.5);
        float volume = volumeValue != null ? volumeValue.floatValue() : 0.5f;
        if (mediaPlayer != null) {
            mediaPlayer.setVolume(volume, volume);
            Log.d(TAG, "设置音量: " + volume);
            call.resolve();
        } else {
            call.reject("没有正在播放的音频");
        }
    }

}
