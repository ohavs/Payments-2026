package com.ohavs.payments.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import com.ohavs.payments.MainActivity;
import com.ohavs.payments.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Home screen widget: type an amount on the keypad, tap a category (or add
 * one), save. Saves straight to the space in Firestore (WidgetSaver), no need
 * to open the app.
 */
public class QuickAddWidget extends AppWidgetProvider {
    static final String ACTION_KEY = "com.ohavs.payments.widget.KEY";
    static final String ACTION_CATEGORY = "com.ohavs.payments.widget.CATEGORY";
    static final String ACTION_SPACE = "com.ohavs.payments.widget.SPACE";
    static final String ACTION_SAVE = "com.ohavs.payments.widget.SAVE";
    static final String EXTRA_KEY = "key";
    static final String EXTRA_CATEGORY = "category";

    private static final int[] KEY_IDS = {
        R.id.key_0, R.id.key_1, R.id.key_2, R.id.key_3, R.id.key_4, R.id.key_5,
        R.id.key_6, R.id.key_7, R.id.key_8, R.id.key_9, R.id.key_dot, R.id.key_del,
    };
    private static final String[] KEYS = {"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "del"};

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) render(c, m, id);
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        for (int id : ids) WidgetStore.removeState(c, id);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        String action = intent.getAction();
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (action == null || id == AppWidgetManager.INVALID_APPWIDGET_ID) return;
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        JSONObject s = WidgetStore.state(c, id);
        try {
            switch (action) {
                case ACTION_KEY:
                    if (s.optBoolean("busy")) return;
                    s.put("amount", AmountInput.apply(s.optString("amount"), intent.getStringExtra(EXTRA_KEY)));
                    s.remove("status");
                    WidgetStore.setState(c, id, s);
                    render(c, m, id);
                    return;
                case ACTION_CATEGORY: {
                    String cat = intent.getStringExtra(EXTRA_CATEGORY);
                    s.put("category", cat != null && cat.equals(s.optString("category")) ? "" : cat);
                    s.remove("status");
                    WidgetStore.setState(c, id, s);
                    render(c, m, id);
                    m.notifyAppWidgetViewDataChanged(id, R.id.categories);
                    return;
                }
                case ACTION_SPACE:
                    s.put("spaceId", nextSpace(c, s.optString("spaceId")));
                    s.put("category", "");
                    s.remove("status");
                    WidgetStore.setState(c, id, s);
                    render(c, m, id);
                    m.notifyAppWidgetViewDataChanged(id, R.id.categories);
                    return;
                case ACTION_SAVE:
                    save(c, m, id, s);
                    return;
                default:
            }
        } catch (JSONException ignored) {
            // State stays as it was.
        }
    }

    private void save(Context c, AppWidgetManager m, int id, JSONObject s) throws JSONException {
        double amount = AmountInput.value(s.optString("amount"));
        String category = s.optString("category");
        JSONObject space = WidgetStore.space(c, s.optString("spaceId"));
        if (amount <= 0 || category.isEmpty() || space == null || s.optBoolean("busy")) return;
        s.put("busy", true);
        WidgetStore.setState(c, id, s);
        render(c, m, id);

        final JSONObject item = WidgetSaver.item(c, category, amount);
        final String listId = space.optString("id");
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                WidgetSaver.Result r = WidgetSaver.saveItem(c, listId, item);
                JSONObject next = WidgetStore.state(c, id);
                next.put("busy", false);
                String label = currency(c) + AmountInput.format(amount) + " · " + category;
                switch (r) {
                    case SAVED: next.put("status", "נשמר ✓ " + label); break;
                    case OFFLINE: next.put("status", "אין חיבור · יישמר כשיחזור ✓"); break;
                    case SIGNED_OUT: next.put("status", "יישמר אחרי כניסה באפליקציה"); break;
                    default: next.put("status", "אין גישה למרחב הזה");
                }
                if (r != WidgetSaver.Result.DENIED) {
                    next.put("amount", "");
                    next.put("category", "");
                }
                WidgetStore.setState(c, id, next);
                render(c, m, id);
                m.notifyAppWidgetViewDataChanged(id, R.id.categories);
            } catch (JSONException ignored) {
                // Nothing more to show.
            } finally {
                pr.finish();
            }
        }, "widget-save").start();
    }

    private static String nextSpace(Context c, String current) {
        JSONArray all = WidgetStore.spaces(c);
        if (all.length() == 0) return "";
        JSONObject cur = WidgetStore.space(c, current);
        for (int i = 0; i < all.length(); i++) {
            if (cur != null && all.optJSONObject(i).optString("id").equals(cur.optString("id"))) {
                return all.optJSONObject((i + 1) % all.length()).optString("id");
            }
        }
        return all.optJSONObject(0).optString("id");
    }

    static String currency(Context c) {
        String cur = WidgetStore.config(c).optString("currency");
        return cur.isEmpty() ? "₪" : cur;
    }

    /** Called by the app after it synced (sign-in, spaces, categories). */
    public static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, QuickAddWidget.class));
        for (int id : ids) render(c, m, id);
        if (ids.length > 0) m.notifyAppWidgetViewDataChanged(ids, R.id.categories);
    }

    static void render(Context c, AppWidgetManager m, int id) {
        if (!WidgetStore.signedIn(c)) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_signed_out);
            v.setOnClickPendingIntent(R.id.root, openApp(c));
            m.updateAppWidget(id, v);
            return;
        }
        JSONObject s = WidgetStore.state(c, id);
        JSONObject space = WidgetStore.space(c, s.optString("spaceId"));
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quick_add);

        String amount = s.optString("amount");
        v.setTextViewText(R.id.amount, currency(c) + AmountInput.format(amount));
        v.setTextColor(R.id.amount, c.getColor(amount.isEmpty() ? R.color.w_ink_dim : R.color.w_ink));
        String status = s.optString("status");
        v.setTextViewText(R.id.status, !status.isEmpty() ? status
            : space == null ? "" : "הוצאה חדשה · " + spaceLabel(c, space));

        // The space switch, only when there is more than one.
        boolean many = WidgetStore.spaces(c).length() > 1;
        v.setViewVisibility(R.id.space, many ? android.view.View.VISIBLE : android.view.View.GONE);
        if (space != null) v.setTextViewText(R.id.space_name, spaceLabel(c, space));
        v.setOnClickPendingIntent(R.id.space, broadcast(c, id, ACTION_SPACE, "space", null));

        for (int i = 0; i < KEY_IDS.length; i++) {
            v.setOnClickPendingIntent(KEY_IDS[i], broadcast(c, id, ACTION_KEY, "key/" + KEYS[i], KEYS[i]));
        }

        // Categories of the space (RemoteViewsService), tap to pick.
        Intent list = new Intent(c, CategoryListService.class)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        list.setData(Uri.parse("payments-widget://" + id + "/categories"));
        v.setRemoteAdapter(R.id.categories, list);
        Intent pick = new Intent(c, QuickAddWidget.class).setAction(ACTION_CATEGORY)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .setData(Uri.parse("payments-widget://" + id + "/category"));
        int mutable = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
        v.setPendingIntentTemplate(R.id.categories, PendingIntent.getBroadcast(c, id, pick, PendingIntent.FLAG_UPDATE_CURRENT | mutable));

        Intent add = new Intent(c, NewCategoryActivity.class)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
            .setData(Uri.parse("payments-widget://" + id + "/new-category"));
        v.setOnClickPendingIntent(R.id.new_category,
            PendingIntent.getActivity(c, id, add, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        // Save: enabled once there is an amount and a category.
        boolean busy = s.optBoolean("busy");
        double value = AmountInput.value(amount);
        String category = s.optString("category");
        boolean ready = value > 0 && !category.isEmpty() && !busy;
        v.setInt(R.id.save, "setBackgroundResource", ready ? R.drawable.widget_btn_primary : R.drawable.widget_btn_disabled);
        v.setTextColor(R.id.save, c.getColor(ready ? R.color.w_accent_fg : R.color.w_ink_dim));
        v.setTextViewText(R.id.save, busy ? "שומר…"
            : value <= 0 ? "הקלידו סכום"
            : category.isEmpty() ? "בחרו קטגוריה"
            : "שמור · " + currency(c) + AmountInput.format(amount));
        v.setOnClickPendingIntent(R.id.save, broadcast(c, id, ACTION_SAVE, "save", null));

        m.updateAppWidget(id, v);
    }

    static String spaceLabel(Context c, JSONObject space) {
        String name = space.optString("name");
        if (space.optBoolean("shared")) return name.isEmpty() ? "משותף" : name;
        return "אישי";
    }

    private static PendingIntent broadcast(Context c, int id, String action, String path, String key) {
        Intent i = new Intent(c, QuickAddWidget.class).setAction(action)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .setData(Uri.parse("payments-widget://" + id + "/" + path));
        if (key != null) i.putExtra(EXTRA_KEY, key);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
