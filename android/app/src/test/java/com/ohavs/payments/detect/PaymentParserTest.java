package com.ohavs.payments.detect;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class PaymentParserTest {
    private static final String WALLET = "com.google.android.apps.walletnfcrel";
    private static final String SMS = "com.google.android.apps.messaging";
    private static final String CARD_APP = "com.example.card";

    private static PaymentParser.Result parse(String pkg, String title, String text) {
        return PaymentParser.parse(pkg, title, text);
    }

    @Test
    public void walletHebrew() {
        PaymentParser.Result r = parse(WALLET, "שופרסל דיל", "‏₪45.90 באמצעות Visa ‏•••• 1234");
        assertNotNull(r);
        assertEquals(45.90, r.amount, 0.001);
        assertEquals("₪", r.currency);
        assertEquals("שופרסל דיל", r.merchant);
        assertEquals("1234", r.last4);
    }

    @Test
    public void walletAmountAfterNumberWithBidiMarks() {
        PaymentParser.Result r = parse(WALLET, "ארומה", "‏32.00 ‏₪ עם Mastercard ••5678");
        assertNotNull(r);
        assertEquals(32.0, r.amount, 0.001);
        assertEquals("ארומה", r.merchant);
    }

    @Test
    public void walletEnglishDollars() {
        PaymentParser.Result r = parse(WALLET, "Starbucks", "$6.45 with Visa ••1234");
        assertNotNull(r);
        assertEquals(6.45, r.amount, 0.001);
        assertEquals("$", r.currency);
        assertEquals("Starbucks", r.merchant);
    }

    @Test
    public void cardSmsWithBusinessName() {
        PaymentParser.Result r = parse(SMS, "MAX",
            "עסקה בסך 1,250.00 ש״ח בכרטיס 4321 בבית העסק איקאה נתניה אושרה");
        assertNotNull(r);
        assertEquals(1250.0, r.amount, 0.001);
        assertEquals("איקאה נתניה", r.merchant);
        assertEquals("₪", r.currency);
    }

    @Test
    public void cardSmsHebrewPrefixedMerchant() {
        PaymentParser.Result r = parse(SMS, "Isracard",
            "בכרטיסך המסתיים ב-1234 אושרה עסקה ב-12/10 בסך 45.00 ש\"ח ברמי לוי");
        assertNotNull(r);
        assertEquals(45.0, r.amount, 0.001);
        assertEquals("רמי לוי", r.merchant);
        assertEquals("1234", r.last4);
    }

    @Test
    public void cardAppEnglishAt() {
        PaymentParser.Result r = parse(CARD_APP, "Purchase approved", "ILS 89.90 at Wolt, card ending in 9876");
        assertNotNull(r);
        assertEquals(89.90, r.amount, 0.001);
        assertEquals("Wolt", r.merchant);
        assertEquals("9876", r.last4);
    }

    @Test
    public void bareAmountAfterBesach() {
        PaymentParser.Result r = parse(CARD_APP, "התראת חיוב", "חויבת בסך 120 בפז דלק");
        assertNotNull(r);
        assertEquals(120.0, r.amount, 0.001);
    }

    @Test
    public void ignoresChatsAndPromotions() {
        assertNull(parse("com.whatsapp", "דנה", "שילמתי 50 ש\"ח על הפיצה"));
        assertNull(parse(SMS, "Shufersal", "מבצע! כל המוצרים ב-9.90 ₪ בלבד"));
        assertNull(parse(SMS, "Bank", "קוד האימות שלך לתשלום הוא 123456"));
        assertNull(parse(SMS, "MAX", "זיכוי בסך 45.00 ש\"ח מבית העסק שופרסל"));
        assertNull(parse(SMS, "אמא", "נפגשים ב-8"));
    }

    @Test
    public void nonWalletNeedsChargeWords() {
        assertNull(parse(CARD_APP, "Shop", "₪120"));
        assertNotNull(parse(WALLET, "Shop", "₪120"));
    }

    @Test
    public void walletWithoutAmountIsOfferedToType() {
        PaymentParser.Outcome o = PaymentParser.analyze(WALLET, "שופרסל דיל", "Visa •••• 1234");
        assertNotNull(o.result);
        assertEquals("ok-no-amount", o.reason);
        assertEquals(0, o.result.amount, 0.001);
        assertEquals("שופרסל דיל", o.result.merchant);
        assertEquals("1234", o.result.last4);
        assertNotNull(parse(WALLET, "Google Wallet", "התשלום בוצע באמצעות Mastercard ••5678"));
    }

    @Test
    public void walletCardNewsIsNotAPayment() {
        assertNull(parse(WALLET, "Google Wallet", "Visa •••• 1234 מוכן לשימוש"));
        assertNull(parse(WALLET, "Google Wallet", "Your Visa •••• 1234 was added"));
        assertNull(parse(WALLET, "Google Wallet", "Visa •••• 1234 expires soon"));
        assertNull(parse(WALLET, "כרטיס עלייה למטוס", "הטיסה שלך יוצאת בעוד 3 שעות"));
    }

    @Test
    public void cardAppWithoutAmountIsSkipped() {
        assertNull(parse(CARD_APP, "שופרסל", "אושרה עסקה בכרטיס המסתיים ב-1234"));
    }

    @Test
    public void samsungWallet() {
        PaymentParser.Result r = parse("com.samsung.android.spay", "ארומה", "₪32.00 Visa ••5678");
        assertNotNull(r);
        assertEquals(32.0, r.amount, 0.001);
        assertEquals("ארומה", r.merchant);
    }

    @Test
    public void reasons() {
        assertEquals("no-charge-words", PaymentParser.analyze(CARD_APP, "Shop", "₪120").reason);
        PaymentParser.Outcome o = PaymentParser.analyze(SMS, "Max", "זיכוי בסך 45 ש\"ח");
        assertEquals("not-a-charge", o.reason);
        assertEquals("זיכוי", o.detail);
        assertEquals("ok", PaymentParser.analyze(WALLET, "Shop", "₪120").reason);
        assertEquals("ignored-app", PaymentParser.analyze("com.whatsapp", "x", "שילמתי ₪45").reason);
    }
}
