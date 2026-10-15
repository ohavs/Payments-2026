package com.ohavs.payments.widget;

import android.app.Activity;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.FrameLayout;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

/**
 * CI only (not exported; started with adb as root after
 * `cmd appwidget grantbind`): hosts the widget like a launcher so the emulator
 * run can tap it and take screenshots. Without that grant it just closes.
 */
public class WidgetPreviewActivity extends Activity {
    private static final int HOST_ID = 0x57494447;
    private AppWidgetHost host;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        // config64: the synced config as base64 JSON (adb can't pass Hebrew and quotes).
        String config = getIntent().getStringExtra("config64");
        if (config != null) {
            try {
                WidgetStore.setConfig(this, new JSONObject(new String(Base64.decode(config, Base64.DEFAULT), StandardCharsets.UTF_8)));
            } catch (JSONException ignored) {
                // Keep the current config.
            }
        }
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        ComponentName provider = new ComponentName(this, QuickAddWidget.class);
        host = new AppWidgetHost(this, HOST_ID);
        int id = host.allocateAppWidgetId();
        if (!m.bindAppWidgetIdIfAllowed(id, provider)) {
            host.deleteAppWidgetId(id);
            finish();
            return;
        }
        AppWidgetProviderInfo info = m.getAppWidgetInfo(id);
        AppWidgetHostView view = host.createView(getApplicationContext(), id, info);
        int w = dp(getIntent().getIntExtra("widthDp", 360));
        int h = dp(getIntent().getIntExtra("heightDp", 360));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#7FA4C9"));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(w, h, Gravity.CENTER);
        root.addView(view, lp);
        setContentView(root);
        QuickAddWidget.render(this, m, id);
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (host != null) host.startListening();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (host != null) host.stopListening();
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
