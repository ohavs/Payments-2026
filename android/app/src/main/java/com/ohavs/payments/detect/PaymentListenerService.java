package com.ohavs.payments.detect;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;
import java.util.UUID;

/**
 * Reads payment notifications (Google Wallet, card apps, card SMS) once the
 * user grants notification access and turns detection on in the app's
 * settings. Everything is parsed on the phone; a match is stored locally and
 * offered back as "₪45 · שופרסל — להוסיף?".
 */
public class PaymentListenerService extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !SuggestionStore.isEnabled(this)) return;
        String pkg = sbn.getPackageName();
        if (getPackageName().equals(pkg)) return;
        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0 || sbn.isOngoing()) return;

        Bundle extras = n.extras;
        if (extras == null) return;
        String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
        CharSequence big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String text = str(big != null ? big : extras.getCharSequence(Notification.EXTRA_TEXT));

        PaymentParser.Result r = PaymentParser.parse(pkg, title, text);
        if (r == null) return;

        try {
            JSONObject s = new JSONObject();
            s.put("id", UUID.randomUUID().toString());
            s.put("amount", r.amount);
            s.put("currency", r.currency);
            s.put("merchant", r.merchant != null ? r.merchant : "");
            s.put("last4", r.last4 != null ? r.last4 : "");
            s.put("pkg", pkg);
            s.put("app", appLabel(pkg));
            s.put("source", sourceOf(pkg));
            s.put("time", sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis());
            if (SuggestionStore.add(this, s)) {
                DetectNotifier.show(this, s);
                PaymentDetectPlugin.notifyChanged();
            }
        } catch (JSONException ignored) {
            // Nothing to offer.
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
