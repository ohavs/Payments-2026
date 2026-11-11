package com.ohavs.payments.detect;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class SuggestionStoreTest {
    private static final String WALLET = "com.google.android.apps.walletnfcrel";
    private static final String SMS = "com.google.android.apps.messaging";
    private static final long MIN = 60_000;

    private static JSONObject s(String id, String pkg, double amount, String merchant, long time) throws Exception {
        JSONObject o = new JSONObject();
        o.put("id", id);
        o.put("pkg", pkg);
        o.put("amount", amount);
        o.put("currency", "₪");
        o.put("merchant", merchant);
        o.put("time", time);
        if (!(amount > 0)) o.put("needsAmount", true);
        return o;
    }

    @Test
    public void amountFillsTheWaitingWalletTap() throws Exception {
        JSONArray all = new JSONArray();
        JSONObject tap = s("a", WALLET, 0, "שופרסל דיל", 0);
        all.put(tap);
        boolean[] changed = {false};
        JSONObject shown = SuggestionStore.decide(all, s("b", SMS, 45.9, "", MIN), changed);
        assertSame(tap, shown);
        assertEquals(45.9, tap.optDouble("amount"), 0.001);
        assertFalse(tap.has("needsAmount"));
        assertEquals("שופרסל דיל", tap.optString("merchant"));
        assertEquals(true, changed[0]);
    }

    @Test
    public void walletTapAfterTheSmsIsTheSamePayment() throws Exception {
        JSONArray all = new JSONArray();
        all.put(s("a", SMS, 45.9, "", 0));
        boolean[] changed = {false};
        assertNull(SuggestionStore.decide(all, s("b", WALLET, 0, "שופרסל דיל", MIN), changed));
        assertEquals("שופרסל דיל", all.getJSONObject(0).optString("merchant"));
    }

    @Test
    public void sameAmountTwiceIsOne() throws Exception {
        JSONArray all = new JSONArray();
        all.put(s("a", WALLET, 12, "ארומה", 0));
        assertNull(SuggestionStore.decide(all, s("b", SMS, 12, "", 2 * MIN), new boolean[1]));
    }

    @Test
    public void laterPurchasesAreNew() throws Exception {
        JSONArray all = new JSONArray();
        all.put(s("a", WALLET, 0, "ארומה", 0));
        JSONObject next = s("b", WALLET, 0, "ארומה", 20 * MIN);
        assertSame(next, SuggestionStore.decide(all, next, new boolean[1]));
        JSONObject other = s("c", WALLET, 0, "קופיקס", 5 * MIN);
        assertSame(other, SuggestionStore.decide(all, other, new boolean[1]));
    }
}
