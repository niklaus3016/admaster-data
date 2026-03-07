package com.gaoqianleme.app;

import android.speech.tts.TextToSpeech;
import android.util.Log;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "TTSPlugin")
public class TTSPlugin extends Plugin {
    private TextToSpeech tts;
    private boolean ttsInitialized = false;

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text");
        if (text == null) {
            call.reject("Text is required");
            return;
        }

        if (tts == null) {
            initializeTTS(call, text);
        } else {
            speakText(call, text);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) {
            tts.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        if (tts != null) {
            tts.stop();
        }
        call.resolve();
    }

    private void initializeTTS(final PluginCall call, final String text) {
        tts = new TextToSpeech(getContext(), new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) {
                    int result = tts.setLanguage(Locale.CHINESE);
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        Log.e("TTSPlugin", "Language not supported");
                        call.reject("Language not supported");
                    } else {
                        ttsInitialized = true;
                        speakText(call, text);
                    }
                } else {
                    Log.e("TTSPlugin", "TTS initialization failed");
                    call.reject("TTS initialization failed");
                }
            }
        });
    }

    private void speakText(PluginCall call, String text) {
        if (ttsInitialized) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, null);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } else {
            call.reject("TTS not initialized");
        }
    }

    @Override
    public void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}