package com.ohavs.payments;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.ohavs.payments.detect.GmailAccess;
import com.ohavs.payments.detect.GmailReceiptScanner;

/**
 * Gmail read access without any UI, once the user has granted it, and the
 * background receipt check: after the first manual scan, new receipts pop up
 * as "₪61.90 · וולט — להוסיף?" even when the app is closed.
 */
@CapacitorPlugin(name = "GmailToken")
public class GmailTokenPlugin extends Plugin {

    @PluginMethod
    public void silentToken(PluginCall call) {
        getBridge().execute(() -> {
            GmailAccess.Result r = GmailAccess.silentToken(getContext());
            JSObject ret = new JSObject();
            if (r.token != null) {
                ret.put("token", r.token);
                ret.put("email", r.email);
            } else {
                ret.put("reason", r.reason);
                if (r.message != null) ret.put("message", r.message);
            }
            call.resolve(ret);
        });
    }

    /** { enabled, query }: turns the hourly background check on or off. */
    @PluginMethod
    public void setAutoScan(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        GmailReceiptScanner.setEnabled(getContext(), on, call.getString("query", ""));
        JSObject ret = new JSObject();
        ret.put("enabled", GmailReceiptScanner.isEnabled(getContext()));
        call.resolve(ret);
    }

    /** Checks now (app opened or resumed), unless it ran in the last few minutes. */
    @PluginMethod
    public void scanNow(PluginCall call) {
        boolean force = Boolean.TRUE.equals(call.getBoolean("force", false));
        getBridge().execute(() -> {
            JSObject ret = new JSObject();
            ret.put("added", GmailReceiptScanner.scan(getContext(), force));
            call.resolve(ret);
        });
    }
}
