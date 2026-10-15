package com.ohavs.payments.widget;

import android.appwidget.AppWidgetManager;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.ohavs.payments.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * "קטגוריה חדשה" from the widget (a widget can't hold a text field): a sheet
 * over the home screen with a live sticker preview. Adds the category to the
 * space and picks it; with an amount already typed it saves the expense too.
 */
public class NewCategoryActivity extends AppCompatActivity {
    private int widgetId;
    private JSONObject space;
    private String amount;
    private EditText name;
    private TextView add;
    private boolean busy;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        JSONObject state = WidgetStore.state(this, widgetId);
        space = WidgetStore.space(this, state.optString("spaceId"));
        amount = state.optString("amount");
        if (space == null || !WidgetStore.signedIn(this)) {
            Toast.makeText(this, "פתחו את האפליקציה כדי להתחבר", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        setContentView(R.layout.activity_new_category);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE
            | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        ((TextView) findViewById(R.id.subtitle)).setText("תתווסף למרחב " + QuickAddWidget.spaceLabel(this, space));
        name = findViewById(R.id.name);
        add = findViewById(R.id.add);
        findViewById(R.id.scrim).setOnClickListener(v -> finish());
        add.setOnClickListener(v -> submit());
        name.setOnEditorActionListener((v, actionId, e) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) { submit(); return true; }
            return false;
        });
        name.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) { preview(); }
        });
        preview();
        name.requestFocus();
    }

    private void preview() {
        String n = name.getText().toString().trim();
        CategoryStyle st = CategoryStyle.of(n);
        ((ImageView) findViewById(R.id.tint)).setColorFilter(getColor(n.isEmpty() ? R.color.w_surface_2 : CategoryListService.tintRes(st.tint)));
        ImageView sticker = findViewById(R.id.sticker);
        TextView letter = findViewById(R.id.letter);
        if (n.isEmpty() || st.icon == null) {
            sticker.setVisibility(View.GONE);
            letter.setVisibility(View.VISIBLE);
            letter.setText(n.isEmpty() ? "+" : st.letter);
        } else {
            sticker.setImageResource(CategoryListService.iconRes(st.icon));
            sticker.setVisibility(View.VISIBLE);
            letter.setVisibility(View.GONE);
        }
        boolean ready = !n.isEmpty() && !busy;
        add.setEnabled(ready);
        add.setBackgroundResource(ready ? R.drawable.widget_btn_primary : R.drawable.widget_btn_disabled);
        add.setTextColor(getColor(ready ? R.color.w_accent_fg : R.color.w_ink_dim));
        double value = AmountInput.value(amount);
        add.setText(busy ? "שומר…" : value > 0
            ? "הוסף ושמור · " + QuickAddWidget.currency(this) + AmountInput.format(amount) : "הוסף");
    }

    private void submit() {
        String n = name.getText().toString().trim();
        if (n.isEmpty() || busy) return;
        busy = true;
        preview();
        String listId = space.optString("id");
        double value = AmountInput.value(amount);
        new Thread(() -> {
            WidgetSaver.Result r = exists(n) ? WidgetSaver.Result.SAVED : WidgetSaver.addGroup(this, listId, n);
            WidgetSaver.Result saved = null;
            if (r != WidgetSaver.Result.DENIED && r != WidgetSaver.Result.SIGNED_OUT && value > 0) {
                try {
                    saved = WidgetSaver.saveItem(this, listId, WidgetSaver.item(this, n, value));
                } catch (JSONException ignored) {
                    saved = WidgetSaver.Result.OFFLINE;
                }
            }
            final WidgetSaver.Result fr = r;
            final WidgetSaver.Result fs = saved;
            runOnUiThread(() -> done(n, value, fr, fs));
        }, "widget-category").start();
    }

    private boolean exists(String n) {
        JSONArray groups = space.optJSONArray("groups");
        if (groups != null) for (int i = 0; i < groups.length(); i++) if (n.equals(groups.optString(i))) return true;
        return false;
    }

    private void done(String n, double value, WidgetSaver.Result added, WidgetSaver.Result saved) {
        if (added == WidgetSaver.Result.SIGNED_OUT || added == WidgetSaver.Result.DENIED) {
            busy = false;
            preview();
            Toast.makeText(this, added == WidgetSaver.Result.DENIED ? "אין גישה למרחב הזה" : "צריך להתחבר מחדש באפליקציה", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            JSONObject s = WidgetStore.state(this, widgetId);
            s.put("spaceId", space.optString("id"));
            if (saved == null) {
                s.put("category", n);
                s.remove("status");
            } else {
                s.put("amount", "");
                s.put("category", "");
                s.put("status", saved == WidgetSaver.Result.SAVED
                    ? "נשמר ✓ " + QuickAddWidget.currency(this) + AmountInput.format(value) + " · " + n
                    : "אין חיבור · יישמר כשיחזור ✓");
            }
            WidgetStore.setState(this, widgetId, s);
        } catch (JSONException ignored) {
            // The widget keeps its previous state.
        }
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        QuickAddWidget.render(this, m, widgetId);
        m.notifyAppWidgetViewDataChanged(widgetId, R.id.categories);
        finish();
    }
}
