package com.ohavs.payments.widget;

import android.appwidget.AppWidgetManager;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.res.ResourcesCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.ohavs.payments.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The widget's category sheet over the home screen: pick the space and the
 * category (the compact widget sizes open it as a dropdown), or type a new
 * category (a widget can't hold a text field). With an amount already typed,
 * picking a category saves the expense right away. The sheet rides above the
 * keyboard.
 */
public class CategorySheetActivity extends AppCompatActivity {
    static final String EXTRA_NEW = "newCategory";

    private int widgetId;
    private JSONObject space;
    private String amount;
    private String selected;
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
        selected = state.optString("category");
        if (space == null || !WidgetStore.signedIn(this)) {
            Toast.makeText(this, "פתחו את האפליקציה כדי להתחבר", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        boolean focusNew = getIntent().getBooleanExtra(EXTRA_NEW, false);
        setContentView(R.layout.activity_category_sheet);

        // Edge to edge: the sheet pads itself above the keyboard / nav bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        // adjustResize so older Androids report the keyboard as an inset too.
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE | (focusNew
            ? WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE : WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN));
        View sheet = findViewById(R.id.sheet);
        int base = sheet.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(sheet, (v, insets) -> {
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            v.setPadding(v.getPaddingLeft(), v.getPaddingTop(), v.getPaddingRight(), base + Math.max(ime.bottom, bars.bottom));
            return insets;
        });

        findViewById(R.id.scrim).setOnClickListener(v -> finish());
        name = findViewById(R.id.name);
        add = findViewById(R.id.add);
        add.setOnClickListener(v -> submitNew());
        name.setOnEditorActionListener((v, actionId, e) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) { submitNew(); return true; }
            return false;
        });
        name.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) { previewNew(); }
        });

        showSpace();
        previewNew();
        if (focusNew) {
            name.requestFocus();
        }
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private boolean hasAmount() {
        return AmountInput.value(amount) > 0;
    }

    private String amountLabel() {
        return QuickAddWidget.currency(this) + AmountInput.format(amount);
    }

    // ---------- Space and categories ----------

    private void showSpace() {
        ((TextView) findViewById(R.id.title)).setText(hasAmount() ? amountLabel() + " · על מה?" : "קטגוריה");
        ((TextView) findViewById(R.id.subtitle)).setText(hasAmount()
            ? "בחירה שומרת את ההוצאה ב" + QuickAddWidget.spaceLabel(this, space)
            : "למרחב " + QuickAddWidget.spaceLabel(this, space));
        showSpaces();
        showGrid();
    }

    private void showSpaces() {
        LinearLayout row = findViewById(R.id.spaces);
        row.removeAllViews();
        JSONArray all = WidgetStore.spaces(this);
        findViewById(R.id.spaces_scroll).setVisibility(all.length() > 1 ? View.VISIBLE : View.GONE);
        for (int i = 0; i < all.length(); i++) {
            JSONObject s = all.optJSONObject(i);
            if (s == null) continue;
            boolean on = s.optString("id").equals(space.optString("id"));
            TextView pill = new TextView(this);
            pill.setText(QuickAddWidget.spaceLabel(this, s));
            pill.setTypeface(ResourcesCompat.getFont(this, R.font.rubik_extrabold));
            pill.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            pill.setTextColor(getColor(on ? R.color.w_on_ink : R.color.w_ink));
            pill.setBackgroundResource(on ? R.drawable.widget_pill_ink : R.drawable.widget_pill);
            pill.setPadding(dp(16), dp(9), dp(16), dp(9));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.setMarginEnd(dp(8));
            pill.setLayoutParams(lp);
            pill.setOnClickListener(v -> {
                if (busy || on) return;
                space = s;
                if (!groups().contains(selected)) selected = "";
                saveState(selected, null, 0);
                showSpace();
            });
            row.addView(pill);
        }
    }

    private java.util.List<String> groups() {
        java.util.List<String> out = new java.util.ArrayList<>();
        JSONArray g = space.optJSONArray("groups");
        if (g != null) for (int i = 0; i < g.length(); i++) if (!g.optString(i).isEmpty()) out.add(g.optString(i));
        return out;
    }

    private void showGrid() {
        GridLayout grid = findViewById(R.id.grid);
        grid.removeAllViews();
        LayoutInflater inf = LayoutInflater.from(this);
        for (String g : groups()) {
            View tile = inf.inflate(R.layout.widget_sheet_tile, grid, false);
            ((TextView) tile.findViewById(R.id.name)).setText(g);
            badge(tile.findViewById(R.id.tint), tile.findViewById(R.id.sticker), tile.findViewById(R.id.letter), g);
            tile.setBackgroundResource(g.equals(selected) ? R.drawable.widget_row_selected : R.drawable.widget_row);
            tile.setOnClickListener(v -> pick(g));
            grid.addView(tile);
        }
        // At most about three rows; the rest scrolls.
        ScrollView sv = findViewById(R.id.grid_scroll);
        int rows = (groups().size() + 2) / 3;
        ViewGroup.LayoutParams lp = sv.getLayoutParams();
        lp.height = rows > 3 ? dp(3 * 98 + 20) : ViewGroup.LayoutParams.WRAP_CONTENT;
        sv.setLayoutParams(lp);
    }

    private void badge(ImageView tint, ImageView sticker, TextView letter, String category) {
        CategoryStyle st = CategoryStyle.of(category);
        boolean empty = category.trim().isEmpty();
        tint.setColorFilter(getColor(empty ? R.color.w_surface_2 : CategoryListService.tintRes(st.tint)));
        if (empty || st.icon == null) {
            sticker.setVisibility(View.GONE);
            letter.setVisibility(View.VISIBLE);
            letter.setText(empty ? "+" : st.letter);
        } else {
            sticker.setImageResource(CategoryListService.iconRes(st.icon));
            sticker.setVisibility(View.VISIBLE);
            letter.setVisibility(View.GONE);
        }
    }

    // ---------- Picking ----------

    private void pick(String category) {
        if (busy) return;
        if (!hasAmount()) {
            saveState(category, null, 0);
            refreshWidget();
            finish();
            return;
        }
        save(category, false);
    }

    /** Saves the typed amount under the category (adding it to the space first when new). */
    private void save(String category, boolean isNew) {
        busy = true;
        previewNew();
        String listId = space.optString("id");
        double value = AmountInput.value(amount);
        new Thread(() -> {
            WidgetSaver.Result added = isNew ? WidgetSaver.addGroup(this, listId, category) : WidgetSaver.Result.SAVED;
            WidgetSaver.Result saved = null;
            if (added != WidgetSaver.Result.DENIED && added != WidgetSaver.Result.SIGNED_OUT && value > 0) {
                try {
                    saved = WidgetSaver.saveItem(this, listId, WidgetSaver.item(this, category, value));
                } catch (JSONException e) {
                    saved = WidgetSaver.Result.OFFLINE;
                }
            }
            final WidgetSaver.Result a = added;
            final WidgetSaver.Result s = saved;
            runOnUiThread(() -> done(category, value, a, s));
        }, "widget-category").start();
    }

    private void done(String category, double value, WidgetSaver.Result added, WidgetSaver.Result saved) {
        if (added == WidgetSaver.Result.SIGNED_OUT || added == WidgetSaver.Result.DENIED) {
            busy = false;
            previewNew();
            Toast.makeText(this, added == WidgetSaver.Result.DENIED ? "אין גישה למרחב הזה" : "צריך להתחבר מחדש באפליקציה", Toast.LENGTH_LONG).show();
            return;
        }
        if (saved == null) {
            saveState(category, null, 0);
        } else {
            saveState(category, saved, value);
        }
        refreshWidget();
        finish();
    }

    /** saved null: just the choice; otherwise what saving did, and the amount is cleared. */
    private void saveState(String category, WidgetSaver.Result saved, double value) {
        try {
            JSONObject s = WidgetStore.state(this, widgetId);
            s.put("spaceId", space.optString("id"));
            s.put("category", saved == null ? category : "");
            if (saved == null) {
                s.remove("status");
                s.remove("statusShort");
            } else {
                s.put("amount", "");
                QuickAddWidget.putStatus(this, s, saved, value, category);
            }
            WidgetStore.setState(this, widgetId, s);
        } catch (JSONException ignored) {
            // The widget keeps its previous state.
        }
    }

    private void refreshWidget() {
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        QuickAddWidget.render(this, m, widgetId);
        m.notifyAppWidgetViewDataChanged(widgetId, R.id.categories);
    }

    // ---------- New category ----------

    private void previewNew() {
        String n = name.getText().toString().trim();
        badge(findViewById(R.id.new_tint), findViewById(R.id.new_sticker), findViewById(R.id.new_letter), n);
        boolean show = !n.isEmpty() || busy;
        add.setVisibility(show ? View.VISIBLE : View.GONE);
        boolean ready = !n.isEmpty() && !busy;
        add.setEnabled(ready);
        add.setBackgroundResource(ready ? R.drawable.widget_btn_primary : R.drawable.widget_btn_disabled);
        add.setTextColor(getColor(ready ? R.color.w_accent_fg : R.color.w_ink_dim));
        add.setText(busy ? "שומר…" : hasAmount() ? "הוסף ושמור · " + amountLabel() : "הוסף");
    }

    private void submitNew() {
        String n = name.getText().toString().trim();
        if (n.isEmpty() || busy) return;
        InputMethodManager imm = getSystemService(InputMethodManager.class);
        if (imm != null) imm.hideSoftInputFromWindow(name.getWindowToken(), 0);
        boolean exists = groups().contains(n);
        if (!hasAmount()) {
            busy = true;
            previewNew();
            String listId = space.optString("id");
            new Thread(() -> {
                WidgetSaver.Result r = exists ? WidgetSaver.Result.SAVED : WidgetSaver.addGroup(this, listId, n);
                runOnUiThread(() -> done(n, 0, r, null));
            }, "widget-category").start();
            return;
        }
        save(n, !exists);
    }
}
