package com.ohavs.payments.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The widget's data on the phone: what the app synced (who is signed in, the
 * spaces and their categories), each widget's typed amount and choices, and
 * expenses saved while offline.
 */
final class WidgetStore {
    private static final String PREFS = "quick_add_widget";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject read(Context c, String key) {
        try {
            return new JSONObject(prefs(c).getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    // ---------- From the app ----------

    /** { uid, refreshToken, apiKey, projectId, currency, activeSpaceId, spaces: [{ id, name, shared, groups }] } */
    static synchronized JSONObject config(Context c) {
        return read(c, "config");
    }

    static synchronized void setConfig(Context c, JSONObject next) {
        JSONObject prev = config(c);
        SharedPreferences.Editor e = prefs(c).edit().putString("config", next.toString());
        // Another account: forget the cached token.
        if (!prev.optString("uid").equals(next.optString("uid"))) e.remove("token");
        e.apply();
    }

    static synchronized void clear(Context c) {
        prefs(c).edit().remove("config").remove("token").apply();
    }

    static boolean signedIn(Context c) {
        JSONObject cfg = config(c);
        return !cfg.optString("uid").isEmpty() && !cfg.optString("refreshToken").isEmpty();
    }

    static JSONArray spaces(Context c) {
        JSONArray a = config(c).optJSONArray("spaces");
        return a == null ? new JSONArray() : a;
    }

    /** The widget's space; by default the one last open in the app. */
    static JSONObject space(Context c, String id) {
        if (id == null || id.isEmpty()) id = config(c).optString("activeSpaceId");
        JSONArray all = spaces(c);
        JSONObject first = null;
        for (int i = 0; i < all.length(); i++) {
            JSONObject s = all.optJSONObject(i);
            if (s == null) continue;
            if (first == null) first = s;
            if (s.optString("id").equals(id)) return s;
        }
        return first;
    }

    /** Adds a category to the cached space right away (the server copy follows). */
    static synchronized void addGroup(Context c, String spaceId, String group) {
        JSONObject cfg = config(c);
        JSONArray all = cfg.optJSONArray("spaces");
        if (all == null) return;
        try {
            for (int i = 0; i < all.length(); i++) {
                JSONObject s = all.getJSONObject(i);
                if (!s.optString("id").equals(spaceId)) continue;
                JSONArray groups = s.optJSONArray("groups");
                if (groups == null) s.put("groups", groups = new JSONArray());
                for (int j = 0; j < groups.length(); j++) if (group.equals(groups.optString(j))) return;
                groups.put(group);
            }
            prefs(c).edit().putString("config", cfg.toString()).apply();
        } catch (JSONException ignored) {
            // Keep the cached list as it was.
        }
    }

    // ---------- Sign-in token ----------

    static synchronized JSONObject token(Context c) {
        return read(c, "token");
    }

    static synchronized void setToken(Context c, FirestoreRest.Token t) {
        try {
            prefs(c).edit().putString("token", new JSONObject()
                .put("idToken", t.idToken).put("expiresAt", t.expiresAt).toString()).apply();
            JSONObject cfg = config(c);
            if (t.refreshToken != null && !t.refreshToken.equals(cfg.optString("refreshToken"))) {
                cfg.put("refreshToken", t.refreshToken);
                prefs(c).edit().putString("config", cfg.toString()).apply();
            }
        } catch (JSONException ignored) {
            // A fresh token is fetched next time.
        }
    }

    // ---------- Per widget ----------

    /** { amount, category, spaceId, status, busy } */
    static synchronized JSONObject state(Context c, int widgetId) {
        return read(c, "w" + widgetId);
    }

    static synchronized void setState(Context c, int widgetId, JSONObject s) {
        prefs(c).edit().putString("w" + widgetId, s.toString()).apply();
    }

    static synchronized void removeState(Context c, int widgetId) {
        prefs(c).edit().remove("w" + widgetId).apply();
    }

    // ---------- Saved offline ----------

    static synchronized void addPending(Context c, String listId, JSONObject item) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("pending", "[]"));
            a.put(new JSONObject().put("listId", listId).put("item", item));
            prefs(c).edit().putString("pending", a.toString()).apply();
        } catch (JSONException ignored) {
            // Nothing to keep.
        }
    }

    /** Takes all of them (the caller saves or puts back what fails). */
    static synchronized JSONArray takePending(Context c) {
        JSONArray a;
        try {
            a = new JSONArray(prefs(c).getString("pending", "[]"));
        } catch (JSONException e) {
            a = new JSONArray();
        }
        prefs(c).edit().remove("pending").apply();
        return a;
    }
}
