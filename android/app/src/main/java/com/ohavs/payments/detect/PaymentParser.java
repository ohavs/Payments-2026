package com.ohavs.payments.detect;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads a payment out of a notification: Google Wallet after a tap-to-pay, a
 * credit card app, or a bank/card SMS. Plain Java (no Android types) so it can
 * be unit tested on the JVM.
 *
 * Google Wallet: the title is the merchant, the text holds the amount
 * ("₪45.90 באמצעות Visa •••• 1234"). Anything else must also read like a
 * charge ("אושרה עסקה", "חיוב", "purchase"...) so that chats and promotions
 * mentioning a price are ignored.
 */
public final class PaymentParser {

    public static final class Result {
        public final double amount;
        public final String currency;
        public final String merchant;
        public final String last4;

        Result(double amount, String currency, String merchant, String last4) {
            this.amount = amount;
            this.currency = currency;
            this.merchant = merchant;
            this.last4 = last4;
        }
    }

    /** Why a notification was not offered, for the in-app log. */
    public static final class Outcome {
        public final Result result;
        public final String reason;
        public final String detail;

        Outcome(Result result, String reason, String detail) {
            this.result = result;
            this.reason = reason;
            this.detail = detail;
        }
    }

    /**
     * Google Wallet, Play services (posted tap-to-pay notifications before mid
     * 2024) and Samsung Wallet.
     */
    static final Set<String> WALLET_PACKAGES = new HashSet<>(Arrays.asList(
        "com.google.android.apps.walletnfcrel",
        "com.google.android.gms",
        "com.samsung.android.spay",
        "com.samsung.android.spayfw"
    ));

    /** Chats and mail: people and newsletters mention prices all the time. Gmail has its own scan. */
    static final Set<String> IGNORED_PACKAGES = new HashSet<>(Arrays.asList(
        "com.ohavs.payments",
        "com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "org.thoughtcrime.securesms",
        "com.facebook.orca", "com.facebook.katana", "com.instagram.android",
        "com.google.android.gm", "com.microsoft.office.outlook", "com.google.android.apps.dynamite",
        "com.discord", "com.slack"
    ));

    private static final String HEB = "\\u05D0-\\u05EA";
    private static final String NUM = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
    private static final String CUR = "(₪|ש\"ח|שח|ILS|NIS|\\$|USD|€|EUR|£|GBP)";
    private static final Pattern CUR_FIRST = Pattern.compile("(?<![" + HEB + "A-Za-z])" + CUR + "\\s?" + NUM);
    private static final Pattern CUR_LAST = Pattern.compile(NUM + "\\s?" + CUR + "(?![" + HEB + "A-Za-z])");
    private static final Pattern BARE = Pattern.compile("(?:בסך|בסכום|סכום)\\s*(?:של\\s*)?:?\\s*" + NUM);

    private static final Pattern CHARGE_WORDS = Pattern.compile(
        "עסקה|עסקת|חיוב|חויב|אושר|רכישה|רכשת|שולם|שילמת|תשלום|קנייה|משיכה|"
            + "transaction|purchase|paid|payment|charged|spent",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern NOT_A_CHARGE = Pattern.compile(
        "זיכוי|החזר|בוטל|ביטול|נדח|סורב|לא אושר|קוד אימות|קוד האימות|סיסמ|מבצע|הנחה|קופון|"
            + "refund|declined|reversed|cancel|verification|one-time|\\bOTP\\b|\\bcode\\b|discount|% off",
        Pattern.CASE_INSENSITIVE);

    private static final String END =
        "(?=\\s+(?:בסך|אושר|בתאריך|בכרטיס|באמצעות|ביום|ב-?\\d)|\\s+(?i:on|with|using|for)\\b|[,.;:!\\n(]|\\s+\\d|$)";
    private static final Pattern[] MERCHANT = {
        Pattern.compile("בבית ה?עסק[:\\s]+(.+?)" + END),
        Pattern.compile("(?i)\\b(?:at|@)\\s+(.+?)" + END),
        Pattern.compile("אצל\\s+(.+?)" + END),
        // "45.00 ש"ח בשופרסל" / "₪45 ב-שופרסל" — Hebrew glues "at" to the name
        Pattern.compile(CUR + "\\s+ב[-־]?\\s?(?!כרטיס|תאריך|סך|אמצעות|יום|\\d)(.+?)" + END),
        Pattern.compile(NUM + "\\s+ב[-־]?\\s?(?!כרטיס|תאריך|סך|אמצעות|יום|\\d)(.+?)" + END),
        Pattern.compile("עסקה\\s+ב[-־]?\\s?(?!כרטיס|תאריך|סך|אמצעות|יום|\\d)(.+?)" + END),
    };
    private static final Pattern LAST4 = Pattern.compile(
        "(?:המסתיים ב|מסתיים ב|שמספרו|ending in|ending|[•*]{2,}|x{2,})\\s?-?\\s?(\\d{4})", Pattern.CASE_INSENSITIVE);
    /** A card named in a Wallet notification: masked digits or the brand/issuer. */
    private static final Pattern CARD = Pattern.compile(
        "[•*·]{2,}\\s?\\d{4}|\\b(?:visa|mastercard|master card|amex|american express|diners|isracard|max|cal)\\b|"
            + "ויזה|מאסטרקארד|ישראכרט|דיינרס|אמריקן אקספרס|כאל|מקס",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern DONE_WORDS = Pattern.compile("בוצע|הושלם|done|complete|success", Pattern.CASE_INSENSITIVE);
    /** Wallet also writes about cards being added, verified or expiring. */
    private static final Pattern SETUP_WORDS = Pattern.compile(
        "מוכן|נוסף|הוסף|הוספ|להוסיף|הגדר|אמת|תוקף|עדכן|ready|added|\\badd\\b|set up|verif|expir|update",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern GENERIC_TITLE = Pattern.compile(
        "עסקה|חיוב|התראה|הודעה|אשראי|כרטיס|תשלום|transaction|payment|purchase|alert|card|wallet|google pay",
        Pattern.CASE_INSENSITIVE);

    private PaymentParser() {}

    /** Bidi marks, non-breaking spaces and gershayim variants vary by app; flatten them. */
    static String normalize(String s) {
        if (s == null) return "";
        return s.replaceAll("[\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]", "")
            .replace(' ', ' ').replace(' ', ' ')
            .replace('״', '"').replace('″', '"').replace("''", "\"")
            .replace('־', '-')
            .replaceAll("[ \\t]+", " ")
            .trim();
    }

    public static Result parse(String pkg, String title, String text) {
        return analyze(pkg, title, text).result;
    }

    private static Outcome no(String reason, String detail) {
        return new Outcome(null, reason, detail);
    }

    /** True when the text holds an amount with a currency: worth logging even if not offered. */
    public static boolean mentionsMoney(String text) {
        String x = normalize(text);
        return CUR_FIRST.matcher(x).find() || CUR_LAST.matcher(x).find();
    }

    public static Outcome analyze(String pkg, String title, String text) {
        if (pkg != null && IGNORED_PACKAGES.contains(pkg)) return no("ignored-app", null);
        String t = normalize(title);
        String x = normalize(text);
        String all = t.isEmpty() ? x : x.isEmpty() ? t : t + "\n" + x;
        if (all.isEmpty()) return no("empty", null);
        Matcher nc = NOT_A_CHARGE.matcher(all);
        if (nc.find()) return no("not-a-charge", nc.group());
        boolean wallet = pkg != null && WALLET_PACKAGES.contains(pkg);
        if (!wallet && !CHARGE_WORDS.matcher(all).find()) return no("no-charge-words", null);

        double amount = -1;
        String currency = "₪";
        Matcher m = CUR_FIRST.matcher(all);
        Matcher m2 = CUR_LAST.matcher(all);
        boolean first = m.find();
        boolean last = m2.find();
        if (first && (!last || m.start() <= m2.start())) {
            currency = currencySymbol(m.group(1));
            amount = number(m.group(2));
        } else if (last) {
            currency = currencySymbol(m2.group(2));
            amount = number(m2.group(1));
        } else {
            Matcher b = BARE.matcher(all);
            if (b.find()) amount = number(b.group(1));
        }
        if (amount > 200000) return no("amount-range", String.valueOf(amount));

        String merchant = null;
        if (wallet && !t.isEmpty() && !CUR_FIRST.matcher(t).find() && !CUR_LAST.matcher(t).find()
            && !GENERIC_TITLE.matcher(t).find()) {
            merchant = t;
        }
        if (merchant == null) {
            for (Pattern p : MERCHANT) {
                Matcher mm = p.matcher(all);
                if (mm.find()) {
                    String cand = clean(mm.group(mm.groupCount()));
                    if (cand != null) { merchant = cand; break; }
                }
            }
        }
        if (merchant == null && !t.isEmpty() && !GENERIC_TITLE.matcher(t).find()
            && !CHARGE_WORDS.matcher(t).find() && !t.matches(".*\\d.*")) {
            merchant = clean(t);
        }

        Matcher l4 = LAST4.matcher(all);
        String last4 = l4.find() ? l4.group(1) : null;
        if (!(amount > 0)) {
            // Wallet can report the tap before the card issuer sends the amount
            // (or never does): still offer it, the user types the amount.
            boolean card = last4 != null || CARD.matcher(all).find();
            boolean paid = merchant != null || CHARGE_WORDS.matcher(all).find() || DONE_WORDS.matcher(all).find();
            if (!wallet || !card || !paid || SETUP_WORDS.matcher(all).find()) return no("no-amount", null);
            return new Outcome(new Result(0, currency, merchant, last4), "ok-no-amount", null);
        }
        return new Outcome(new Result(Math.round(amount * 100) / 100.0, currency, merchant, last4), "ok", null);
    }

    private static String clean(String s) {
        if (s == null) return null;
        String c = s.replaceAll("\\s+", " ").replaceAll("^[\\s\"'-]+|[\\s\"'.,-]+$", "").trim();
        if (c.length() < 2 || c.matches("[\\d\\s/.:-]+")) return null;
        if (c.length() > 40) c = c.substring(0, 40).trim();
        return c;
    }

    private static double number(String s) {
        try {
            return Double.parseDouble(s.replace(",", ""));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    static String currencySymbol(String raw) {
        switch (raw.toUpperCase(Locale.ROOT)) {
            case "$": case "USD": return "$";
            case "€": case "EUR": return "€";
            case "£": case "GBP": return "£";
            default: return "₪";
        }
    }
}
