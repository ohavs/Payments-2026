package com.ohavs.payments.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import com.ohavs.payments.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** The categories of the widget's space, with the picked one highlighted. */
public class CategoryListService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(),
            intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID));
    }

    static int tintRes(String tint) {
        switch (tint) {
            case "mint": return R.color.w_mint;
            case "lavender": return R.color.w_lavender;
            case "peach": return R.color.w_peach;
            case "sky": return R.color.w_sky;
            case "butter": return R.color.w_butter;
            case "rose": return R.color.w_rose;
            default: return R.color.w_surface_2;
        }
    }

    static int iconRes(String icon) {
        switch (icon) {
            case "cart": return R.drawable.ic_cat_cart;
            case "shield": return R.drawable.ic_cat_shield;
            case "food": return R.drawable.ic_cat_food;
            case "car": return R.drawable.ic_cat_car;
            case "bolt": return R.drawable.ic_cat_bolt;
            case "house": return R.drawable.ic_cat_house;
            case "heart": return R.drawable.ic_cat_heart;
            case "gift": return R.drawable.ic_cat_gift;
            case "plane": return R.drawable.ic_cat_plane;
            case "bag": return R.drawable.ic_cat_bag;
            default: return R.drawable.ic_cat_box;
        }
    }

    static final class Factory implements RemoteViewsFactory {
        private final Context c;
        private final int widgetId;
        private final List<String> names = new ArrayList<>();
        private String selected = "";

        Factory(Context c, int widgetId) {
            this.c = c;
            this.widgetId = widgetId;
        }

        @Override public void onCreate() {}
        @Override public void onDestroy() {}
        @Override public int getCount() { return names.size(); }
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int position) { return position; }
        @Override public boolean hasStableIds() { return false; }

        @Override
        public void onDataSetChanged() {
            names.clear();
            JSONObject s = WidgetStore.state(c, widgetId);
            selected = s.optString("category");
            JSONObject space = WidgetStore.space(c, s.optString("spaceId"));
            JSONArray groups = space == null ? null : space.optJSONArray("groups");
            if (groups != null) for (int i = 0; i < groups.length(); i++) {
                String g = groups.optString(i);
                if (!g.isEmpty()) names.add(g);
            }
        }

        @Override
        public RemoteViews getViewAt(int position) {
            String name = names.get(position);
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_category_item);
            v.setTextViewText(R.id.name, name);
            CategoryStyle st = CategoryStyle.of(name);
            v.setInt(R.id.tint, "setColorFilter", c.getColor(tintRes(st.tint)));
            if (st.icon != null) {
                v.setImageViewResource(R.id.sticker, iconRes(st.icon));
                v.setViewVisibility(R.id.sticker, View.VISIBLE);
                v.setViewVisibility(R.id.letter, View.GONE);
            } else {
                v.setTextViewText(R.id.letter, st.letter);
                v.setViewVisibility(R.id.sticker, View.GONE);
                v.setViewVisibility(R.id.letter, View.VISIBLE);
            }
            boolean on = name.equals(selected);
            v.setInt(R.id.row, "setBackgroundResource", on ? R.drawable.widget_row_selected : R.drawable.widget_row);
            v.setOnClickFillInIntent(R.id.row, new Intent().putExtra(QuickAddWidget.EXTRA_CATEGORY, name));
            return v;
        }
    }
}
