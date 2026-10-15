package com.ohavs.payments.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

public class WidgetLogicTest {

    private static String type(String... keys) {
        String a = "";
        for (String k : keys) a = AmountInput.apply(a, k);
        return a;
    }

    @Test
    public void keypadFollowsTheAppsRules() {
        assertEquals("45.9", type("4", "5", ".", "9"));
        assertEquals("0.5", type(".", "5"));
        assertEquals("12.34", type("1", "2", ".", "3", "4", "5"));      // two decimals
        assertEquals("1234567", type("1", "2", "3", "4", "5", "6", "7", "8")); // seven digits
        assertEquals("4", type("4", "5", "del"));
        assertEquals("7", type("0", "7"));
        assertEquals("1.", type("1", ".", "."));
    }

    @Test
    public void widgetSizeGetsKeysThatAreNotStretched() {
        int small = 0, medium = 1, large = 2, wide = 3;
        assertEquals(large, QuickAddWidget.layoutFor(360, 380));
        assertEquals(medium, QuickAddWidget.layoutFor(222, 392));   // 2×3: as it was
        assertEquals(wide, QuickAddWidget.layoutFor(340, 180));     // 4×2: the keypad beside
        assertEquals(wide, QuickAddWidget.layoutFor(330, 240));
        assertEquals(small, QuickAddWidget.layoutFor(180, 200));
        assertEquals(small, QuickAddWidget.layoutFor(150, 140));
        // Wide: keys about square, the panel keeps its room.
        float keypad = QuickAddWidget.keypadWidth(wide, 340, 180);
        float keyW = (keypad - 10) / 3, keyH = (180 - 24 - 15) / 4f;
        assertTrue(keyW / keyH <= 1.31f && keyW / keyH > 0.75f);
        assertTrue(340 - 24 - 10 - keypad >= 120);
        // Medium narrower than the widget only when the keys would stretch.
        assertEquals(0, QuickAddWidget.keypadWidth(medium, 222, 392), 0.01);
        assertTrue(QuickAddWidget.keypadWidth(medium, 300, 260) < 300 - 24);
    }

    @Test
    public void formatsLikeTheApp() {
        assertEquals("0", AmountInput.format(""));
        assertEquals("1,234.5", AmountInput.format("1234.5"));
        assertEquals("12.", AmountInput.format("12."));
        assertEquals("45", AmountInput.format(45.0));
        assertEquals("45.9", AmountInput.format(45.9));
    }

    @Test
    public void categoriesGetTheAppsStickers() {
        assertEquals("cart", CategoryStyle.of("קניות").icon);
        assertEquals("mint", CategoryStyle.of("קניות").tint);
        assertEquals("food", CategoryStyle.of("אוכל בחוץ").icon);
        assertEquals("bolt", CategoryStyle.of("חשבונות").icon);
        assertEquals("house", CategoryStyle.of("בית").icon);
        assertEquals("car", CategoryStyle.of("דלק").icon);
        CategoryStyle custom = CategoryStyle.of("ספורט");
        assertNull(custom.icon);
        assertEquals("ס", custom.letter);
    }

    @Test
    public void unknownCategoryTintMatchesTheAppsHash() {
        // icons.jsx: h = (h * 31 + charCode) >>> 0, FALLBACK[h % 6]
        long h = 0;
        for (char ch : "ספורט".toCharArray()) h = (h * 31 + ch) & 0xFFFFFFFFL;
        String[] tints = {"mint", "lavender", "peach", "sky", "rose", "butter"};
        assertEquals(tints[(int) (h % 6)], CategoryStyle.of("ספורט").tint);
    }

    @Test
    public void expenseIsWrittenLikeTheApp() throws Exception {
        JSONObject item = new JSONObject().put("title", "").put("group", "קניות").put("amount", 45.9)
            .put("paidBy", "u1");
        JSONObject body = FirestoreRest.commitBody("p", "L1", "D1", item);
        JSONObject w = body.getJSONArray("writes").getJSONObject(0);
        assertEquals("projects/p/databases/(default)/documents/lists/L1/items/D1", w.getJSONObject("update").getString("name"));
        JSONObject f = w.getJSONObject("update").getJSONObject("fields");
        assertEquals(45.9, f.getJSONObject("amount").getDouble("doubleValue"), 1e-9);
        assertEquals("קניות", f.getJSONObject("group").getString("stringValue"));
        assertEquals("REQUEST_TIME", w.getJSONArray("updateTransforms").getJSONObject(0).getString("setToServerValue"));
        assertTrue(!w.getJSONObject("currentDocument").getBoolean("exists"));
        // Whole amounts as integers, as the JS SDK stores 120.
        assertEquals("120", FirestoreRest.value(120.0).getString("integerValue"));
    }

    @Test
    public void newCategoryIsAnArrayUnion() throws Exception {
        JSONObject w = FirestoreRest.groupBody("p", "L1", "דלק").getJSONArray("writes").getJSONObject(0);
        JSONObject t = w.getJSONObject("transform").getJSONArray("fieldTransforms").getJSONObject(0);
        assertEquals("groups", t.getString("fieldPath"));
        assertEquals("דלק", t.getJSONObject("appendMissingElements").getJSONArray("values").getJSONObject(0).getString("stringValue"));
        assertEquals(20, FirestoreRest.autoId().length());
    }
}
