package com.ohavs.payments.detect;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A receipt email → amount and merchant. A port of parseMessage/parseReceipt
 * in src/lib/gmail.js (the manual scan in the app) for the background check;
 * GmailReceiptParserTest runs the same cases as gmail.test.js. Plain Java so
 * it runs on the JVM.
 */
public final class GmailReceiptParser {

    public static final class Receipt {
        public final double amount;
        public final String currency;
        public final String merchant;
        public final String domain;

        Receipt(double amount, String currency, String merchant, String domain) {
            this.amount = amount;
            this.currency = currency;
            this.merchant = merchant;
            this.domain = domain;
        }
    }

    static final class Amount {
        final double value;
        final String currency;
        final boolean total;

        Amount(double value, String currency, boolean total) {
            this.value = value;
            this.currency = currency;
            this.total = total;
        }
    }

    private static final String NUM = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
    private static final String CUR = "(₪|ש\"ח|ש״ח|ILS|NIS|\\$|USD|€|EUR|£|GBP)";
    private static final Pattern AMOUNT = Pattern.compile(CUR + "\\s?" + NUM + "|" + NUM + "\\s?" + CUR);
    private static final Pattern TOTAL = Pattern.compile(
        "סה[\"״]?כ|סך הכל|סך הכול|לתשלום|סכום החיוב|סכום העסקה|שולם|total|amount paid|amount charged|amount due|you paid|charged",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern REFUND = Pattern.compile("זיכוי|החזר כספי|refund", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern BIDI = Pattern.compile("[\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]");
    private static final Pattern FROM = Pattern.compile("^\\s*\"?([^\"<]*?)\"?\\s*<([^>]+)>");
    private static final Pattern GENERIC_SENDER = Pattern.compile(
        "^(no-?reply|noreply|receipts?|billing|invoices?|payments?|orders?|info|support|service|team|account|קבלות|חשבוניות)$",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern SENDER_SUFFIX = Pattern.compile(
        "\\s+(via|from|team|receipts?|billing|payments?)\\b.*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Set<String> HOST_NOISE = new HashSet<>(Arrays.asList(
        "com", "co", "il", "net", "org", "io", "app", "so", "mail", "email", "e", "em", "info", "www"));

    private GmailReceiptParser() {}

    /**
     * subject and From headers, the message's text/plain and text/html parts
     * (either may be null) and Gmail's snippet. Null when there is no amount,
     * or when the mail is a refund.
     */
    public static Receipt parse(String subject, String from, String plain, String html, String snippet) {
        subject = subject == null ? "" : subject;
        if (REFUND.matcher(subject).find()) return null;
        String text = plain != null ? plain : html != null ? htmlToText(html) : (snippet == null ? "" : snippet);
        if (text.length() > 20000) text = text.substring(0, 20000);

        List<Amount> amounts = findAmounts(subject + "\n" + text);
        if (amounts.isEmpty()) return null;
        List<Amount> totals = new ArrayList<>();
        for (Amount a : amounts) if (a.total) totals.add(a);
        List<Amount> pool = totals.isEmpty() ? amounts : totals;
        Amount pick = pool.get(0);
        for (Amount a : pool) if (a.value > pick.value) pick = a;

        String fromName = "";
        String email = from == null ? "" : from.trim();
        Matcher m = FROM.matcher(email);
        if (m.find()) {
            fromName = m.group(1).trim();
            email = m.group(2).trim();
        }
        email = email.toLowerCase(Locale.ROOT);
        int at = email.indexOf('@');
        String domain = at >= 0 ? email.substring(at + 1) : "";
        return new Receipt(pick.value, pick.currency, merchantOf(fromName, domain), domain);
    }

    static String htmlToText(String html) {
        return html
            .replaceAll("(?i)<(style|script|head)[^>]*>[\\s\\S]*?</\\1>", " ")
            .replaceAll("(?i)<br\\s*/?>|</(p|div|tr|li|h\\d|table)>", "\n")
            .replaceAll("<[^>]+>", " ")
            .replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'")
            .replace("&lt;", "<").replace("&gt;", ">").replaceAll("(?i)&#8362;|&#x20aa;", "₪")
            .replaceAll("[ \\t]+", " ").replaceAll("\\n\\s*\\n+", "\n");
    }

    /** Every amount in the text, with whether a "total" label sits just before it. */
    static List<Amount> findAmounts(String text) {
        String t = BIDI.matcher(text).replaceAll("").replace(' ', ' ');
        List<Amount> out = new ArrayList<>();
        Matcher m = AMOUNT.matcher(t);
        while (m.find()) {
            String raw = m.group(2) != null ? m.group(2) : m.group(3);
            double value;
            try {
                value = Double.parseDouble(raw.replace(",", ""));
            } catch (NumberFormatException e) {
                continue;
            }
            if (!(value > 0) || value > 200000) continue;
            String before = t.substring(Math.max(0, m.start() - 50), m.start());
            String cur = m.group(1) != null ? m.group(1) : m.group(4);
            out.add(new Amount(value, symbol(cur), TOTAL.matcher(before).find()));
        }
        return out;
    }

    private static String symbol(String raw) {
        String r = raw.toUpperCase(Locale.ROOT);
        if (r.equals("$") || r.equals("USD")) return "$";
        if (r.equals("€") || r.equals("EUR")) return "€";
        if (r.equals("£") || r.equals("GBP")) return "£";
        return "₪";
    }

    static String merchantOf(String fromName, String domain) {
        String name = SENDER_SUFFIX.matcher(fromName == null ? "" : fromName).replaceAll("").trim();
        if (!name.isEmpty() && !GENERIC_SENDER.matcher(name).matches() && name.indexOf('@') < 0) {
            return name.length() > 40 ? name.substring(0, 40) : name;
        }
        String label = "";
        for (String part : domain.split("\\.")) if (!part.isEmpty() && !HOST_NOISE.contains(part)) label = part;
        if (label.isEmpty()) label = domain;
        return label.isEmpty() ? "קבלה" : label.substring(0, 1).toUpperCase(Locale.ROOT) + label.substring(1);
    }
}
