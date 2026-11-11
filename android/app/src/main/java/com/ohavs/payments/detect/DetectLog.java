package com.ohavs.payments.detect;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * What the listener saw lately, on the phone only: every Wallet notification
 * and any other one that mentions an amount, with what was decided about it.
 * Shown in Settings so a missed payment can be explained (and copied to fix
 * the parser). Also the listener's health: when it was last connected and
 * when it last saw any notification.
 */
public final class DetectLog {
    private static final String PREFS = "payment_detect_log";
    private static final String KEY_ENTRIES = "entries";
    private static final int MAX_ENTRIES = 25;
    private static final long MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000;
    private static final int MAX_TEXT = 400;
    private static long lastSeenWrite;

    private DetectLog() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void mark(Context c, String key) {
        prefs(c).edit().putLong(key, System.currentTimeMillis()).apply();
    }

    /** Any notification reached the listener; written at most once a minute. */
    static void seen(Context c) {
        long now = System.currentTimeMillis();
        if (now - lastSeenWrite < 60_000) return;
        lastSeenWrite = now;
        prefs(c).edit().putLong("lastSeen", now).apply();
    }

    static long get(Context c, String key) {
        return prefs(c).getLong(key, 0);
    }

    static synchronized void add(Context c, JSONObject entry) {
        JSONArray next = new JSONArray();
        next.put(entry);
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        JSONArray all = list(c);
        for (int i = 0; i < all.length() && next.length() < MAX_ENTRIES; i++) {
            JSONObject o = all.optJSONObject(i);
            if (o != null && o.optLong("time") >= cutoff) next.put(o);
        }
        prefs(c).edit().putString(KEY_ENTRIES, next.toString()).apply();
    }

    static synchronized JSONArray list(Context c) {
        try {
            return new JSONArray(prefs(c).getString(KEY_ENTRIES, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static synchronized void clear(Context c) {
        prefs(c).edit().remove(KEY_ENTRIES).apply();
    }

    static String clip(String s) {
        if (s == null) return "";
        return s.length() > MAX_TEXT ? s.substring(0, MAX_TEXT) + "…" : s;
    }
}
