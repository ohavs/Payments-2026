package com.ohavs.payments;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The palette's launcher icon (AppIcons): switched once the user leaves the app, or now. */
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

    /** Switches now: the app goes to the background first, since the switch closes its screen. */
    @PluginMethod
    public void applyNow(PluginCall call) {
        call.resolve();
        if (AppIcons.pending(getContext()).isEmpty()) return;
        getActivity().runOnUiThread(() -> {
            getActivity().moveTaskToBack(true);
            new Handler(Looper.getMainLooper()).postDelayed(() -> AppIcons.applyPending(getContext()), 400);
        });
    }
}
