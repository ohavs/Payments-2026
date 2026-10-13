package com.ohavs.payments.detect;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Detected payments waiting for the user: added from the in-app inbox or the
 * notification's "הוסף" button, or dismissed. Kept on the phone only; nothing
 * reaches Firestore until the user adds it.
 */
public final class SuggestionStore {
    private static final String PREFS = "payment_detect";
    private static final String KEY_ITEMS = "suggestions";
    private static final String KEY_ENABLED = "enabled";
    private static final int MAX_ITEMS = 30;
    private static final long MAX_AGE_MS = 14L * 24 * 60 * 60 * 1000;
    // Wallet and the card's own app (or its SMS) report the same purchase.
    private static final long DUPLICATE_WINDOW_MS = 15L * 60 * 1000;

    private SuggestionStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context c) {
        return prefs(c).getBoolean(KEY_ENABLED, false);
    }

    public static void setEnabled(Context c, boolean on) {
        prefs(c).edit().putBoolean(KEY_ENABLED, on).apply();
    }

    public static synchronized JSONArray list(Context c) {
        JSONArray out = new JSONArray();
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        try {
            JSONArray all = new JSONArray(prefs(c).getString(KEY_ITEMS, "[]"));
            for (int i = 0; i < all.length(); i++) {
                JSONObject o = all.getJSONObject(i);
                if (o.optLong("time") >= cutoff) out.put(o);
            }
        } catch (JSONException ignored) {
            // Corrupt store: start over.
        }
        return out;
    }

    public static synchronized JSONObject get(Context c, String id) {
        JSONArray all = list(c);
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o != null && id.equals(o.optString("id"))) return o;
        }
        return null;
    }

    /** Adds the suggestion unless the same amount was already captured moments ago. */
    public static synchronized boolean add(Context c, JSONObject s) {
        JSONArray all = list(c);
        double amount = s.optDouble("amount");
        long time = s.optLong("time");
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o == null) continue;
            if (Math.abs(o.optDouble("amount") - amount) < 0.005
                && Math.abs(o.optLong("time") - time) < DUPLICATE_WINDOW_MS) {
                // Prefer a merchant name if the first report had none.
                if (o.optString("merchant", "").isEmpty() && !s.optString("merchant", "").isEmpty()) {
                    try {
                        o.put("merchant", s.optString("merchant"));
                        save(c, all);
                    } catch (JSONException ignored) {
                        // keep the original
                    }
                }
                return false;
            }
        }
        JSONArray next = new JSONArray();
        next.put(s);
        for (int i = 0; i < all.length() && next.length() < MAX_ITEMS; i++) next.put(all.opt(i));
        save(c, next);
        return true;
    }

    public static synchronized void remove(Context c, String id) {
        JSONArray all = list(c);
        JSONArray next = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject o = all.optJSONObject(i);
            if (o != null && !id.equals(o.optString("id"))) next.put(o);
        }
        save(c, next);
    }

    private static void save(Context c, JSONArray items) {
        prefs(c).edit().putString(KEY_ITEMS, items.toString()).apply();
    }
}
