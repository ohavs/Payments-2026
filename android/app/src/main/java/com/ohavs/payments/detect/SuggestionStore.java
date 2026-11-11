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
    // A Wallet tap without an amount right next to another report is the same tap.
    private static final long SAME_TAP_MS = 3L * 60 * 1000;

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

    /**
     * Adds the suggestion unless the same payment was already captured moments
     * ago. Wallet may report a tap without the amount and the card's app or SMS
     * with it: the amount fills the waiting suggestion instead of a second one.
     * Returns the suggestion to show (new or filled in), or null for a duplicate.
     */
    public static synchronized JSONObject add(Context c, JSONObject s) {
        JSONArray all = list(c);
        boolean[] changed = {false};
        JSONObject shown = decide(all, s, changed);
        if (shown == s) {
            JSONArray next = new JSONArray();
            next.put(s);
            for (int i = 0; i < all.length() && next.length() < MAX_ITEMS; i++) next.put(all.opt(i));
            save(c, next);
        } else if (changed[0]) {
            save(c, all);
        }
        return shown;
    }

    /**
     * Pure part of {@link #add}: returns {@code s} when it is new, the waiting
     * suggestion it filled in, or null for a duplicate. Entries of {@code all}
     * may be updated in place ({@code changed[0]} tells).
     */
    static JSONObject decide(JSONArray all, JSONObject s, boolean[] changed) {
        double amount = s.optDouble("amount", 0);
        boolean noAmount = !(amount > 0);
        long time = s.optLong("time");
        String merchant = s.optString("merchant", "");
        try {
            JSONObject waiting = null;
            for (int i = 0; i < all.length(); i++) {
                JSONObject o = all.optJSONObject(i);
                if (o == null) continue;
                long gap = Math.abs(o.optLong("time") - time);
                if (gap >= DUPLICATE_WINDOW_MS) continue;
                boolean oNoAmount = o.optBoolean("needsAmount", false);
                boolean same;
                if (noAmount) {
                    same = gap < SAME_TAP_MS
                        || (s.optString("pkg").equals(o.optString("pkg")) && merchant.equals(o.optString("merchant", "")));
                } else {
                    same = !oNoAmount && Math.abs(o.optDouble("amount", 0) - amount) < 0.005;
                }
                if (same) {
                    // Prefer a merchant name if the first report had none.
                    if (o.optString("merchant", "").isEmpty() && !merchant.isEmpty()) {
                        o.put("merchant", merchant);
                        changed[0] = true;
                    }
                    return null;
                }
                if (!noAmount && oNoAmount
                    && (waiting == null || gap < Math.abs(waiting.optLong("time") - time))) {
                    waiting = o;
                }
            }
            if (waiting != null) {
                waiting.put("amount", amount);
                waiting.put("currency", s.optString("currency", "₪"));
                waiting.remove("needsAmount");
                if (waiting.optString("merchant", "").isEmpty()) waiting.put("merchant", merchant);
                if (waiting.optString("last4", "").isEmpty()) waiting.put("last4", s.optString("last4", ""));
                changed[0] = true;
                return waiting;
            }
        } catch (JSONException ignored) {
            // Keep it as a new suggestion.
        }
        return s;
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
