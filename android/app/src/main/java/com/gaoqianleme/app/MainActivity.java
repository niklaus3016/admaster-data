package com.gaoqianleme.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册插件
        registerPlugin(PangolinAdPlugin.class);
        registerPlugin(TTSPlugin.class);
        
        super.onCreate(savedInstanceState);
    }
}
