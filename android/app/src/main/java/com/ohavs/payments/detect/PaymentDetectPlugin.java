package com.ohavs.payments.detect;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

/**
 * Bridge for automatic payment detection: notification-access status, the
 * on/off switch, the pending suggestions, and the action the user picked on
 * a detection notification ("add" / "open").
 */
@CapacitorPlugin(name = "PaymentDetect")
public class PaymentDetectPlugin extends Plugin {
    private static PaymentDetectPlugin instance;
    private JSObject launchAction;

    @Override
    public void load() {
        instance = this;
        if (getActivity() != null) captureAction(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        // The app is running, so its listener takes the action directly.
        if (captureAction(intent)) {
            notifyListeners("action", launchAction, true);
            launchAction = null;
        }
    }

    private boolean captureAction(Intent intent) {
        if (intent == null) return false;
        String action = intent.getStringExtra(DetectNotifier.EXTRA_ACTION);
        String id = intent.getStringExtra(DetectNotifier.EXTRA_ID);
        if (action == null || id == null) return false;
        intent.removeExtra(DetectNotifier.EXTRA_ACTION);
        DetectNotifier.cancel(getContext(), id);
        JSObject a = new JSObject();
        a.put("action", action);
        a.put("id", id);
        launchAction = a;
        return true;
    }

    /** Called from the listener service when the inbox changes. */
    static void notifyChanged() {
        PaymentDetectPlugin p = instance;
        if (p != null) p.notifyListeners("changed", new JSObject());
    }

    private boolean hasAccess() {
        return NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("access", hasAccess());
        ret.put("enabled", SuggestionStore.isEnabled(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        SuggestionStore.setEnabled(getContext(), Boolean.TRUE.equals(call.getBoolean("enabled", false)));
        status(call);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                    new ComponentName(getContext(), PaymentListenerService.class).flattenToString());
        } else {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            getContext().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            ret.put("suggestions", new JSArray(SuggestionStore.list(getContext()).toString()));
        } catch (JSONException e) {
            ret.put("suggestions", new JSArray());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void remove(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids != null) {
            try {
                JSONArray arr = new JSONArray(ids.toString());
                for (int i = 0; i < arr.length(); i++) {
                    String id = arr.optString(i);
                    SuggestionStore.remove(getContext(), id);
                    DetectNotifier.cancel(getContext(), id);
                }
            } catch (JSONException ignored) {
                // nothing removed
            }
        }
        call.resolve();
    }

    /** The detection-notification action that opened the app, once. */
    @PluginMethod
    public void takeLaunchAction(PluginCall call) {
        JSObject ret = launchAction != null ? launchAction : new JSObject();
        launchAction = null;
        call.resolve(ret);
    }
}
