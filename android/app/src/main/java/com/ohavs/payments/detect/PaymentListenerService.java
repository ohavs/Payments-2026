package com.ohavs.payments.detect;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Reads payment notifications (Google Wallet, card apps, card SMS) once the
 * user grants notification access and turns detection on in the app's
 * settings. Everything is parsed on the phone; a match is stored locally and
 * offered back as "₪45 · שופרסל — להוסיף?".
 */
public class PaymentListenerService extends NotificationListenerService {

    /** Bound by the system right now. Same process as the app, so the app can tell. */
    static volatile boolean connected;

    @Override
    public void onListenerConnected() {
        connected = true;
        DetectLog.mark(this, "lastConnected");
    }

    @Override
    public void onListenerDisconnected() {
        connected = false;
        DetectLog.mark(this, "lastDisconnected");
        // The system let go of us (memory, OEM battery saver): ask to be bound again.
        requestRebind(this);
    }

    @Override
    public void onDestroy() {
        connected = false;
        super.onDestroy();
    }

    static void requestRebind(Context c) {
        try {
            NotificationListenerService.requestRebind(new ComponentName(c, PaymentListenerService.class));
        } catch (RuntimeException ignored) {
            // Access was revoked; Settings shows that.
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        connected = true;
        if (!SuggestionStore.isEnabled(this)) return;
        DetectLog.seen(this);
        String pkg = sbn.getPackageName();
        if (getPackageName().equals(pkg)) return;
        Notification n = sbn.getNotification();
        if (n == null || n.extras == null) return;
        boolean wallet = PaymentParser.WALLET_PACKAGES.contains(pkg);

        Bundle extras = n.extras;
        String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
        if (title.isEmpty()) title = str(extras.getCharSequence(Notification.EXTRA_TITLE_BIG));
        String text = textOf(extras);
        if (title.isEmpty() && text.isEmpty() && n.tickerText != null) text = n.tickerText.toString();

        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0 || sbn.isOngoing()) {
            if (wallet) log(pkg, title, text, (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0 ? "summary" : "ongoing", null, null);
            return;
        }

        PaymentParser.Outcome o = PaymentParser.analyze(pkg, title, text);
        PaymentParser.Result r = o.result;
        if (r == null) {
            if (wallet || (!"ignored-app".equals(o.reason) && PaymentParser.mentionsMoney(title + "\n" + text))) {
                log(pkg, title, text, o.reason, o.detail, null);
            }
            return;
        }

        try {
            JSONObject s = new JSONObject();
            s.put("id", UUID.randomUUID().toString());
            s.put("amount", r.amount);
            s.put("currency", r.currency);
            s.put("merchant", r.merchant != null ? r.merchant : "");
            s.put("last4", r.last4 != null ? r.last4 : "");
            if (!(r.amount > 0)) s.put("needsAmount", true);
            s.put("pkg", pkg);
            s.put("app", appLabel(pkg));
            s.put("source", sourceOf(pkg));
            s.put("time", sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis());
            JSONObject shown = SuggestionStore.add(this, s);
            log(pkg, title, text, shown != null ? o.reason : "duplicate", null, r);
            if (shown != null) {
                DetectNotifier.show(this, shown);
                PaymentDetectPlugin.notifyChanged();
            }
        } catch (JSONException ignored) {
            // Nothing to offer.
        }
    }

    /**
     * The body as apps write it: expanded text (or the short one), inbox lines,
     * the latest message of a conversation, and the sub/summary lines.
     */
    static String textOf(Bundle e) {
        List<String> parts = new ArrayList<>();
        String big = str(e.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String text = str(e.getCharSequence(Notification.EXTRA_TEXT));
        addPart(parts, big);
        addPart(parts, text);
        CharSequence[] lines = e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) for (CharSequence l : lines) addPart(parts, str(l));
        Parcelable[] messages = e.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages != null && messages.length > 0 && messages[messages.length - 1] instanceof Bundle) {
            addPart(parts, str(((Bundle) messages[messages.length - 1]).getCharSequence("text")));
        }
        addPart(parts, str(e.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)));
        addPart(parts, str(e.getCharSequence(Notification.EXTRA_SUB_TEXT)));
        addPart(parts, str(e.getCharSequence(Notification.EXTRA_INFO_TEXT)));
        return TextUtils.join("\n", parts);
    }

    private static void addPart(List<String> parts, String s) {
        String t = s.trim();
        if (t.isEmpty()) return;
        for (String p : parts) if (p.contains(t)) return;
        parts.add(t);
    }

    private void log(String pkg, String title, String text, String reason, String detail, PaymentParser.Result r) {
        try {
            JSONObject e = new JSONObject();
            e.put("time", System.currentTimeMillis());
            e.put("pkg", pkg);
            e.put("app", appLabel(pkg));
            e.put("title", DetectLog.clip(title));
            e.put("text", DetectLog.clip(text));
            e.put("reason", reason);
            if (detail != null) e.put("detail", detail);
            if (r != null) {
                e.put("amount", r.amount);
                e.put("currency", r.currency);
                if (r.merchant != null) e.put("merchant", r.merchant);
            }
            DetectLog.add(this, e);
        } catch (JSONException ignored) {
            // Not logged.
        }
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString();
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }

    static String sourceOf(String pkg) {
        if (PaymentParser.WALLET_PACKAGES.contains(pkg)) return "wallet";
        String p = pkg.toLowerCase(Locale.ROOT);
        if (p.contains("messaging") || p.contains("mms") || p.contains("sms") || p.contains("message")) return "sms";
        return "card";
    }
}
