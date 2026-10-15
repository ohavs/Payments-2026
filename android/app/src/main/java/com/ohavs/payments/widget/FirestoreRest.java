package com.ohavs.payments.widget;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Iterator;

/**
 * The widget saves straight to Firestore over REST, signed in as the app's
 * user: the app hands over the Firebase refresh token (WidgetBridgePlugin),
 * which is exchanged here for a short-lived ID token. The writes are the same
 * documents the app writes, under the same security rules. Plain Java and
 * org.json, so it also runs against the emulators on the JVM.
 */
public final class FirestoreRest {

    /** Sign-in no longer valid (signed out elsewhere, account removed): open the app. */
    public static final class AuthException extends Exception {
        AuthException(String m) { super(m); }
    }

    /** Firestore refused the write (e.g. no longer a member of the space). */
    public static final class DeniedException extends Exception {
        DeniedException(String m) { super(m); }
    }

    public static final class Endpoints {
        public String token = "https://securetoken.googleapis.com";
        public String firestore = "https://firestore.googleapis.com";
    }

    public static final class Token {
        public String idToken;
        public String refreshToken;
        public long expiresAt;
    }

    // Identify the app to Google: the API key may be limited to the app.
    private static final String REFERER = "https://localhost/";
    private static final String PACKAGE = "com.ohavs.payments";
    private static final String CERT_SHA1 = "F74890ADF80ADDBC50E425588A9074199183AEBA";

    private FirestoreRest() {}

    public static Token refresh(Endpoints e, String apiKey, String refreshToken) throws IOException, AuthException {
        String body = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refreshToken, "UTF-8");
        Response r = send("POST", e.token + "/v1/token?key=" + URLEncoder.encode(apiKey, "UTF-8"), null,
            "application/x-www-form-urlencoded", body);
        if (r.code == 400 || r.code == 401 || r.code == 403) throw new AuthException(r.body);
        if (r.code != 200) throw new IOException("token " + r.code);
        try {
            JSONObject o = new JSONObject(r.body);
            Token t = new Token();
            t.idToken = o.getString("id_token");
            t.refreshToken = o.optString("refresh_token", refreshToken);
            t.expiresAt = System.currentTimeMillis() + Math.max(60, o.optLong("expires_in", 3600) - 120) * 1000L;
            return t;
        } catch (JSONException x) {
            throw new IOException(x);
        }
    }

    /** Adds an expense to lists/{listId}/items; returns the new document id. */
    public static String addItem(Endpoints e, String projectId, String idToken, String listId, JSONObject item)
        throws IOException, AuthException, DeniedException {
        String id = autoId();
        try {
            JSONObject body = commitBody(projectId, listId, id, item);
            check(send("POST", e.firestore + "/v1/" + db(projectId) + "/documents:commit", idToken, "application/json", body.toString()));
        } catch (JSONException x) {
            throw new IOException(x);
        }
        return id;
    }

    /** Adds a category to the space, like arrayUnion: keeps any added meanwhile elsewhere. */
    public static void addGroup(Endpoints e, String projectId, String idToken, String listId, String group)
        throws IOException, AuthException, DeniedException {
        try {
            JSONObject body = groupBody(projectId, listId, group);
            check(send("POST", e.firestore + "/v1/" + db(projectId) + "/documents:commit", idToken, "application/json", body.toString()));
        } catch (JSONException x) {
            throw new IOException(x);
        }
    }

    // ---------- Request bodies (unit tested) ----------

    static JSONObject commitBody(String projectId, String listId, String docId, JSONObject item) throws JSONException {
        JSONObject fields = new JSONObject();
        Iterator<String> keys = item.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            fields.put(k, value(item.get(k)));
        }
        JSONObject write = new JSONObject()
            .put("update", new JSONObject()
                .put("name", db(projectId) + "/documents/lists/" + listId + "/items/" + docId)
                .put("fields", fields))
            .put("currentDocument", new JSONObject().put("exists", false))
            .put("updateTransforms", new JSONArray().put(new JSONObject()
                .put("fieldPath", "createdAt").put("setToServerValue", "REQUEST_TIME")));
        return new JSONObject().put("writes", new JSONArray().put(write));
    }

    static JSONObject groupBody(String projectId, String listId, String group) throws JSONException {
        JSONObject write = new JSONObject()
            .put("transform", new JSONObject()
                .put("document", db(projectId) + "/documents/lists/" + listId)
                .put("fieldTransforms", new JSONArray().put(new JSONObject()
                    .put("fieldPath", "groups")
                    .put("appendMissingElements", new JSONObject().put("values",
                        new JSONArray().put(new JSONObject().put("stringValue", group)))))))
            .put("currentDocument", new JSONObject().put("exists", true));
        return new JSONObject().put("writes", new JSONArray().put(write));
    }

    /** A JS value as the app's SDK stores it: whole numbers as integers. */
    static JSONObject value(Object v) throws JSONException {
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (d == Math.rint(d) && Math.abs(d) < 1e15) return new JSONObject().put("integerValue", String.valueOf((long) d));
            return new JSONObject().put("doubleValue", d);
        }
        if (v instanceof Boolean) return new JSONObject().put("booleanValue", v);
        if (v == null || v == JSONObject.NULL) return new JSONObject().put("nullValue", JSONObject.NULL);
        return new JSONObject().put("stringValue", String.valueOf(v));
    }

    private static String db(String projectId) {
        return "projects/" + projectId + "/databases/(default)";
    }

    static String autoId() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom r = new SecureRandom();
        StringBuilder b = new StringBuilder(20);
        for (int i = 0; i < 20; i++) b.append(chars.charAt(r.nextInt(chars.length())));
        return b.toString();
    }

    // ---------- HTTP ----------

    private static final class Response {
        final int code;
        final String body;
        Response(int code, String body) { this.code = code; this.body = body; }
    }

    private static void check(Response r) throws IOException, AuthException, DeniedException {
        if (r.code == 200) return;
        if (r.code == 401) throw new AuthException(r.body);
        if (r.code == 403 || r.code == 404) throw new DeniedException(r.body);
        throw new IOException("firestore " + r.code + " " + r.body);
    }

    private static Response send(String method, String url, String bearer, String contentType, String body) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setRequestProperty("Referer", REFERER);
        c.setRequestProperty("X-Android-Package", PACKAGE);
        c.setRequestProperty("X-Android-Cert", CERT_SHA1);
        if (bearer != null) c.setRequestProperty("Authorization", "Bearer " + bearer);
        try {
            if (body != null) {
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", contentType + "; charset=utf-8");
                try (OutputStream out = c.getOutputStream()) {
                    out.write(body.getBytes(StandardCharsets.UTF_8));
                }
            }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            if (in != null) {
                try (InputStream s = in) {
                    byte[] chunk = new byte[8192];
                    int n;
                    while ((n = s.read(chunk)) > 0) buf.write(chunk, 0, n);
                }
            }
            return new Response(code, buf.toString("UTF-8"));
        } finally {
            c.disconnect();
        }
    }
}
