// Automatic payment detection. On Android a notification listener (native,
// detect/PaymentListenerService.java) turns Wallet and credit-card
// notifications into suggestions; Gmail receipts (gmail.js) produce the same
// shape. This module talks to the native side and turns a suggestion into an
// expense with a guessed category.
import { registerPlugin } from '@capacitor/core';
import { convertCurrency } from '../fx.jsx';
import { categoryVisual } from '../ui/icons.jsx';
import { isNative } from './platform.js';

const PaymentDetect = registerPlugin('PaymentDetect');

// Merchant name → the category sticker it belongs to (see categoryVisual).
// Order matters: "סופר פארם" is a pharmacy before it is a supermarket.
const MERCHANT_KINDS = [
  [/סופר.?פארם|super.?pharm|\bbe\b|פארם|מכבי|כללית|מאוחדת|לאומית|רופא|pharm|clinic/i, 'heart'],
  [/שופרסל|רמי לוי|ויקטורי|יוחננוף|מגה|טיב טעם|אושר עד|חצי חינם|יינות ביתן|am:?pm|סופר|מכולת|קרפור|carrefour|shufersal|rami levy|victory|supermarket|grocer/i, 'cart'],
  [/מסעד|קפה|ארומה|קופיקס|cofix|aroma|wolt|וולט|תן ביס|10bis|ten ?bis|מקדונלד|mcdonald|בורגר|burger|פיצ|pizza|סושי|sushi|japanika|לנדוור|starbucks|caf[eé]|coffee|restaurant|bakery|מאפי/i, 'food'],
  [/(?:^|\s)פז(?:\s|$)|סונול|דלק|דור אלון|yellow|חני|pango|פנגו|cellopark|סלופארק|רב.?קו|gett|יאנגו|yango|uber|מונית|רכבת|אגד|מוסך|parking|fuel|taxi/i, 'car'],
  [/ביטוח|הראל|מגדל|הפניקס|מנורה|איילון|insurance/i, 'shield'],
  [/חשמל|תאגיד|ארנונה|עירי|בזק|פרטנר|סלקום|פלאפון|הוט|גולן|electric|water/i, 'bolt'],
  [/איקאה|ikea|\bace\b|הום סנטר|home center|טמבור|פוקס הום|כלי בית/i, 'house'],
  [/זארה|zara|h&m|קסטרו|castro|פוקס|\bfox\b|terminal ?x|טרמינל|amazon|aliexpress|shein|נייקי|nike|adidas|אדידס|ebay|shop/i, 'bag'],
  [/אל על|el ?al|ישראייר|ארקיע|booking|airbnb|מלון|hotel|ryanair|wizz|airline|airways/i, 'plane'],
];

const norm = (s) => String(s || '').trim().toLowerCase();

export function merchantKind(merchant) {
  const m = String(merchant || '');
  for (const [re, kind] of MERCHANT_KINDS) if (re.test(m)) return kind;
  return null;
}

// What category a merchant's expense goes in: whatever the user filed it
// under last time, else by the kind of shop, else the catch-all category.
export function guessCategory(merchant, categories, items = []) {
  if (!categories?.length) return '';
  const key = norm(merchant);
  if (key) {
    const prev = items.find((it) => norm(it.title) === key && categories.includes(it.group));
    if (prev) return prev.group;
  }
  const kind = merchantKind(merchant);
  if (kind) {
    const match = categories.find((c) => categoryVisual(c).icon === kind);
    if (match) return match;
  }
  return categories.find((c) => categoryVisual(c).icon === 'box') || categories[categories.length - 1];
}

const round2 = (n) => Math.round(n * 100) / 100;
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// A suggestion as an expense in the active space. Foreign amounts are
// converted to the user's currency; the original goes in the note.
export function suggestionToItem(s, { categories, items = [], currency = '₪', rates = null }) {
  const from = s.currency || '₪';
  let amount = Number(s.amount) || 0;
  let note = '';
  if (from !== currency) {
    note = `${from}${amount}`;
    if (rates) amount = round2(convertCurrency(amount, from, currency, rates));
  }
  return {
    title: s.merchant || 'תשלום',
    amount,
    group: guessCategory(s.merchant, categories, items),
    note,
    date: localISO(new Date(s.time || Date.now())),
    source: s.source || 'card',
  };
}

// The expense a suggestion becomes always gets the same document id, so
// adding it twice (a second tap on a slow connection, the notification and
// the card) leaves one expense.
export const detectedItemId = (s) => `detected-${String(s.id).replace(/[^A-Za-z0-9_-]/g, '_')}`;

// Already in the list? Same amount within two days of an existing expense.
export function isAlreadyRecorded(s, items) {
  const day = 86400000;
  const t = s.time || Date.now();
  return items.some((it) => {
    if (Math.abs((Number(it.amount) || 0) - Number(s.amount)) > 0.5) return false;
    const [y, m, d] = String(it.date || '').split('-').map(Number);
    if (!y) return false;
    return Math.abs(new Date(y, m - 1, d, 12) - t) < 2 * day;
  });
}

// ---- Native bridge (Android only; harmless no-ops on the web) ----
export const detectSupported = isNative;

export async function detectStatus() {
  if (!isNative) return { access: false, enabled: false };
  return PaymentDetect.status();
}
export async function setDetectEnabled(enabled) {
  if (!isNative) return { access: false, enabled: false };
  return PaymentDetect.setEnabled({ enabled });
}
export function openDetectAccess() {
  return isNative ? PaymentDetect.openAccessSettings() : Promise.resolve();
}
export async function listSuggestions() {
  if (!isNative) return [];
  const { suggestions } = await PaymentDetect.list();
  return suggestions || [];
}
export function removeSuggestions(ids) {
  return isNative && ids.length ? PaymentDetect.remove({ ids }) : Promise.resolve();
}
export async function takeLaunchAction() {
  if (!isNative) return null;
  const a = await PaymentDetect.takeLaunchAction();
  return a?.action ? a : null;
}
export function onDetectEvent(name, fn) {
  if (!isNative) return () => {};
  const h = PaymentDetect.addListener(name, fn);
  return () => { h.then((x) => x.remove()); };
}

// What the listener saw lately and why it did or did not offer it (on the phone only).
export async function detectLog() {
  if (!isNative) return [];
  const { entries } = await PaymentDetect.log();
  return entries || [];
}
export function clearDetectLog() {
  return isNative ? PaymentDetect.clearLog() : Promise.resolve();
}

const REASONS = {
  ok: 'הוצע להוספה',
  'ok-no-amount': 'הוצע, בלי סכום',
  duplicate: 'כפול (כבר הוצע)',
  'no-amount': 'לא נמצא סכום',
  'no-charge-words': 'לא נראה כמו חיוב',
  'not-a-charge': 'סונן',
  'amount-range': 'סכום לא סביר',
  empty: 'התראה בלי טקסט',
  summary: 'התראת סיכום',
  ongoing: 'התראה קבועה',
};
export function detectReasonLabel(e) {
  const base = REASONS[e.reason] || e.reason || '';
  return e.detail ? `${base} · ${e.detail}` : base;
}

// Plain text of the log, to paste in a message when something was missed.
export function detectLogText(entries, status = {}) {
  const t = (ms) => (ms ? new Date(ms).toLocaleString('he-IL') : '—');
  const head = [
    `גישה: ${status.access ? 'כן' : 'לא'} · פעיל: ${status.enabled ? 'כן' : 'לא'} · מחובר: ${status.connected ? 'כן' : 'לא'}`,
    `חובר לאחרונה: ${t(status.lastConnected)} · נותק: ${t(status.lastDisconnected)} · התראה אחרונה: ${t(status.lastSeen)}`,
  ];
  const rows = entries.map((e) => [
    `${t(e.time)} · ${e.app || e.pkg} (${e.pkg}) · ${detectReasonLabel(e)}`,
    `  כותרת: ${e.title || ''}`,
    `  טקסט: ${String(e.text || '').replace(/\n/g, ' ⏎ ')}`,
  ].join('\n'));
  return [...head, '', ...rows].join('\n');
}
