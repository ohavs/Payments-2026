package com.ohavs.payments.detect;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.List;

import org.junit.Test;

/** The same cases as src/lib/gmail.test.js, so both parsers agree. */
public class GmailReceiptParserTest {

    @Test
    public void hebrewHtmlReceiptPicksTheTotal() {
        GmailReceiptParser.Receipt r = GmailReceiptParser.parse("הקבלה שלך מוולט", "\"וולט\" <info@wolt.com>", null,
            "<table><tr><td>פיצה</td><td>₪52.00</td></tr><tr><td>משלוח</td><td>₪9.90</td></tr><tr><td>סה\"כ לתשלום</td><td>&#8362;61.90</td></tr></table>",
            "");
        assertNotNull(r);
        assertEquals(61.9, r.amount, 0.001);
        assertEquals("₪", r.currency);
        assertEquals("וולט", r.merchant);
        assertEquals("wolt.com", r.domain);
    }

    @Test
    public void englishPlainTextWithDollars() {
        GmailReceiptParser.Receipt r = GmailReceiptParser.parse("Your receipt from OpenAI #1234", "OpenAI <noreply@tm.openai.com>",
            "ChatGPT Plus Subscription\nSubtotal $20.00\nTax $0.00\nAmount paid $20.00", null, "");
        assertNotNull(r);
        assertEquals(20, r.amount, 0.001);
        assertEquals("$", r.currency);
        assertEquals("OpenAI", r.merchant);
        assertEquals("tm.openai.com", r.domain);
    }

    @Test
    public void amountAfterTheNumberWithShekelAbbreviation() {
        List<GmailReceiptParser.Amount> a = GmailReceiptParser.findAmounts("סכום החיוב: 1,249.90 ש\"ח");
        assertEquals(1249.9, a.get(0).value, 0.001);
        assertEquals("₪", a.get(0).currency);
        assertTrue(a.get(0).total);
    }

    @Test
    public void bidiMarksAndNoBreakSpaces() {
        List<GmailReceiptParser.Amount> a = GmailReceiptParser.findAmounts("סה״כ: ‏₪‎ 89.50");
        assertEquals(89.5, a.get(0).value, 0.001);
        assertTrue(a.get(0).total);
    }

    @Test
    public void ignoresRefundsAndMailWithoutAnAmount() {
        assertNull(GmailReceiptParser.parse("זיכוי על הזמנה", "x@shop.co.il", "זיכוי ₪40", null, ""));
        assertNull(GmailReceiptParser.parse("אישור הזמנה", "x@shop.co.il", "ההזמנה בדרך", null, ""));
    }

    @Test
    public void snippetWhenThereIsNoBody() {
        GmailReceiptParser.Receipt r = GmailReceiptParser.parse("אישור תשלום", "billing@partner.co.il", null, null, "שולם ₪49.90 עבור החשבון");
        assertNotNull(r);
        assertEquals(49.9, r.amount, 0.001);
        assertEquals("Partner", r.merchant);
    }

    @Test
    public void merchantFallsBackToTheDomain() {
        assertEquals("Superpharm", GmailReceiptParser.merchantOf("noreply", "mail.superpharm.co.il"));
        assertEquals("Netflix", GmailReceiptParser.merchantOf("", "netflix.com"));
        assertEquals("Wolt", GmailReceiptParser.merchantOf("Wolt Receipts", "wolt.com"));
    }

    @Test
    public void htmlToTextDropsStylesAndTags() {
        assertEquals("שלום עולם", GmailReceiptParser.htmlToText("<style>p{}</style><p>שלום&nbsp;עולם</p>").trim());
    }
}
