package com.feixugeshui.app;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
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

            // 构建完整的文件名
            String fullFileName = filePath;
            if (!filePath.endsWith(".m4a") && !filePath.endsWith(".mp3") && !filePath.endsWith(".wav")) {
                fullFileName = filePath + ".m4a";
            }

            // 尝试从 assets 加载
            mediaPlayer = new MediaPlayer();
            AssetFileDescriptor afd = context.getAssets().openFd(fullFileName);
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            
            mediaPlayer.prepare();
            mediaPlayer.setVolume(volume, volume);
            mediaPlayer.setLooping(loop);
            mediaPlayer.start();

            Log.d(TAG, "开始播放音频: " + fullFileName);
            call.resolve();
        } catch (IOException e) {
            Log.e(TAG, "找不到音频文件: " + filePath, e);
            call.reject("找不到音频文件: " + filePath);
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
