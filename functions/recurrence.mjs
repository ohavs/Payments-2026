// Recurring payments store one anchor date (`nextDate`, YYYY-MM-DD) and a
// cycle. The stored date is never rewritten as time passes, so every "when is
// it due" question is answered by projecting the anchor forward here.
//
// Monthly and yearly occurrences keep the anchor's day of month and clamp it
// to short months: an anchor on Jan 31 falls on Feb 28, then Mar 31 again.
//
// A paused payment keeps its past charges and has none from the day it was
// paused until the day it was resumed. `pauses` lists them as {from, to}
// (YYYY-MM-DD, `to` exclusive); the current pause has no `to`.
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

// The pause covering `d`, if any.
function pauseAt(payment, d) {
  const iso = toISO(d);
  return (payment.pauses || []).find((x) => x.from <= iso && (!x.to || iso < x.to)) || null;
}

export function isPaused(payment) {
  return (payment.pauses || []).some((x) => x.from && !x.to);
}

// Paused from today on. Pausing on the day it was resumed continues that pause.
export function pausedFrom(payment, today = new Date()) {
  const iso = toISO(startOfDay(today));
  const pauses = (payment.pauses || []).filter((x) => x.from);
  const last = pauses[pauses.length - 1];
  if (last && !last.to) return pauses;
  if (last && last.to === iso) return [...pauses.slice(0, -1), { from: last.from }];
  return [...pauses, { from: iso }];
}

// Charged again from today on. A pause that started today is dropped.
export function resumedFrom(payment, today = new Date()) {
  const iso = toISO(startOfDay(today));
  return (payment.pauses || []).flatMap((x) => {
    if (!x.from || x.to) return [x];
    return x.from >= iso ? [] : [{ from: x.from, to: iso }];
  });
}

// True when a pause covers every day from `from` to `to`, both inclusive.
export function pausedThrough(payment, from, to) {
  const a = toISO(from), b = toISO(to);
  return (payment.pauses || []).some((x) => x.from <= a && (!x.to || x.to > b));
}

// Index of the first charge on or after `day` that isn't paused, or -1.
function firstActiveIndex(payment, anchor, day) {
  let k = firstIndexOnOrAfter(anchor, payment.cycle, day);
  for (;;) {
    const p = pauseAt(payment, occurrence(anchor, payment.cycle, k));
    if (!p) return k;
    if (!p.to) return -1;
    k = firstIndexOnOrAfter(anchor, payment.cycle, parseISO(p.to));
  }
}

// Next charge on or after today, or null when the payment has no valid date
// or is paused.
export function nextOccurrence(payment, today = new Date()) {
  const anchor = parseISO(payment.nextDate);
  if (!anchor) return null;
  const k = firstActiveIndex(payment, anchor, startOfDay(today));
  return k < 0 ? null : occurrence(anchor, payment.cycle, k);
}

// Most recent charge strictly before today, or null if none since the anchor.
export function lastOccurrenceBefore(payment, today = new Date()) {
  const anchor = parseISO(payment.nextDate);
  if (!anchor) return null;
  let k = firstIndexOnOrAfter(anchor, payment.cycle, startOfDay(today)) - 1;
  while (k >= 0) {
    const d = occurrence(anchor, payment.cycle, k);
    const p = pauseAt(payment, d);
    if (!p) return d;
    k = firstIndexOnOrAfter(anchor, payment.cycle, parseISO(p.from)) - 1;
  }
  return null;
}

// Every charge between two dates, both inclusive. Nothing before the anchor
// and nothing while paused.
export function occurrencesBetween(payment, from, to) {
  const anchor = parseISO(payment.nextDate);
  if (!anchor) return [];
  const end = startOfDay(to);
  const out = [];
  let k = firstActiveIndex(payment, anchor, startOfDay(from));
  while (k >= 0 && out.length < 400) {
    const d = occurrence(anchor, payment.cycle, k);
    if (d > end) break;
    out.push(d);
    k = firstActiveIndex(payment, anchor, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
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
