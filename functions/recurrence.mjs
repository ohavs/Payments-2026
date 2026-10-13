// Recurring payments store one anchor date (`nextDate`, YYYY-MM-DD) and a
// cycle. The stored date is never rewritten as time passes, so every "when is
// it due" question is answered by projecting the anchor forward here.
//
// Monthly and yearly occurrences keep the anchor's day of month and clamp it
// to short months: an anchor on Jan 31 falls on Feb 28, then Mar 31 again.
//
// All dates are local midnights. This file has no imports so the Cloud
// Function can use an identical copy (functions/recurrence.mjs).

const DAY_MS = 86400000;

export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function toISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function clampedDate(year, month, day) {
  const first = new Date(year, month, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(day, last));
}

// The k-th occurrence (k >= 0) counting from the anchor itself.
export function occurrence(anchor, cycle, k) {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  switch (cycle) {
    case 'daily': return new Date(y, m, d + k);
    case 'weekly': return new Date(y, m, d + 7 * k);
    case 'yearly': return clampedDate(y + k, m, d);
    default: return clampedDate(y, m + k, d); // monthly
  }
}

// Index of the first occurrence on or after `day`.
function firstIndexOnOrAfter(anchor, cycle, day) {
  if (anchor >= day) return 0;
  const days = Math.round((day - anchor) / DAY_MS);
  let k;
  switch (cycle) {
    case 'daily': k = days; break;
    case 'weekly': k = Math.ceil(days / 7); break;
    case 'yearly': k = day.getFullYear() - anchor.getFullYear() - 1; break;
    default: k = (day.getFullYear() - anchor.getFullYear()) * 12 + day.getMonth() - anchor.getMonth() - 1;
  }
  k = Math.max(0, k - 1);
  while (occurrence(anchor, cycle, k) < day) k++;
  return k;
}

// Next charge on or after today, or null when the payment has no valid date.
export function nextOccurrence(payment, today = new Date()) {
  const anchor = parseISO(payment.nextDate);
  if (!anchor) return null;
  return occurrence(anchor, payment.cycle, firstIndexOnOrAfter(anchor, payment.cycle, startOfDay(today)));
}

// Most recent charge strictly before today, or null if none since the anchor.
export function lastOccurrenceBefore(payment, today = new Date()) {
  const anchor = parseISO(payment.nextDate);
  if (!anchor) return null;
  const k = firstIndexOnOrAfter(anchor, payment.cycle, startOfDay(today)) - 1;
  return k < 0 ? null : occurrence(anchor, payment.cycle, k);
}

// Every charge between two dates, both inclusive. Nothing before the anchor.
export function occurrencesBetween(payment, from, to) {
  const anchor = parseISO(payment.nextDate);
  if (!anchor) return [];
  const end = startOfDay(to);
  const out = [];
  for (let k = firstIndexOnOrAfter(anchor, payment.cycle, startOfDay(from)); out.length < 400; k++) {
    const d = occurrence(anchor, payment.cycle, k);
    if (d > end) break;
    out.push(d);
  }
  return out;
}

// A monthly or yearly payment counts as paid once this month's charge has gone
// through. Weekly and daily ones are always "upcoming": their next charge is
// days away.
export function isPaidThisCycle(payment, today = new Date()) {
  if (payment.cycle !== 'monthly' && payment.cycle !== 'yearly') return false;
  const last = lastOccurrenceBefore(payment, today);
  return !!last && last.getFullYear() === today.getFullYear() && last.getMonth() === today.getMonth();
}

// Whole days from today until the next charge (0 = today).
export function daysUntilNext(payment, today = new Date()) {
  const next = nextOccurrence(payment, today);
  return next ? Math.round((next - startOfDay(today)) / DAY_MS) : null;
}
