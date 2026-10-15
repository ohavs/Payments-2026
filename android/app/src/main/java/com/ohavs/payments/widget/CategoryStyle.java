package com.ohavs.payments.widget;

import java.util.regex.Pattern;

/**
 * Category name → sticker and tint, the rules of categoryVisual() in
 * src/ui/icons.jsx (first match wins; unknown names get a letter on one of
 * six tints picked by a hash of the name).
 */
public final class CategoryStyle {
    public final String icon;   // ic_cat_<icon>, or null for a letter
    public final String tint;   // w_<tint> colour
    public final String letter;

    private CategoryStyle(String icon, String tint, String letter) {
        this.icon = icon;
        this.tint = tint;
        this.letter = letter;
    }

    private static final Object[][] RULES = {
        {Pattern.compile("קני|סופר|מכול|שוק|groc", Pattern.CASE_INSENSITIVE), "cart", "mint"},
        {Pattern.compile("ביטוח"), "shield", "lavender"},
        {Pattern.compile("אוכל|מסעד|קפה|בחוץ|פיצה|ארוח|food", Pattern.CASE_INSENSITIVE), "food", "peach"},
        {Pattern.compile("דלק|רכב|תחבור|חני|מונית|car|fuel", Pattern.CASE_INSENSITIVE), "car", "sky"},
        {Pattern.compile("חשבונ|חשמל|מים|גז|ארנונ|אינטרנט|bill", Pattern.CASE_INSENSITIVE), "bolt", "lavender"},
        {Pattern.compile("בית|דיר|שכיר"), "house", "butter"},
        {Pattern.compile("בריא|רופא|תרופ|פארם|health", Pattern.CASE_INSENSITIVE), "heart", "rose"},
        {Pattern.compile("מתנ|gift", Pattern.CASE_INSENSITIVE), "gift", "rose"},
        {Pattern.compile("טיס|חופש|נסיע|טיול|travel", Pattern.CASE_INSENSITIVE), "plane", "sky"},
        {Pattern.compile("בגד|קניות אונליין|ביגוד|נעל|shop", Pattern.CASE_INSENSITIVE), "bag", "lavender"},
        {Pattern.compile("שונ|אחר|כללי|misc", Pattern.CASE_INSENSITIVE), "box", "butter"},
    };
    private static final String[] FALLBACK = {"mint", "lavender", "peach", "sky", "rose", "butter"};

    public static CategoryStyle of(String name) {
        String n = name == null ? "" : name;
        for (Object[] r : RULES) {
            if (((Pattern) r[0]).matcher(n).find()) return new CategoryStyle((String) r[1], (String) r[2], null);
        }
        // Same hash as icons.jsx: h = h * 31 + code point, as an unsigned 32-bit int.
        long h = 0;
        for (int i = 0; i < n.length(); ) {
            int cp = n.codePointAt(i);
            h = (h * 31 + (cp > 0xFFFF ? Character.highSurrogate(cp) : cp)) & 0xFFFFFFFFL;
            i += Character.charCount(cp);
        }
        String trimmed = n.trim();
        String letter = trimmed.isEmpty() ? "•" : trimmed.substring(0, trimmed.offsetByCodePoints(0, 1));
        return new CategoryStyle(null, FALLBACK[(int) (h % FALLBACK.length)], letter);
    }
}
