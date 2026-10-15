package com.ohavs.payments.detect;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.ohavs.payments.AppActivity;
import com.ohavs.payments.R;

import org.json.JSONObject;

import java.text.DecimalFormat;

/** The app's own "₪45 · שופרסל — להוסיף?" notification with הוסף / התעלם. */
public final class DetectNotifier {
    static final String CHANNEL = "detected-payments";
    public static final String EXTRA_ACTION = "detectAction";
    public static final String EXTRA_ID = "detectId";

    private DetectNotifier() {}

    static int notificationId(String suggestionId) {
        return 0x40000000 | (suggestionId.hashCode() & 0x3fffffff);
    }

    static String amountLabel(JSONObject s) {
        double amount = s.optDouble("amount");
        String pattern = amount == Math.floor(amount) ? "#,##0" : "#,##0.00";
        return s.optString("currency", "₪") + new DecimalFormat(pattern).format(amount);
    }

    private static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "תשלומים שזוהו", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("הצעה להוסיף תשלום שזוהה מ־Wallet, מכרטיס האשראי או מקבלה במייל");
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    static void show(Context c, JSONObject s) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        if (!nm.areNotificationsEnabled()) return; // still waits in the in-app inbox
        ensureChannel(c);
        String id = s.optString("id");
        int nid = notificationId(id);
        String merchant = s.optString("merchant", "");
        String title = amountLabel(s) + (merchant.isEmpty() ? "" : " · " + merchant);

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(0xFF22A45D)
            .setContentTitle(title)
            .setContentText("gmail".equals(s.optString("source")) ? "קבלה במייל · להוסיף להוצאות?" : "להוסיף להוצאות?")
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .setContentIntent(activity(c, "open", id, nid))
            .addAction(0, "הוסף", activity(c, "add", id, nid + 1))
            .addAction(0, "התעלם", dismiss(c, id, nid + 2));
        try {
            nm.notify(nid, b.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS not granted.
        }
    }

    static void cancel(Context c, String id) {
        NotificationManagerCompat.from(c).cancel(notificationId(id));
    }

    private static PendingIntent activity(Context c, String action, String id, int requestCode) {
        Intent i = new Intent(c, AppActivity.class)
            .setAction("com.ohavs.payments.DETECT_" + action.toUpperCase(java.util.Locale.ROOT))
            .putExtra(EXTRA_ACTION, action)
            .putExtra(EXTRA_ID, id)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent dismiss(Context c, String id, int requestCode) {
        Intent i = new Intent(c, DismissReceiver.class).putExtra(EXTRA_ID, id);
        return PendingIntent.getBroadcast(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
