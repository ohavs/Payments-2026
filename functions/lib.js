// Pure helpers for the Cloud Functions (no Firebase imports), unit tested from
// the app's test suite (functions/lib.test.js).

const SERVICE_NAMES = {
  netflix: 'Netflix', spotify: 'Spotify', ytpremium: 'YouTube Premium',
  disney: 'Disney+', applemusic: 'Apple Music', appletv: 'Apple TV+', icloud: 'iCloud+',
  partner: 'פרטנר', cellcom: 'סלקום', pelephone: 'פלאפון', hotmobile: 'הוט מובייל', golan: 'גולן טלקום',
  bezeq: 'בזק', hot: 'הוט', yes: 'YES', cellcomtv: 'סלקום TV',
  chatgpt: 'ChatGPT Plus', claude: 'Claude', figma: 'Figma', adobe: 'Adobe CC',
  github: 'GitHub Pro', notion: 'Notion', linear: 'Linear',
  ins_car: 'ביטוח רכב', ins_home: 'ביטוח דירה', ins_health: 'ביטוח בריאות', ins_life: 'ביטוח חיים',
  electric: 'חשמל', water: 'מים', arnona: 'ארנונה', gas: 'גז', vaad: 'ועד בית',
  holmes: 'Holmes Place', goactive: 'Go Active', sport: 'חוגי ספורט',
  nyt: 'NY Times', parking: 'חניה', haaretz: 'הארץ דיגיטל', rav: 'רב-קו',
};

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// Rough ILS rates, only for adding foreign-currency subscriptions into a cap.
const TO_ILS = { '₪': 1, $: 3.7, '€': 4, '£': 4.7 };
const PER_MONTH = { yearly: 1 / 12, monthly: 1, weekly: 30 / 7, daily: 30 };

function serviceName(p) {
  return p.customService?.name || SERVICE_NAMES[p.serviceId] || p.serviceId || 'תשלום';
}

function fmtMoney(amount, cur = '₪') {
  const n = Number(amount || 0);
  const s = n.toLocaleString('he-IL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${cur || '₪'}${s}`;
}

function whenLabel(diff) {
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff > 1) return `בעוד ${diff} ימים`;
  return '';
}

// 'YYYY-MM' and the first/last 'YYYY-MM-DD' of a month (expenses store dates as strings).
function monthRange(y, m) {
  const mm = String(m + 1).padStart(2, '0');
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { key: `${y}-${mm}`, from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function sumAmounts(items) {
  return items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
}

function subsMonthly(subs) {
  return subs.reduce((s, p) => s + (Number(p.price) || 0) * (TO_ILS[p.currency || '₪'] || 1) * (PER_MONTH[p.cycle] || 1), 0);
}

// Which alert to send after a new expense: 100 when the cap was just
// crossed, 80 when 80% was, else null. `sent` is the highest already sent
// this month, so each threshold goes out once.
function budgetThreshold(used, cap, sent = 0) {
  if (!(cap > 0)) return null;
  const pct = (used / cap) * 100;
  if (pct >= 100 && sent < 100) return 100;
  if (pct >= 80 && sent < 80) return 80;
  return null;
}

function budgetMessage(threshold, used, cap, spaceName) {
  const where = spaceName ? ` ב${spaceName}` : '';
  return threshold >= 100
    ? { title: 'עברת את התקציב החודשי', body: `${fmtMoney(Math.round(used))} מתוך ${fmtMoney(cap)}${where}` }
    : { title: 'הגעת ל־80% מהתקציב', body: `נשארו ${fmtMoney(Math.round(cap - used))} עד סוף החודש${where}` };
}

function summaryMessage(monthIndex, total, prevTotal) {
  const name = MONTHS_HE[monthIndex];
  let body = `ב${name} הוצאת ${fmtMoney(Math.round(total))}`;
  if (prevTotal > 0) {
    const pct = Math.round(((total - prevTotal) / prevTotal) * 100);
    if (pct < 0) body += `, ${-pct}% פחות מ${MONTHS_HE[(monthIndex + 11) % 12]} 🎉`;
    else if (pct > 0) body += `, ${pct}% יותר מ${MONTHS_HE[(monthIndex + 11) % 12]}`;
    else body += `, בדיוק כמו ב${MONTHS_HE[(monthIndex + 11) % 12]}`;
  }
  return { title: `הסיכום של ${name}`, body };
}

function expenseMessage(item, actorName, spaceName) {
  const what = item.title && item.title !== item.group ? `${item.title} · ${item.group || ''}`.replace(/ · $/, '') : (item.group || 'הוצאה');
  return {
    title: `${actorName || 'מישהו'} הוסיף/ה ${fmtMoney(item.amount)}`,
    body: `${what}${spaceName ? ` · ${spaceName}` : ''}`,
  };
}

module.exports = {
  budgetMessage, budgetThreshold, expenseMessage, fmtMoney, monthRange, serviceName,
  subsMonthly, sumAmounts, summaryMessage, whenLabel,
};
