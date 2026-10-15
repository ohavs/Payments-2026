package com.ohavs.payments.widget;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/** The widget's keypad, same rules as applyKey/formatTyped in src/ui/kit.jsx. */
public final class AmountInput {
    private AmountInput() {}

    /** key: a digit, "." or "del". At most 7 digits and 2 decimals. */
    public static String apply(String amount, String key) {
        if (amount == null) amount = "";
        if ("del".equals(key)) return amount.isEmpty() ? amount : amount.substring(0, amount.length() - 1);
        if (".".equals(key)) return amount.contains(".") ? amount : (amount.isEmpty() ? "0" : amount) + ".";
        int dot = amount.indexOf('.');
        if (dot >= 0 && amount.length() - dot - 1 >= 2) return amount;
        if (amount.replace(".", "").length() >= 7) return amount;
        return ("0".equals(amount) ? "" : amount) + key;
    }

    public static double value(String amount) {
        try {
            return amount == null || amount.isEmpty() ? 0 : Double.parseDouble(amount);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** "1234.5" → "1,234.5" (as typed, decimals kept). */
    public static String format(String amount) {
        if (amount == null || amount.isEmpty()) return "0";
        int dot = amount.indexOf('.');
        String i = dot >= 0 ? amount.substring(0, dot) : amount;
        String whole = new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(Locale.US))
            .format(i.isEmpty() ? 0 : Long.parseLong(i));
        return dot >= 0 ? whole + amount.substring(dot) : whole;
    }

    /** A saved amount: no trailing zeros ("45", "45.9"). */
    public static String format(double v) {
        DecimalFormat f = new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.US));
        return f.format(v);
    }
}
