// Expenses tab: how much went out this month, then every expense by day.
// Details (pace, categories, daily chart) live one tap away in the summary.
import React from 'react';
import { BudgetSettingsSheet, computeBudgetStats, useSubsMonthly } from '../budget.jsx';
import { fmtMoney } from '../data.jsx';
import { useToast } from '../feedback.jsx';
import {
  DAY_NAMES_HE, EditExpenseSheet, MONTH_NAMES_HE, ManageExpensesSheet, PendingInvitesCard,
  expenseDate, fmtDateHe, localISO, todayISO,
} from '../lists.jsx';
import { PayerDot, PayerPicker, PayerTotals, SpaceSwitcher } from '../spaces.jsx';
import { isSharedList } from '../lists.jsx';
import { CategoryBadge, CoinLogo } from '../ui/icons.jsx';
import { Card, EmptyState, Money, MonthSwitcher, Pill, ProgressBar } from '../ui/kit.jsx';
import { haptic } from '../lib/platform.js';

function dayLabel(iso) {
  if (iso === todayISO()) return 'היום';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === localISO(y)) return 'אתמול';
  const [yy, mm, dd] = iso.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  return `יום ${DAY_NAMES_HE[d.getDay()]}׳ · ${fmtDateHe(d)}`;
}

// Category and note under the title; the category is skipped when it is
// already the title (an expense saved without a name).
function subtitle(it) {
  return [it.title && it.title !== it.group ? it.group : null, it.note].filter(Boolean).join(' · ');
}

function ExpensesScreen({ lists, categories, payments, settings, setSettings, onQuickAdd, onCreateShared, onOpenSummary, suggestionsCard }) {
  const toast = useToast();
  const now = new Date();
  const [view, setView] = React.useState({ y: now.getFullYear(), m: now.getMonth() });
  const [filter, setFilter] = React.useState(null);
  const [payer, setPayer] = React.useState(null);
  const shared = isSharedList(lists.activeList);
  React.useEffect(() => { setFilter(null); setPayer(null); }, [lists.activeListId]);
  const [editItem, setEditItem] = React.useState(null);
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);

  const currency = settings.defaultCurrency || '₪';
  const prevMonth = new Date(view.y, view.m - 1, 1);
  const subsMonthly = useSubsMonthly(payments, currency, view.y, view.m);
  const prevSubs = useSubsMonthly(payments, currency, prevMonth.getFullYear(), prevMonth.getMonth());
  const args = {
    items: lists.items,
    income: Number(settings.monthlyIncome) || 0,
    cap: Number(settings.monthlyCap) || 0,
    subsMonthly, includeSubs: settings.includeSubsInBudget !== false,
    categories, categoryCaps: settings.categoryCaps || {},
  };
  const stats = React.useMemo(() => computeBudgetStats({ ...args, y: view.y, m: view.m }),
    [lists.items, settings, subsMonthly, categories.join('|'), view.y, view.m]);
  const prevStats = React.useMemo(
    () => computeBudgetStats({ ...args, subsMonthly: prevSubs, y: prevMonth.getFullYear(), m: prevMonth.getMonth() }),
    [lists.items, settings, prevSubs, categories.join('|'), view.y, view.m]);

  const atCurrent = view.y === now.getFullYear() && view.m === now.getMonth();
  const shift = (delta) => {
    setFilter(null);
    setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };
  const monthName = MONTH_NAMES_HE[view.m];
  const monthLabel = `${monthName} ${view.y}`;

  const byCategory = filter
    ? stats.monthItems.filter((it) => (filter === 'ללא קטגוריה' ? !it.group || !categories.includes(it.group) : it.group === filter))
    : stats.monthItems;
  const visible = shared && payer ? byCategory.filter((it) => (it.paidBy || it.addedBy) === payer) : byCategory;
  const days = React.useMemo(() => {
    const map = new Map();
    visible.forEach((it) => {
      const key = localISO(expenseDate(it));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const capColor = stats.overCap ? 'var(--danger)' : stats.pctUsed > 85 ? 'var(--warn)' : 'var(--accent)';

  return (
    <div style={{ padding: '18px 18px 120px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>הוצאות</h1>
        </div>
        <button onClick={() => setManageOpen(true)} aria-label="מרחבים ושיתוף" className="press" style={{
          width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
            <circle cx="11" cy="10" r="4.2" fill="#fff" stroke="#141414" strokeWidth="2" />
            <path d="M3.8 25.5a7.2 7.2 0 0 1 14.4 0Z" fill="#fff" stroke="#141414" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="21.5" cy="11" r="4.2" fill="#4F46E5" stroke="#141414" strokeWidth="2" />
            <path d="M14.3 26.5a7.2 7.2 0 0 1 14.4 0Z" fill="#4F46E5" stroke="#141414" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <SpaceSwitcher lists={lists} onCreateShared={onCreateShared} />
      <PendingInvitesCard lists={lists} />
      {suggestionsCard}

      {/* Month total */}
      <Card className="rise" style={{ marginTop: 16, padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <MonthSwitcher label={monthLabel} onPrev={() => shift(-1)} onNext={() => shift(1)} nextDisabled={atCurrent} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink-dim)' }}>הוצאת ב{monthName}</div>
          <Pill tone="neutral" onClick={onOpenSummary}>
            סיכום
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Pill>
        </div>
        <Money value={Math.round(stats.used)} size={54} decimals={0} currency={currency} style={{ marginTop: 4 }} />
        {stats.committed > 0 && (
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 6 }}>
            מתוכם {fmtMoney(Math.round(stats.committed), currency)} מנויים
          </div>
        )}
        {stats.hasCap ? (
          <>
            <ProgressBar pct={stats.pctUsed} color={capColor} style={{ marginTop: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 9, fontSize: 13.5, fontWeight: 700 }}>
              <span style={{ color: stats.overCap ? 'var(--danger)' : 'var(--ink)' }}>
                {stats.overCap ? `חריגה של ${fmtMoney(Math.round(-stats.remaining), currency)}` : `נשאר ${fmtMoney(Math.round(stats.remaining), currency)}`}
                {!stats.overCap && stats.isCurrent && stats.daysLeft > 0 && (
                  <span style={{ color: 'var(--ink-dim)', fontWeight: 600 }}> · {fmtMoney(Math.round(stats.dailyAllowance), currency)} ליום</span>
                )}
              </span>
              <span style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>מתוך {fmtMoney(stats.cap, currency)}</span>
            </div>
          </>
        ) : (
          <button onClick={() => setBudgetOpen(true)} style={{
            marginTop: 12, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--accent-ink)', fontSize: 14, fontWeight: 800,
          }}>+ הגדר תקציב חודשי</button>
        )}
      </Card>

      {/* Who paid what (shared space) */}
      {shared && stats.count > 0 && (
        <PayerTotals list={lists.activeList} items={stats.monthItems} currency={currency}
          value={payer} onChange={setPayer} style={{ marginTop: 14 }} />
      )}

      {/* Category filter */}
      {stats.catRows.length > 0 && (
        <div className="hide-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '16px -18px 0', padding: '2px 18px' }}>
          {[{ cat: null, sum: stats.spent }, ...stats.catRows].map((r) => {
            const on = filter === r.cat;
            return (
              <button key={r.cat || 'all'} onClick={() => { haptic('select'); setFilter(on ? null : r.cat); }} className="press" style={{
                display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                border: 'none', borderRadius: 999, padding: r.cat ? '5px 14px 5px 6px' : '9px 15px',
                background: on ? 'var(--ink)' : 'var(--surface-1)', color: on ? 'var(--bg)' : 'var(--ink)',
                boxShadow: on ? 'none' : 'var(--shadow-card)', transition: 'background-color .2s ease, color .2s ease',
              }}>
                {r.cat && <CategoryBadge name={r.cat} size={30} />}
                <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.cat || 'הכל'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.sum, currency)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expenses by day */}
      {lists.loading ? null : stats.count === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState
            title={`עוד אין הוצאות ב${monthName}`}
            text="הוצאה חדשה נכנסת בכמה הקשות"
            action={atCurrent ? 'הוסף הוצאה' : null}
            onAction={() => onQuickAdd()}
          >
            <CoinLogo size={64} />
          </EmptyState>
        </Card>
      ) : (
        <div key={`${view.y}-${view.m}-${filter || ''}-${payer || ''}`}>
          {days.map(([iso, items], di) => {
            const sum = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
            return (
              <section key={iso} className="rise" style={{ animationDelay: `${Math.min(di, 6) * 45}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 4px 8px', fontSize: 13.5, fontWeight: 800, color: 'var(--ink-dim)' }}>
                  <span>{dayLabel(iso)}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(sum, currency)}</span>
                </div>
                <Card style={{ padding: '2px 14px' }}>
                  {items.map((it, i) => (
                    <button key={it.id} onClick={() => { haptic('tap'); setEditItem(it); }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                      border: 'none', borderTop: i ? '1px solid var(--divider)' : 'none', background: 'transparent',
                      cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'start',
                    }}>
                      <CategoryBadge name={it.group || ''} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.title || it.group || 'הוצאה'}
                        </div>
                        {subtitle(it) && (
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {subtitle(it)}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {fmtMoney(it.amount, currency)}
                      </div>
                      {shared && <PayerDot list={lists.activeList} payer={it.paidBy || it.addedBy} />}
                    </button>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      <EditExpenseSheet open={!!editItem} onClose={() => setEditItem(null)}
        item={editItem} categories={categories}
        renderPayer={shared ? (value, set) => <PayerPicker list={lists.activeList} value={value} onChange={set} /> : null}
        onSave={(item) => { lists.ops.updateItem(lists.activeListId, item); setEditItem(null); toast('נשמר', { type: 'success' }); }}
        onDelete={(id) => { haptic('warning'); lists.ops.removeItem(lists.activeListId, id); setEditItem(null); toast('נמחק', { type: 'info' }); }} />
      <BudgetSettingsSheet open={budgetOpen} onClose={() => setBudgetOpen(false)}
        settings={settings} setSettings={setSettings} categories={categories} subsMonthly={subsMonthly} />
      <ManageExpensesSheet open={manageOpen} onClose={() => setManageOpen(false)} lists={lists} />
    </div>
  );
}

export { ExpensesScreen };
