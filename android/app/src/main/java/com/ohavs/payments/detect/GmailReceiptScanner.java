package com.ohavs.payments.detect;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Background receipt check: new mail matching the app's receipt query (set
 * from src/lib/gmail.js) becomes a suggestion in the same inbox as Wallet,
 * with the "להוסיף?" notification. Only mail that arrived after the check was
 * turned on, each message once. Nothing leaves the phone.
 */
public final class GmailReceiptScanner {
    private static final String PREFS = "gmail_auto";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_QUERY = "query";
    private static final String KEY_SINCE = "since";
    private static final String KEY_SEEN = "seen";
    private static final String KEY_LAST = "last";
    private static final String API = "https://gmail.googleapis.com/gmail/v1/users/me";
    private static final long MIN_GAP_MS = 10L * 60 * 1000;
    private static final int MAX_SEEN = 300;

    private GmailReceiptScanner() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isEnabled(Context c) {
        return prefs(c).getBoolean(KEY_ENABLED, false);
    }

    public static void setEnabled(Context c, boolean on, String query) {
        SharedPreferences p = prefs(c);
        SharedPreferences.Editor e = p.edit().putBoolean(KEY_ENABLED, on);
        if (query != null && !query.isEmpty()) e.putString(KEY_QUERY, query);
        // Start from now: older receipts were already offered by the manual scan.
        if (on && !p.contains(KEY_SINCE)) e.putLong(KEY_SINCE, System.currentTimeMillis());
        e.apply();
        if (on) GmailReceiptJob.schedule(c);
        else GmailReceiptJob.cancel(c);
    }

    /** Runs one check; returns how many new suggestions were added. Off the main thread. */
    public static synchronized int scan(Context c, boolean force) {
        SharedPreferences p = prefs(c);
        String query = p.getString(KEY_QUERY, "");
        if (!p.getBoolean(KEY_ENABLED, false) || query.isEmpty()) return 0;
        long now = System.currentTimeMillis();
        if (!force && now - p.getLong(KEY_LAST, 0) < MIN_GAP_MS) return 0;

        GmailAccess.Result access = GmailAccess.silentToken(c);
        if (access.token == null) return 0;
        p.edit().putLong(KEY_LAST, now).apply();

        long since = p.getLong(KEY_SINCE, now);
        List<String> seen = loadSeen(p);
        int added = 0;
        try {
            JSONObject list = get(c, access.token, "/messages?maxResults=20&q=" + URLEncoder.encode(query, "UTF-8"));
            JSONArray messages = list.optJSONArray("messages");
            if (messages == null) return 0;
            for (int i = 0; i < messages.length(); i++) {
                String id = messages.getJSONObject(i).optString("id");
                if (id.isEmpty() || seen.contains(id)) continue;
                JSONObject msg = get(c, access.token, "/messages/" + id + "?format=full");
                seen.add(id);
                long time = msg.optLong("internalDate", now);
                if (time < since) continue;
                JSONObject s = suggestion(msg, id, time);
                if (s != null && SuggestionStore.add(c, s)) {
                    added++;
                    DetectNotifier.show(c, s);
                }
            }
        } catch (IOException | JSONException e) {
            // Offline or Gmail refused: try again on the next run.
        } finally {
            saveSeen(p, seen);
        }
        if (added > 0) PaymentDetectPlugin.notifyChanged();
        return added;
    }

    private static JSONObject suggestion(JSONObject msg, String id, long time) throws JSONException {
        JSONObject payload = msg.optJSONObject("payload");
        if (payload == null) return null;
        String subject = "";
        String from = "";
        JSONArray headers = payload.optJSONArray("headers");
        if (headers != null) {
            for (int i = 0; i < headers.length(); i++) {
                JSONObject h = headers.getJSONObject(i);
                String name = h.optString("name");
                if ("subject".equalsIgnoreCase(name)) subject = h.optString("value");
                else if ("from".equalsIgnoreCase(name)) from = h.optString("value");
            }
        }
        String[] parts = new String[2]; // text/plain, text/html
        collectParts(payload, parts);
        GmailReceiptParser.Receipt r = GmailReceiptParser.parse(subject, from, parts[0], parts[1], msg.optString("snippet"));
        if (r == null) return null;
        JSONObject s = new JSONObject();
        s.put("id", "gmail:" + id);
        s.put("amount", r.amount);
        s.put("currency", r.currency);
        s.put("merchant", r.merchant);
        s.put("domain", r.domain);
        s.put("subject", subject);
        s.put("pkg", "gmail");
        s.put("app", "Gmail");
        s.put("source", "gmail");
        s.put("time", time);
        return s;
    }

    private static void collectParts(JSONObject part, String[] out) {
        JSONArray children = part.optJSONArray("parts");
        if (children != null) {
            for (int i = 0; i < children.length(); i++) {
                JSONObject child = children.optJSONObject(i);
                if (child != null) collectParts(child, out);
            }
            return;
        }
        String mime = part.optString("mimeType");
        JSONObject body = part.optJSONObject("body");
        String data = body == null ? "" : body.optString("data");
        if (data.isEmpty()) return;
        int slot = mime.startsWith("text/plain") ? 0 : mime.startsWith("text/html") ? 1 : -1;
        if (slot < 0 || out[slot] != null) return;
        try {
            out[slot] = new String(Base64.decode(data, Base64.URL_SAFE), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            // Malformed part: skip it.
        }
    }

    private static JSONObject get(Context c, String token, String path) throws IOException, JSONException {
        HttpURLConnection conn = (HttpURLConnection) new URL(API + path).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("Authorization", "Bearer " + token);
        try {
            int code = conn.getResponseCode();
            if (code == 401) GmailAccess.invalidate(c, token);
            if (code != 200) throw new IOException("Gmail " + code);
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[8192];
                int n;
                while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                return new JSONObject(buf.toString("UTF-8"));
            }
        } finally {
            conn.disconnect();
        }
    }

    private static List<String> loadSeen(SharedPreferences p) {
        List<String> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(p.getString(KEY_SEEN, "[]"));
            for (int i = 0; i < a.length(); i++) out.add(a.getString(i));
        } catch (JSONException ignored) {
            // Start over.
        }
        return out;
    }

    private static void saveSeen(SharedPreferences p, List<String> seen) {
        JSONArray a = new JSONArray();
        for (int i = Math.max(0, seen.size() - MAX_SEEN); i < seen.size(); i++) a.put(seen.get(i));
        p.edit().putString(KEY_SEEN, a.toString()).apply();
    }
}
