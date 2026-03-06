package com.gaoqianleme.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册百度广告插件
        registerPlugin(BaiduAdPlugin.class);
        
        super.onCreate(savedInstanceState);
    }
}
