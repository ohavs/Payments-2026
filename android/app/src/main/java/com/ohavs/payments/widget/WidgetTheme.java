package com.ohavs.payments.widget;

import android.content.Context;

import com.ohavs.payments.R;

/** The app's palette (Settings > מראה, synced in the config) on the widget's accents. */
final class WidgetTheme {
    private WidgetTheme() {}

    private static String palette(Context c) {
        return WidgetStore.config(c).optString("palette", "green");
    }

    /** The save button, ready. */
    static int primary(Context c) {
        switch (palette(c)) {
            case "violet": return R.drawable.widget_btn_primary_violet;
            case "coral": return R.drawable.widget_btn_primary_coral;
            case "ocean": return R.drawable.widget_btn_primary_ocean;
            case "honey": return R.drawable.widget_btn_primary_honey;
            default: return R.drawable.widget_btn_primary;
        }
    }

    /** The picked category. */
    static int selected(Context c) {
        switch (palette(c)) {
            case "violet": return R.drawable.widget_row_selected_violet;
            case "coral": return R.drawable.widget_row_selected_coral;
            case "ocean": return R.drawable.widget_row_selected_ocean;
            case "honey": return R.drawable.widget_row_selected_honey;
            default: return R.drawable.widget_row_selected;
        }
    }
}
