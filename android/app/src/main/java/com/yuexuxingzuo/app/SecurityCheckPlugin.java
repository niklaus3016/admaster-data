package com.jianxuqingdan.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SecurityCheck")
public class SecurityCheckPlugin extends Plugin {

    @PluginMethod
    public void checkSecurity(PluginCall call) {
        SecurityCheckUtil.SecurityCheckResult result = SecurityCheckUtil.performSecurityCheck(getContext());

        JSObject response = new JSObject();
        response.put("isRooted", result.isRooted);
        response.put("isBootloaderUnlocked", result.isBootloaderUnlocked);
        response.put("isXposedInstalled", result.isXposedInstalled);
        response.put("isUsbDebugEnabled", result.isUsbDebugEnabled);
        response.put("isSecure", result.isSecure);

        call.resolve(response);
    }
}