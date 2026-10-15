package com.ohavs.payments.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

/**
 * App ↔ widget: the app syncs who is signed in and the spaces with their
 * categories, takes the expenses the widget saved offline, and can ask the
 * launcher to pin the widget.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        WidgetStore.setConfig(getContext(), call.getData());
        QuickAddWidget.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        WidgetStore.clear(getContext());
        QuickAddWidget.refreshAll(getContext());
        call.resolve();
    }

    /** Expenses the widget couldn't send; the app saves them and they're gone from here. */
    @PluginMethod
    public void takePending(PluginCall call) {
        JSONArray pending = WidgetStore.takePending(getContext());
        JSObject ret = new JSObject();
        try {
            ret.put("items", new JSArray(pending.toString()));
        } catch (org.json.JSONException e) {
            ret.put("items", new JSArray());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void status(PluginCall call) {
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        JSObject ret = new JSObject();
        ret.put("count", m.getAppWidgetIds(new ComponentName(getContext(), QuickAddWidget.class)).length);
        ret.put("pinSupported", Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported());
        call.resolve(ret);
    }

    /** Asks the launcher to add the widget to the home screen (Android 8+). */
    @PluginMethod
    public void pin(PluginCall call) {
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        boolean ok = Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported()
            && m.requestPinAppWidget(new ComponentName(getContext(), QuickAddWidget.class), null, null);
        JSObject ret = new JSObject();
        ret.put("ok", ok);
        call.resolve(ret);
    }
}
