package com.ohavs.payments.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.ArrayMap;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import com.ohavs.payments.AppActivity;
import com.ohavs.payments.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
                putStatus(c, next, r, amount, category);
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

    // Layouts. On Android 12+ each size the launcher reports gets its own,
    // picked and measured for that size so the keys stay close to square;
    // older launchers report a min/max size and get the layout for it.
    private static final int SMALL = 0, MEDIUM = 1, LARGE = 2, WIDE = 3;
    private static final int[] LAYOUTS = {
        R.layout.widget_quick_add_small, R.layout.widget_quick_add_medium,
        R.layout.widget_quick_add, R.layout.widget_quick_add_wide,
    };
    // Fallbacks (dp) for a launcher that reports no sizes: the host shows the
    // closest one that fits, with the XML's default keypad width.
    private static final float[][] FALLBACK = {{150f, 140f}, {200f, 230f}, {290f, 270f}, {280f, 140f}};
    // From the XML (dp): height taken by everything but the keypad, the
    // horizontal padding, the gap between keys, and the wide panel's minimum.
    private static final float[] CHROME_H = {72f, 128f, 153f, 24f};
    private static final float[] PAD_W = {20f, 24f, 24f, 24f};
    private static final float[] GAP = {4f, 5f, 5f, 5f};
    private static final float WIDE_PANEL = 120f;
    // Widest a key may get, as a multiple of its height.
    private static final float MAX_KEY_RATIO = 1.7f, WIDE_KEY_RATIO = 1.3f;

    static void render(Context c, AppWidgetManager m, int id) {
        if (!WidgetStore.signedIn(c)) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_signed_out);
            v.setOnClickPendingIntent(R.id.root, openApp(c));
            m.updateAppWidget(id, v);
            return;
        }
        Bundle options = m.getAppWidgetOptions(id);
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> bySize = new ArrayMap<>();
            for (int l = SMALL; l <= WIDE; l++) {
                bySize.put(new SizeF(FALLBACK[l][0], FALLBACK[l][1]), build(c, id, l, 0, 0));
            }
            for (SizeF s : reportedSizes(options)) {
                float w = s.getWidth(), h = s.getHeight();
                // A little under the reported size, so it still fits if the
                // host measures a dp or two less.
                bySize.put(new SizeF(Math.max(1f, w - 2f), Math.max(1f, h - 2f)), build(c, id, layoutFor(w, h), w, h));
            }
            m.updateAppWidget(id, new RemoteViews(bySize));
        } else {
            // Portrait: the narrowest width and the tallest height.
            float w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 300);
            float h = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 300);
            m.updateAppWidget(id, build(c, id, layoutFor(w, h), 0, 0));
        }
    }

    /** The sizes the launcher shows the widget at (dp), at most 12. */
    @SuppressWarnings("deprecation")
    private static List<SizeF> reportedSizes(Bundle o) {
        List<SizeF> out = new ArrayList<>();
        ArrayList<SizeF> sizes = o.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
        if (sizes != null) {
            for (SizeF s : sizes) {
                if (s != null && s.getWidth() > 0 && s.getHeight() > 0 && out.size() < 12) out.add(s);
            }
        }
        if (out.isEmpty()) {
            int minW = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH), maxW = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH);
            int minH = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT), maxH = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
            if (minW > 0 && maxH > 0) out.add(new SizeF(minW, maxH));
            if (maxW > 0 && minH > 0 && (maxW != minW || maxH != minH)) out.add(new SizeF(maxW, minH));
        }
        return out;
    }

    private static float keyH(int layout, float h) {
        return (h - CHROME_H[layout] - 3 * GAP[layout]) / 4f;
    }

    /**
     * The layout for a widget of w×h dp. The large one (with the category
     * list) when it fits; otherwise the one whose keys come out least
     * stretched: wide and short gets the keypad beside the rest.
     */
    static int layoutFor(float w, float h) {
        if (w >= FALLBACK[LARGE][0] && h >= FALLBACK[LARGE][1]) return LARGE;
        float mediumKeyW = (w - PAD_W[MEDIUM] - 2 * GAP[MEDIUM]) / 3f;
        if (w >= FALLBACK[MEDIUM][0] && h >= FALLBACK[MEDIUM][1] && mediumKeyW <= 2.2f * keyH(MEDIUM, h)) return MEDIUM;
        float wideKeyW = (w - PAD_W[WIDE] - 10f - WIDE_PANEL - 2 * GAP[WIDE]) / 3f;
        if (w >= 260f && wideKeyW >= 0.75f * keyH(WIDE, h)) return WIDE;
        return SMALL;
    }

    /** Keypad width (dp) for a widget of w×h, or 0 to keep the layout's own. */
    static float keypadWidth(int layout, float w, float h) {
        float gap = GAP[layout], keyH = keyH(layout, h);
        switch (layout) {
            case WIDE: {
                float room = w - PAD_W[WIDE] - 10f - WIDE_PANEL;
                float keyW = Math.min((room - 2 * gap) / 3f, WIDE_KEY_RATIO * keyH);
                return Math.max(3 * keyW + 2 * gap, Math.min(room, 110f));
            }
            case LARGE: {
                float half = (w - PAD_W[LARGE] - 8f) / 2f;
                float keyW = Math.min((half - 2 * gap) / 3f, MAX_KEY_RATIO * keyH);
                return Math.max(3 * keyW + 2 * gap, Math.min(half, 120f));
            }
            default: {
                // Small and medium: the keypad spans the width unless that
                // stretches the keys; then it narrows and centres.
                float full = w - PAD_W[layout];
                float keyW = (full - 2 * gap) / 3f;
                if (keyH <= 0 || keyW <= MAX_KEY_RATIO * keyH) return 0;
                return 3 * MAX_KEY_RATIO * keyH + 2 * gap;
            }
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        render(c, m, id);
    }

    /** The layout for size (SMALL..WIDE); w and h (dp) when known, to fit the keypad. */
    private static RemoteViews build(Context c, int id, int size, float w, float h) {
        JSONObject s = WidgetStore.state(c, id);
        JSONObject space = WidgetStore.space(c, s.optString("spaceId"));
        RemoteViews v = new RemoteViews(c.getPackageName(), LAYOUTS[size]);
        // Anywhere that isn't a key or a button opens the app.
        v.setOnClickPendingIntent(R.id.root, openApp(c));
        if (Build.VERSION.SDK_INT >= 31 && w > 0 && h > 0) {
            float keypad = keypadWidth(size, w, h);
            if (keypad > 0) v.setViewLayoutWidth(R.id.keypad, keypad, TypedValue.COMPLEX_UNIT_DIP);
        }

        String amount = s.optString("amount");
        String status = s.optString("status");
        boolean busy = s.optBoolean("busy");
        double value = AmountInput.value(amount);
        String category = s.optString("category");

        if (size == LARGE) {
            v.setTextViewText(R.id.amount, currency(c) + AmountInput.format(amount));
            v.setTextViewText(R.id.status, !status.isEmpty() ? status
                : space == null ? "" : "הוצאה חדשה · " + spaceLabel(c, space));
        } else if (amount.isEmpty() && !status.isEmpty()) {
            // Compact sizes: the last save, in short, in place of the empty
            // amount; the medium and wide save bars have room for all of it.
            v.setTextViewText(R.id.amount, s.optString("statusShort", status));
        } else {
            v.setTextViewText(R.id.amount, currency(c) + AmountInput.format(amount));
        }
        v.setTextColor(R.id.amount, c.getColor(amount.isEmpty() ? R.color.w_ink_dim : R.color.w_ink));

        for (int i = 0; i < KEY_IDS.length; i++) {
            v.setOnClickPendingIntent(KEY_IDS[i], broadcast(c, id, ACTION_KEY, "key/" + KEYS[i], KEYS[i]));
        }

        if (size == LARGE) {
            // The space switch, only when there is more than one.
            boolean many = WidgetStore.spaces(c).length() > 1;
            v.setViewVisibility(R.id.space, many ? View.VISIBLE : View.GONE);
            if (space != null) v.setTextViewText(R.id.space_name, spaceLabel(c, space));
            v.setOnClickPendingIntent(R.id.space, broadcast(c, id, ACTION_SPACE, "space", null));

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
            v.setOnClickPendingIntent(R.id.new_category, sheet(c, id, true));
        } else {
            // The category "dropdown": the picked one, or a prompt; opens the sheet.
            v.setOnClickPendingIntent(R.id.category_chip, sheet(c, id, false));
            CategoryStyle st = CategoryStyle.of(category);
            boolean none = category.isEmpty();
            v.setInt(R.id.chip_tint, "setColorFilter", c.getColor(none ? R.color.w_surface_3 : CategoryListService.tintRes(st.tint)));
            if (!none && st.icon != null) {
                v.setImageViewResource(R.id.chip_sticker, CategoryListService.iconRes(st.icon));
                v.setViewVisibility(R.id.chip_sticker, View.VISIBLE);
                v.setViewVisibility(R.id.chip_letter, View.GONE);
            } else {
                v.setTextViewText(R.id.chip_letter, none ? "?" : st.letter);
                v.setViewVisibility(R.id.chip_sticker, View.GONE);
                v.setViewVisibility(R.id.chip_letter, View.VISIBLE);
            }
            if (size == MEDIUM || size == WIDE) v.setTextViewText(R.id.chip_name, none ? "קטגוריה" : category);
        }

        // Save: enabled once there is an amount and a category.
        boolean ready = value > 0 && !category.isEmpty() && !busy;
        v.setInt(R.id.save, "setBackgroundResource", ready ? WidgetTheme.primary(c) : R.drawable.widget_btn_disabled);
        v.setTextColor(R.id.save, c.getColor(ready ? R.color.w_accent_fg : R.color.w_ink_dim));
        if (size != SMALL) {
            v.setTextViewText(R.id.save, busy ? "שומר…"
                : value <= 0 && size != LARGE && !status.isEmpty() ? status
                : value <= 0 ? "הקלידו סכום"
                : category.isEmpty() ? "בחרו קטגוריה"
                : "שמור · " + currency(c) + AmountInput.format(amount));
        } else {
            v.setTextViewText(R.id.save, busy ? "…" : "✓");
        }
        // Without a category yet, save opens the picker (which then saves).
        v.setOnClickPendingIntent(R.id.save, value > 0 && category.isEmpty()
            ? sheet(c, id, false) : broadcast(c, id, ACTION_SAVE, "save", null));
        return v;
    }

    /** What a save did, in full (large widget, save bar) and short (compact amount line). */
    static void putStatus(Context c, JSONObject s, WidgetSaver.Result r, double amount, String category) throws JSONException {
        String label = currency(c) + AmountInput.format(amount) + " · " + category;
        switch (r) {
            case SAVED: s.put("status", "נשמר ✓ " + label).put("statusShort", "נשמר ✓"); break;
            case OFFLINE: s.put("status", "אין חיבור · יישמר כשיחזור ✓").put("statusShort", "ממתין ✓"); break;
            case SIGNED_OUT: s.put("status", "יישמר אחרי כניסה באפליקציה").put("statusShort", "ממתין ✓"); break;
            default: s.put("status", "אין גישה למרחב הזה").put("statusShort", "אין גישה");
        }
    }

    /** The space's label: "אישי" or the shared space's name (from the app, which knows the rest). */
    static String spaceLabel(Context c, JSONObject space) {
        String label = space.optString("label");
        if (!label.isEmpty()) return label;
        String name = space.optString("name");
        if (space.optBoolean("shared")) return name.isEmpty() ? "משותף" : name;
        return "אישי";
    }

    private static PendingIntent sheet(Context c, int id, boolean newCategory) {
        Intent i = new Intent(c, CategorySheetActivity.class)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .putExtra(CategorySheetActivity.EXTRA_NEW, newCategory)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
            .setData(Uri.parse("payments-widget://" + id + "/sheet/" + (newCategory ? "new" : "pick")));
        return PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent broadcast(Context c, int id, String action, String path, String key) {
        Intent i = new Intent(c, QuickAddWidget.class).setAction(action)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .setData(Uri.parse("payments-widget://" + id + "/" + path));
        if (key != null) i.putExtra(EXTRA_KEY, key);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, AppActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
