// Catalog of popular Israeli services for the "add" picker.
// Each entry: id, name (Hebrew), category, defaultPrice (NIS), defaultCycle, brand color, glyph
const SERVICE_CATALOG = [
  // Streaming
  { id: 'netflix',    name: 'Netflix',         cat: 'streaming', price: 54.90,  cycle: 'monthly', bg: '#E50914', fg: '#fff',     glyph: 'N' },
  { id: 'spotify',    name: 'Spotify',         cat: 'streaming', price: 21.90,  cycle: 'monthly', bg: '#1DB954', fg: '#000',     glyph: 'S' },
  { id: 'ytpremium',  name: 'YouTube Premium', cat: 'streaming', price: 29.90,  cycle: 'monthly', bg: '#FF0033', fg: '#fff',     glyph: '▶' },
  { id: 'disney',     name: 'Disney+',         cat: 'streaming', price: 29.90,  cycle: 'monthly', bg: '#0E1A2B', fg: '#fff',     glyph: 'D+' },
  { id: 'applemusic', name: 'Apple Music',     cat: 'streaming', price: 19.95,  cycle: 'monthly', bg: '#000',    fg: '#fff',     glyph: '' },
  { id: 'appletv',    name: 'Apple TV+',       cat: 'streaming', price: 24.90,  cycle: 'monthly', bg: '#000',    fg: '#fff',     glyph: 'tv' },
  { id: 'icloud',     name: 'iCloud+',         cat: 'streaming', price: 11.90,  cycle: 'monthly', bg: '#E8F4FF', fg: '#005FCC',  glyph: '☁' },

  // Telco / Mobile
  { id: 'partner',    name: 'פרטנר',           cat: 'telco', price: 49,   cycle: 'monthly', bg: '#00B7AB', fg: '#fff', glyph: 'פ' },
  { id: 'cellcom',    name: 'סלקום',           cat: 'telco', price: 55,   cycle: 'monthly', bg: '#0E2A4E', fg: '#fff', glyph: 'ס' },
  { id: 'pelephone',  name: 'פלאפון',          cat: 'telco', price: 39,   cycle: 'monthly', bg: '#005FBF', fg: '#fff', glyph: 'P' },
  { id: 'hotmobile',  name: 'הוט מובייל',      cat: 'telco', price: 35,   cycle: 'monthly', bg: '#E60028', fg: '#fff', glyph: 'h' },
  { id: 'golan',      name: 'גולן טלקום',      cat: 'telco', price: 29,   cycle: 'monthly', bg: '#F39200', fg: '#000', glyph: 'g' },

  // Internet / TV
  { id: 'bezeq',      name: 'בזק',             cat: 'internet', price: 99,   cycle: 'monthly', bg: '#E60019', fg: '#fff', glyph: 'B' },
  { id: 'hot',        name: 'הוט',             cat: 'internet', price: 119,  cycle: 'monthly', bg: '#FF6900', fg: '#fff', glyph: 'h' },
  { id: 'yes',        name: 'YES',             cat: 'internet', price: 159,  cycle: 'monthly', bg: '#00A0E3', fg: '#fff', glyph: 'Y' },
  { id: 'cellcomtv',  name: 'סלקום TV',        cat: 'internet', price: 89,   cycle: 'monthly', bg: '#0E2A4E', fg: '#fff', glyph: 'tv' },

  // Software / Work
  { id: 'chatgpt',    name: 'ChatGPT Plus',    cat: 'software', price: 75,   cycle: 'monthly', bg: '#10A37F', fg: '#fff', glyph: '✦' },
  { id: 'claude',     name: 'Claude',          cat: 'software', price: 75,   cycle: 'monthly', bg: '#CC785C', fg: '#fff', glyph: '✺' },
  { id: 'figma',      name: 'Figma',           cat: 'software', price: 55,   cycle: 'monthly', bg: '#1E1E1E', fg: '#fff', glyph: 'F' },
  { id: 'adobe',      name: 'Adobe CC',        cat: 'software', price: 219,  cycle: 'monthly', bg: '#FA0F00', fg: '#fff', glyph: 'A' },
  { id: 'github',     name: 'GitHub Pro',      cat: 'software', price: 16,   cycle: 'monthly', bg: '#0D1117', fg: '#fff', glyph: '⊙' },
  { id: 'notion',     name: 'Notion',          cat: 'software', price: 40,   cycle: 'monthly', bg: '#fff',    fg: '#000', glyph: 'N' },
  { id: 'linear',     name: 'Linear',          cat: 'software', price: 30,   cycle: 'monthly', bg: '#5E6AD2', fg: '#fff', glyph: 'L' },

  // Insurance
  { id: 'ins_car',     name: 'ביטוח רכב',      cat: 'insurance', price: 320,  cycle: 'monthly', bg: '#FFD400', fg: '#000', glyph: '🚗' },
  { id: 'ins_home',    name: 'ביטוח דירה',     cat: 'insurance', price: 95,   cycle: 'monthly', bg: '#FFD400', fg: '#000', glyph: '🏠' },
  { id: 'ins_health',  name: 'ביטוח בריאות',   cat: 'insurance', price: 240,  cycle: 'monthly', bg: '#FFD400', fg: '#000', glyph: '+' },
  { id: 'ins_life',    name: 'ביטוח חיים',     cat: 'insurance', price: 180,  cycle: 'monthly', bg: '#FFD400', fg: '#000', glyph: '♡' },

  // Home / Utilities
  { id: 'electric',   name: 'חשמל',           cat: 'home', price: 480,  cycle: 'monthly', bg: '#F5A623', fg: '#000', glyph: '⚡' },
  { id: 'water',      name: 'מים',            cat: 'home', price: 180,  cycle: 'monthly', bg: '#00A0E3', fg: '#fff', glyph: '~' },
  { id: 'arnona',     name: 'ארנונה',          cat: 'home', price: 540,  cycle: 'monthly', bg: '#7E57C2', fg: '#fff', glyph: 'א' },
  { id: 'gas',        name: 'גז',             cat: 'home', price: 110,  cycle: 'monthly', bg: '#EF4444', fg: '#fff', glyph: 'ג' },
  { id: 'vaad',       name: 'ועד בית',         cat: 'home', price: 150,  cycle: 'monthly', bg: '#9CA3AF', fg: '#000', glyph: 'ו' },

  // Fitness
  { id: 'holmes',     name: 'Holmes Place',    cat: 'fitness', price: 299,  cycle: 'monthly', bg: '#0E2A4E', fg: '#fff', glyph: 'H' },
  { id: 'goactive',   name: 'Go Active',       cat: 'fitness', price: 199,  cycle: 'monthly', bg: '#FF6B35', fg: '#fff', glyph: 'G' },
  { id: 'sport',      name: 'חוגי ספורט',      cat: 'fitness', price: 350,  cycle: 'monthly', bg: '#22C55E', fg: '#000', glyph: '⚽' },

  // Other subscriptions
  { id: 'nyt',        name: 'NY Times',        cat: 'other', price: 60,   cycle: 'monthly', bg: '#000',    fg: '#fff', glyph: 'T' },
  { id: 'parking',    name: 'חניה (פנגו)',     cat: 'other', price: 25,   cycle: 'monthly', bg: '#F472B6', fg: '#000', glyph: 'P' },
  { id: 'haaretz',    name: 'הארץ דיגיטל',     cat: 'other', price: 49,   cycle: 'monthly', bg: '#0F172A', fg: '#fff', glyph: 'ה' },
  { id: 'rav',        name: 'רב-קו',           cat: 'other', price: 213,  cycle: 'monthly', bg: '#10B981', fg: '#000', glyph: 'ר' },
];

const CATEGORIES = [
  { id: 'streaming', name: 'סטרימינג',        emoji: '◐' },
  { id: 'telco',     name: 'סלולר',           emoji: '◑' },
  { id: 'internet',  name: 'אינטרנט ו-TV',    emoji: '◒' },
  { id: 'software',  name: 'תוכנה ועבודה',     emoji: '◓' },
  { id: 'insurance', name: 'ביטוחים',         emoji: '◑' },
  { id: 'home',      name: 'חשבונות בית',      emoji: '◐' },
  { id: 'fitness',   name: 'כושר',            emoji: '◑' },
  { id: 'other',     name: 'אחר',             emoji: '◒' },
];

// Payments are loaded live from Firestore at /users/{uid}/payments — see firebase-init.jsx.
// Each: id, serviceId | customService, price, currency, cycle, nextDate (ISO), note.
// Paid state is derived automatically: a payment whose nextDate has passed is paid for this cycle.
function seedPayments() {
  return [];
}

const CURRENCIES = ['₪', '$', '€', '£'];
const CYCLE_LABEL = { yearly: 'שנתי', monthly: 'חודשי', weekly: 'שבועי', daily: 'יומי' };
const CYCLE_ORDER = ['yearly', 'monthly', 'weekly', 'daily'];
const MONTH_NAMES_SHORT = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
const MONTH_NAMES_LONG = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// Curated accent palette — used by Settings color picker AND the Tweaks panel
const ACCENT_PALETTE = [
  { id: 'lime',    color: '#A3FF6A', label: 'ליים' },
  { id: 'yellow',  color: '#F2FF44', label: 'צהוב' },
  { id: 'orange',  color: '#FF8A4C', label: 'כתום' },
  { id: 'coral',   color: '#FF6B6B', label: 'אלמוג' },
  { id: 'pink',    color: '#FF6BB5', label: 'ורוד' },
  { id: 'purple',  color: '#7C5CFF', label: 'סגול' },
  { id: 'blue',    color: '#5CB7FF', label: 'תכלת' },
  { id: 'cyan',    color: '#50E3C2', label: 'טורקיז' },
];

// Resolve service display info for a payment — handles custom services (payment.customService) and catalog (payment.serviceId)
function resolveService(payment) {
  if (!payment) return null;
  if (payment.customService) return payment.customService;
  return SERVICE_CATALOG.find(s => s.id === payment.serviceId);
}

// Backwards-compat helper for code that has just an id (catalog lookup only)
function getService(id) {
  return SERVICE_CATALOG.find(s => s.id === id);
}

// Auto-paid: nextDate has already passed → charge went through, no manual marking needed.
function isAutoPaid(payment) {
  return daysUntil(payment.nextDate) < 0;
}

// Sum of payments whose nextDate falls within current calendar month AND is on/before today.
function paidThisMonth(payments) {
  const today = new Date(); today.setHours(0,0,0,0);
  const m = today.getMonth(), y = today.getFullYear();
  return payments.reduce((sum, p) => {
    const d = parseISODate(p.nextDate);
    if (d.getFullYear() === y && d.getMonth() === m && d <= today) {
      return sum + Number(p.price || 0);
    }
    return sum;
  }, 0);
}

// Sum of payments planned this calendar month (paid + upcoming this month)
function plannedThisMonth(payments) {
  const today = new Date();
  const m = today.getMonth(), y = today.getFullYear();
  return payments.reduce((sum, p) => {
    const d = parseISODate(p.nextDate);
    if (d.getFullYear() === y && d.getMonth() === m) return sum + Number(p.price || 0);
    return sum;
  }, 0);
}

function fmtMoney(amount, cur = '₪') {
  const n = Number(amount || 0);
  const s = n.toLocaleString('he-IL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${cur}${s}`;
}

// Parse YYYY-MM-DD as LOCAL midnight. `new Date(iso)` would treat the string
// as UTC and getDate()/setHours() can land on the previous calendar day in
// some timezones (and around DST boundaries). Always go through this helper
// when reading nextDate strings.
function parseISODate(iso) {
  if (!iso) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

function daysUntil(iso) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = parseISODate(iso); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

function fmtDateShort(iso) {
  const d = parseISODate(iso);
  const months = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function fmtRelative(iso) {
  const n = daysUntil(iso);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === -1) return 'אתמול';
  if (n > 1 && n < 8) return `בעוד ${n} ימים`;
  if (n < 0) return `לפני ${Math.abs(n)} ימים`;
  return fmtDateShort(iso);
}

// ----------------- Day-of-month / week helpers -----------------
// For monthly/weekly cycles we let users pick a recurrence day instead of an
// absolute date. The actual nextDate is computed as "the next time this day
// falls on or after today".
//
// IMPORTANT: never use Date.toISOString() to derive a YYYY-MM-DD string here —
// toISOString returns UTC and a local-midnight Date in Asia/Jerusalem
// becomes the previous calendar day in UTC. Format the local components
// directly instead.

function lastDayOfMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

function fmtLocalISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayLocalISO() {
  const t = new Date();
  return fmtLocalISO(t.getFullYear(), t.getMonth(), t.getDate());
}

function nextDateForDayOfMonth(day) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const y = today.getFullYear(), m = today.getMonth();
  const clampedThis = Math.min(day, lastDayOfMonth(y, m));
  const thisMonth = new Date(y, m, clampedThis);
  if (thisMonth >= today) return fmtLocalISO(y, m, clampedThis);
  const ny = m === 11 ? y + 1 : y;
  const nm = (m + 1) % 12;
  const clampedNext = Math.min(day, lastDayOfMonth(ny, nm));
  return fmtLocalISO(ny, nm, clampedNext);
}

function nextDateForDayOfWeek(weekday) { // 0 = Sunday
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const delta = (weekday - today.getDay() + 7) % 7;
  const d = new Date(today); d.setDate(d.getDate() + delta);
  return fmtLocalISO(d.getFullYear(), d.getMonth(), d.getDate());
}

// Yearly: pick a month (0–11) + day. Returns the next occurrence of that
// month/day on or after today.
function nextDateForMonthDay(month, day) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const clampedThis = Math.min(day, lastDayOfMonth(y, month));
  const thisYear = new Date(y, month, clampedThis);
  if (thisYear >= today) return fmtLocalISO(y, month, clampedThis);
  const clampedNext = Math.min(day, lastDayOfMonth(y + 1, month));
  return fmtLocalISO(y + 1, month, clampedNext);
}

function monthFromDate(iso) {
  if (!iso) return new Date().getMonth();
  return parseISODate(iso).getMonth();
}

// Parse YYYY-MM-DD strings directly to avoid UTC interpretation.
function dayOfMonthFromDate(iso) {
  if (!iso) return new Date().getDate();
  return parseISODate(iso).getDate();
}
function dayOfWeekFromDate(iso) {
  if (!iso) return new Date().getDay();
  return parseISODate(iso).getDay();
}

// ----------------- Cross-cycle stats helpers -----------------
// Normalize each payment to its monthly equivalent so a total feels right
// regardless of mix (daily × 30, weekly × ~4.33, monthly × 1).
// If `rates` + `target` are passed, prices are also converted into the target
// currency so a mixed-currency portfolio gives a single comparable number.
const CYCLE_PER_MONTH = { yearly: 1 / 12, monthly: 1, weekly: 30 / 7, daily: 30 };

function priceIn(payment, rates, target) {
  const p = Number(payment.price || 0);
  if (!rates || !target || !payment.currency || payment.currency === target) return p;
  return window.convertCurrency ? window.convertCurrency(p, payment.currency, target, rates) : p;
}

function monthlyEquivalent(payment, rates, target) {
  return priceIn(payment, rates, target) * (CYCLE_PER_MONTH[payment.cycle] || 1);
}

function totalsByMonthlyEquivalent(payments, rates, target) {
  return payments.reduce((s, p) => s + monthlyEquivalent(p, rates, target), 0);
}

function totalsPerCycle(payments, rates, target) {
  const t = { yearly: 0, monthly: 0, weekly: 0, daily: 0 };
  payments.forEach(p => { t[p.cycle] = (t[p.cycle] || 0) + priceIn(p, rates, target); });
  return t;
}

function countsPerCycle(payments) {
  const c = { yearly: 0, monthly: 0, weekly: 0, daily: 0 };
  payments.forEach(p => { c[p.cycle] = (c[p.cycle] || 0) + 1; });
  return c;
}

Object.assign(window, {
  SERVICE_CATALOG, CATEGORIES, CURRENCIES, CYCLE_LABEL, CYCLE_ORDER, ACCENT_PALETTE,
  seedPayments, getService, resolveService, isAutoPaid,
  paidThisMonth, plannedThisMonth,
  fmtMoney, daysUntil, fmtDateShort, fmtRelative, parseISODate,
  nextDateForDayOfMonth, nextDateForDayOfWeek, nextDateForMonthDay,
  dayOfMonthFromDate, dayOfWeekFromDate, monthFromDate,
  lastDayOfMonth, fmtLocalISO, todayLocalISO,
  MONTH_NAMES_SHORT, MONTH_NAMES_LONG,
  priceIn, monthlyEquivalent, totalsByMonthlyEquivalent, totalsPerCycle, countsPerCycle,
  CYCLE_PER_MONTH,
});
