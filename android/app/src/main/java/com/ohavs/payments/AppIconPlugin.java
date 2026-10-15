package com.ohavs.payments;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The palette's launcher icon (AppIcons): switched once the user leaves the app. */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) {
        JSObject r = new JSObject();
        r.put("current", AppIcons.current(getContext()));
        r.put("pending", AppIcons.pending(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("name", "");
        if (!AppIcons.valid(name)) {
            call.reject("unknown icon");
            return;
        }
        AppIcons.request(getContext(), name);
        get(call);
    }
}
