// Monthly budget tool — sits on top of the expenses tracker.
//
// The user sets a monthly income and a spending ceiling (cap). Everything else
// is derived: what's left to spend, an allowed daily rate for the days left,
// whether spending is ahead of or behind pace, an end-of-month projection,
// share of income, expected savings, per-category ceilings and a daily chart.
//
// Reuses helpers from lists.jsx (expenseDate, localISO, MONTH_NAMES_HE,
// FieldInput, Label, PrimaryButton, Section, ghostBtn) and data.jsx (fmtMoney).
import React from 'react';
import { Chip, Icon, IconButton, Sheet, Toggle } from './components.jsx';
import { activeInMonth, fmtMoney, totalsByMonthlyEquivalent } from './data.jsx';
import { useToast } from './feedback.jsx';
import { useExchangeRates } from './fx.jsx';
import { FieldInput, PrimaryButton, Section, expenseDate, ghostBtn, useStickyState } from './lists.jsx';

// Clamp a number into [lo, hi].
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// All budget maths for one month.
//   items        — every expense of the active tracker
//   y, m         — the month being viewed
//   income, cap  — user settings
//   subsMonthly  — monthly equivalent of recurring payments
//   includeSubs  — count subsMonthly as committed spend
//   categories, categoryCaps
function computeBudgetStats({ items, y, m, income = 0, cap = 0, subsMonthly = 0, includeSubs = true, categories = [], categoryCaps = {} }) {
  const monthItems = (items || []).filter(it => {
    const d = expenseDate(it);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const spent = monthItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const committed = includeSubs ? (Number(subsMonthly) || 0) : 0;
  const used = spent + committed;

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const now = new Date();
  const isCurrent = now.getFullYear() === y && now.getMonth() === m;
  const isFuture = (y > now.getFullYear()) || (y === now.getFullYear() && m > now.getMonth());
  // Day index used for pace maths: today for the current month, the whole month
  // for a past one, nothing for a future one.
  const dayOfMonth = isCurrent ? now.getDate() : (isFuture ? 0 : daysInMonth);
  const daysLeft = isCurrent ? (daysInMonth - dayOfMonth + 1) : (isFuture ? daysInMonth : 0);

  const hasCap = cap > 0;
  const remaining = hasCap ? cap - used : 0;
  const pctUsed = hasCap ? clamp(used / cap * 100, 0, 999) : 0;
  const overCap = hasCap && used > cap;

  // Allowed spend per remaining day (today included) to land exactly on the cap.
  const dailyAllowance = (hasCap && daysLeft > 0) ? Math.max(0, remaining) / daysLeft : 0;
  // Where spending "should" be by now if spread evenly across the month.
  const expectedByNow = (hasCap && dayOfMonth > 0) ? cap * (dayOfMonth / daysInMonth) : 0;
  const paceDelta = hasCap ? used - expectedByNow : 0;   // > 0 → ahead of budget
  const onPace = !hasCap ? true : paceDelta <= 0;
  // End-of-month projection from the current burn rate (subs are fixed).
  const projected = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth + committed : committed;
  const avgPerDay = dayOfMonth > 0 ? spent / dayOfMonth : 0;

  const hasIncome = income > 0;
  const savings = hasIncome ? income - used : 0;
  const pctOfIncome = hasIncome ? clamp(used / income * 100, 0, 999) : 0;

  // Per-category totals, sorted big → small, with optional per-category caps.
  const catMap = {};
  categories.forEach(c => { catMap[c] = { cat: c, sum: 0, count: 0 }; });
  let otherSum = 0, otherCount = 0;
  monthItems.forEach(it => {
    const amt = Number(it.amount) || 0;
    if (it.group && catMap[it.group]) { catMap[it.group].sum += amt; catMap[it.group].count++; }
    else { otherSum += amt; otherCount++; }
  });
  const catRows = Object.values(catMap).filter(r => r.count > 0);
  if (otherCount > 0) catRows.push({ cat: 'ללא קטגוריה', sum: otherSum, count: otherCount });
  catRows.sort((a, b) => b.sum - a.sum);
  catRows.forEach(r => {
    r.pct = spent > 0 ? Math.round(r.sum / spent * 100) : 0;
    const c = Number(categoryCaps?.[r.cat]) || 0;
    r.cap = c;
    r.capPct = c > 0 ? clamp(r.sum / c * 100, 0, 999) : 0;
    r.overCap = c > 0 && r.sum > c;
  });

  // Spend per calendar day, for the bar chart.
  const daily = Array.from({ length: daysInMonth }, () => 0);
  monthItems.forEach(it => {
    const d = expenseDate(it);
    const idx = d.getDate() - 1;
    if (idx >= 0 && idx < daysInMonth) daily[idx] += Number(it.amount) || 0;
  });
  const dailyMax = daily.reduce((mx, v) => Math.max(mx, v), 0);

  const top = monthItems.slice().sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 3);

  return {
    monthItems, count: monthItems.length,
    spent, committed, used, hasCap, cap, remaining, pctUsed, overCap,
    daysInMonth, dayOfMonth, daysLeft, isCurrent, isFuture,
    dailyAllowance, expectedByNow, paceDelta, onPace, projected, avgPerDay,
    hasIncome, income, savings, pctOfIncome,
    catRows, daily, dailyMax, top,
  };
}

// Monthly equivalent of the recurring payments that count in a month (default:
// this one), in the user's currency. A payment paused all month doesn't count.
function useSubsMonthly(payments, currency, y, m) {
  const fx = useExchangeRates();
  const now = new Date();
  const yy = y ?? now.getFullYear(), mm = m ?? now.getMonth();
  return React.useMemo(
    () => totalsByMonthlyEquivalent(activeInMonth(payments || [], yy, mm), fx?.rates, currency || '₪'),
    [payments, fx?.rates, currency, yy, mm]
  );
}

function SubTitle({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-dim)', letterSpacing: '.06em',
      textTransform: 'uppercase', marginBottom: 11 }}>{children}</div>
  );
}

// ---------- Settings sheet ----------
function BudgetSettingsSheet({ open, onClose, settings, setSettings, categories, subsMonthly }) {
  const [income, setIncome] = React.useState('');
  const [cap, setCap] = React.useState('');
  const [includeSubs, setIncludeSubs] = React.useState(true);
  const [caps, setCaps] = React.useState({});
  const toast = useToast();

  React.useEffect(() => {
    if (!open) return;
    setIncome(settings.monthlyIncome ? String(settings.monthlyIncome) : '');
    setCap(settings.monthlyCap ? String(settings.monthlyCap) : '');
    setIncludeSubs(settings.includeSubsInBudget !== false);
    setCaps({ ...(settings.categoryCaps || {}) });
  }, [open]);

  const save = () => {
    const cleanCaps = {};
    Object.keys(caps).forEach(k => { const v = Number(caps[k]); if (v > 0) cleanCaps[k] = v; });
    setSettings({
      ...settings,
      monthlyIncome: Number(income) || 0,
      monthlyCap: Number(cap) || 0,
      includeSubsInBudget: includeSubs,
      categoryCaps: cleanCaps,
    });
    toast('התקציב נשמר', { type: 'success' });
    onClose();
  };

  // Suggest a ceiling that leaves room to save from the stated income.
  const suggest = (frac) => {
    const inc = Number(income) || 0;
    if (inc > 0) setCap(String(Math.round(inc * frac)));
  };
  const capSum = Object.keys(caps).reduce((s, k) => s + (Number(caps[k]) || 0), 0);

  return (
    <Sheet open={open} onClose={onClose} title="הגדרות תקציב" height="92%">
      <div style={{ padding: '18px 22px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Section title="הכנסה חודשית">
          <FieldInput value={income} onChange={setIncome} placeholder="₪0" type="number" inputMode="decimal" big />
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8, lineHeight: 1.5 }}>
            משמש לחישוב אחוז הניצול והחיסכון הצפוי.
          </div>
        </Section>

        <Section title="תקרת הוצאות לחודש">
          <FieldInput value={cap} onChange={setCap} placeholder="₪0" type="number" inputMode="decimal" big />
          {Number(income) > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <Chip onClick={() => suggest(0.5)}>50% מההכנסה</Chip>
              <Chip onClick={() => suggest(0.7)}>70%</Chip>
              <Chip onClick={() => suggest(0.8)}>80%</Chip>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 8, lineHeight: 1.5 }}>
            הסכום שלא תרצה לעבור. ממנו נגזרים "נשאר לבזבז", "מותר ליום" והקצב.
          </div>
        </Section>

        <Section title="מנויים ותשלומים קבועים">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: 'var(--surface-2)', borderRadius: 14, padding: '13px 15px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>לכלול בתקציב</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                שווה-ערך חודשי: {fmtMoney(subsMonthly)}
              </div>
            </div>
            <Toggle checked={includeSubs} onChange={setIncludeSubs} />
          </div>
        </Section>

        {categories.length > 0 && (
          <Section title="תקרה לכל קטגוריה (אופציונלי)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.map(c => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
                  <div style={{ width: 118 }}>
                    <FieldInput value={caps[c] == null ? '' : String(caps[c])}
                      onChange={(v) => setCaps(prev => ({ ...prev, [c]: v }))}
                      placeholder="ללא" type="number" inputMode="decimal" />
                  </div>
                </div>
              ))}
            </div>
            {capSum > 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
                סך התקרות: {fmtMoney(capSum)}{Number(cap) > 0 && capSum > Number(cap) ? ' — גבוה מהתקרה הכללית' : ''}
              </div>
            )}
          </Section>
        )}

        <PrimaryButton onClick={save}>שמור תקציב</PrimaryButton>
      </div>
    </Sheet>
  );
}

export { BudgetSettingsSheet, computeBudgetStats, useSubsMonthly };
