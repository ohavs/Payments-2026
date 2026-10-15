package com.ohavs.payments.widget;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Saves from the widget as the signed-in user. Call off the main thread. */
final class WidgetSaver {
    enum Result { SAVED, OFFLINE, SIGNED_OUT, DENIED }

    private WidgetSaver() {}

    private static String idToken(Context c, boolean force) throws IOException, FirestoreRest.AuthException {
        JSONObject t = WidgetStore.token(c);
        if (!force && !t.optString("idToken").isEmpty() && t.optLong("expiresAt") > System.currentTimeMillis()) {
            return t.optString("idToken");
        }
        JSONObject cfg = WidgetStore.config(c);
        FirestoreRest.Token fresh = FirestoreRest.refresh(new FirestoreRest.Endpoints(), cfg.optString("apiKey"), cfg.optString("refreshToken"));
        WidgetStore.setToken(c, fresh);
        return fresh.idToken;
    }

    /** The expense document, as the app's addItem() writes it. */
    static JSONObject item(Context c, String category, double amount) throws JSONException {
        String uid = WidgetStore.config(c).optString("uid");
        return new JSONObject()
            .put("title", "")
            .put("group", category)
            .put("amount", amount)
            .put("note", "")
            .put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()))
            .put("source", "widget")
            .put("paidBy", uid)
            .put("addedBy", uid);
    }

    static synchronized Result saveItem(Context c, String listId, JSONObject item) {
        // Anything saved offline earlier goes first.
        JSONArray pending = WidgetStore.takePending(c);
        Result r = Result.SAVED;
        for (int i = 0; i <= pending.length(); i++) {
            String id = i < pending.length() ? pending.optJSONObject(i).optString("listId") : listId;
            JSONObject it = i < pending.length() ? pending.optJSONObject(i).optJSONObject("item") : item;
            if (r != Result.SAVED) { WidgetStore.addPending(c, id, it); continue; }
            r = write(c, id, it, false);
            if (r == Result.DENIED && i < pending.length()) r = Result.SAVED; // drop an old one that can't be saved
            if (r == Result.OFFLINE || r == Result.SIGNED_OUT) WidgetStore.addPending(c, id, it);
        }
        return r;
    }

    private static Result write(Context c, String listId, JSONObject item, boolean retried) {
        String projectId = WidgetStore.config(c).optString("projectId");
        try {
            FirestoreRest.addItem(new FirestoreRest.Endpoints(), projectId, idToken(c, retried), listId, item);
            return Result.SAVED;
        } catch (FirestoreRest.AuthException e) {
            // An expired cached token: refresh once.
            return retried ? Result.SIGNED_OUT : write(c, listId, item, true);
        } catch (FirestoreRest.DeniedException e) {
            return Result.DENIED;
        } catch (IOException e) {
            return Result.OFFLINE;
        }
    }

    static Result addGroup(Context c, String listId, String group) {
        WidgetStore.addGroup(c, listId, group);
        String projectId = WidgetStore.config(c).optString("projectId");
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                FirestoreRest.addGroup(new FirestoreRest.Endpoints(), projectId, idToken(c, attempt > 0), listId, group);
                return Result.SAVED;
            } catch (FirestoreRest.AuthException e) {
                if (attempt > 0) return Result.SIGNED_OUT;
            } catch (FirestoreRest.DeniedException e) {
                return Result.DENIED;
            } catch (IOException e) {
                return Result.OFFLINE;
            }
        }
        return Result.SIGNED_OUT;
    }
}
