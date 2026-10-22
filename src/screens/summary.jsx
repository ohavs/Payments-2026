// Summary tab: where the month's money went. Kept out of the expenses tab so
// adding and tracking stay front and centre there.
import React from 'react';
import { BudgetSettingsSheet, DailyBars, computeBudgetStats, useSubsMonthly } from '../budget.jsx';
import { activeInMonth, fmtMoney } from '../data.jsx';
import { MONTH_NAMES_HE, isSharedList } from '../lists.jsx';
import { PayerTotals } from '../spaces.jsx';
import { CategoryBadge, categoryVisual } from '../ui/icons.jsx';
import { Card, EmptyState, Money, MonthSwitcher, Pill, ProgressBar } from '../ui/kit.jsx';
import { haptic } from '../lib/platform.js';

function SectionLabel({ children }) {
  return <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink-dim)', margin: '22px 6px 8px' }}>{children}</div>;
}

function Tile({ label, value, sub, tone }) {
  const color = tone === 'bad' ? 'var(--danger)' : tone === 'good' ? 'var(--accent-ink)' : 'var(--ink)';
  return (
    <Card style={{ padding: '14px 15px', borderRadius: 22 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-dim)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 4, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function SummaryScreen({ lists, categories, payments, settings, setSettings, onOpenSubs }) {
  const now = new Date();
  const [view, setView] = React.useState({ y: now.getFullYear(), m: now.getMonth() });
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  const [payer, setPayer] = React.useState(null);
  const shared = isSharedList(lists.activeList);
  const currency = settings.defaultCurrency || '₪';
  const prevMonth = new Date(view.y, view.m - 1, 1);
  const subsMonthly = useSubsMonthly(payments, currency, view.y, view.m);
  const prevSubs = useSubsMonthly(payments, currency, prevMonth.getFullYear(), prevMonth.getMonth());
  const subsCount = activeInMonth(payments, view.y, view.m).length;
  const args = {
    items: lists.items,
    income: Number(settings.monthlyIncome) || 0,
    cap: Number(settings.monthlyCap) || 0,
    subsMonthly, includeSubs: settings.includeSubsInBudget !== false,
    categories, categoryCaps: settings.categoryCaps || {},
  };
  const deps = [lists.items, settings, subsMonthly, prevSubs, categories.join('|'), view.y, view.m];
  const stats = React.useMemo(() => computeBudgetStats({ ...args, y: view.y, m: view.m }), deps);
  const prev = React.useMemo(
    () => computeBudgetStats({ ...args, subsMonthly: prevSubs, y: prevMonth.getFullYear(), m: prevMonth.getMonth() }),
    deps);

  const atCurrent = view.y === now.getFullYear() && view.m === now.getMonth();
  const shift = (d) => { haptic('select'); setView((v) => { const x = new Date(v.y, v.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; }); };
  const monthName = MONTH_NAMES_HE[view.m];
  const delta = prev.used > 0 ? Math.round(((stats.used - prev.used) / prev.used) * 100) : null;
  const capColor = stats.overCap ? 'var(--danger)' : stats.pctUsed > 85 ? 'var(--warn)' : 'var(--accent)';
  const money = (n) => fmtMoney(Math.round(n), currency);

  return (
    <div style={{ padding: '18px 18px 120px' }}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>סיכום</h1>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-dim)', marginTop: 4 }}>{lists.activeList?.name || 'ההוצאות שלי'}</div>

      <Card className="rise" style={{ marginTop: 16, padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <MonthSwitcher label={`${monthName} ${view.y}`} onPrev={() => shift(-1)} onNext={() => shift(1)} nextDisabled={atCurrent} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink-dim)' }}>סה״כ ב{monthName}</div>
          {delta !== null && (
            <Pill tone={delta > 0 ? 'red' : 'green'}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% מהחודש הקודם
            </Pill>
          )}
        </div>
        <Money value={Math.round(stats.used)} size={54} decimals={0} currency={currency} style={{ marginTop: 4 }} />
        {stats.committed > 0 && (
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 6 }}>
            {money(stats.spent)} הוצאות · {money(stats.committed)} מנויים
          </div>
        )}
        {stats.hasCap && (
          <>
            <ProgressBar pct={stats.pctUsed} color={capColor} style={{ marginTop: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, fontSize: 13.5, fontWeight: 700 }}>
              <span style={{ color: stats.overCap ? 'var(--danger)' : 'var(--ink)' }}>
                {stats.overCap ? `חריגה של ${money(-stats.remaining)}` : `נשאר ${money(stats.remaining)}`}
              </span>
              <span style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>מתוך {money(stats.cap)}</span>
            </div>
          </>
        )}
      </Card>

      {stats.count === 0 && stats.committed === 0 ? (
        <EmptyState title={`אין עדיין נתונים ל${monthName}`} text="הסיכום יתמלא ככל שתוסיף הוצאות" />
      ) : (
        <>
          <div className="rise" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            {stats.isCurrent && stats.hasCap && stats.daysLeft > 0 ? (
              <Tile label="אפשר ליום" value={money(stats.dailyAllowance)} sub={`${stats.daysLeft} ימים נותרו`}
                tone={stats.onPace ? 'good' : 'bad'} />
            ) : (
              <Tile label="ממוצע ליום" value={money(stats.avgPerDay)} sub={`${stats.count} הוצאות`} />
            )}
            {stats.isCurrent ? (
              <Tile label="צפי לסוף החודש" value={money(stats.projected)}
                tone={stats.hasCap ? (stats.projected > stats.cap ? 'bad' : 'good') : undefined}
                sub={stats.hasCap ? (stats.projected > stats.cap ? 'מעל התקציב' : 'בתוך התקציב') : 'לפי הקצב עד כה'} />
            ) : (
              <Tile label="חודש קודם" value={money(prev.used)} sub={delta === null ? '' : `${delta > 0 ? '+' : ''}${delta}%`} />
            )}
            {stats.hasIncome && (
              <Tile label="נשאר מההכנסה" value={money(stats.savings)} tone={stats.savings >= 0 ? 'good' : 'bad'}
                sub={`${Math.round(stats.pctOfIncome)}% מההכנסה הוצאו`} />
            )}
            {subsMonthly > 0 && (
              <button onClick={onOpenSubs} className="press" style={{ border: 'none', padding: 0, background: 'transparent', textAlign: 'inherit', fontFamily: 'inherit', cursor: 'pointer', color: 'inherit' }}>
                <Tile label="מנויים לחודש" value={money(subsMonthly)} sub={subsCount === 1 ? 'מנוי אחד' : `${subsCount} מנויים`} />
              </button>
            )}
          </div>

          {shared && stats.count > 0 && (
            <>
              <SectionLabel>מי שילם</SectionLabel>
              <PayerTotals list={lists.activeList} items={stats.monthItems} currency={currency} value={payer} onChange={setPayer} />
            </>
          )}

          {stats.catRows.length > 0 && (
            <>
              <SectionLabel>לפי קטגוריה</SectionLabel>
              <Card className="rise" style={{ padding: '6px 16px' }}>
                {stats.catRows.map((r, i) => {
                  const pct = r.cap > 0 ? r.capPct : r.pct;
                  return (
                    <div key={r.cat} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i ? '1px solid var(--divider)' : 'none' }}>
                      <CategoryBadge name={r.cat} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cat}</span>
                          <span style={{ fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: r.overCap ? 'var(--danger)' : 'var(--ink)' }}>
                            {money(r.sum)}
                            <span style={{ color: 'var(--ink-dim)', fontWeight: 600, fontSize: 12.5 }}>{r.cap > 0 ? ` / ${money(r.cap)}` : ` · ${r.pct}%`}</span>
                          </span>
                        </div>
                        <ProgressBar pct={pct} height={8} color={r.overCap ? 'var(--danger)' : (categoryVisual(r.cat).color || 'var(--accent)')} style={{ marginTop: 7 }} />
                      </div>
                    </div>
                  );
                })}
              </Card>
            </>
          )}

          {stats.count > 0 && (
            <>
              <SectionLabel>הוצאה יומית</SectionLabel>
              <Card className="rise" style={{ padding: '16px 16px 12px' }}>
                <DailyBars stats={stats} />
              </Card>
            </>
          )}

          {stats.top.length > 0 && (
            <>
              <SectionLabel>ההוצאות הגדולות</SectionLabel>
              <Card className="rise" style={{ padding: '4px 16px' }}>
                {stats.top.map((it, i) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--divider)' : 'none' }}>
                    <CategoryBadge name={it.group || 'שונות'} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title || 'הוצאה'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 600 }}>{it.group || 'ללא קטגוריה'}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(it.amount, currency)}</div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <button onClick={() => { haptic('tap'); setBudgetOpen(true); }} className="press" style={{
        display: 'block', margin: '22px auto 0', border: 'none', borderRadius: 16, padding: '12px 20px', cursor: 'pointer',
        background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800,
      }}>{stats.hasCap ? 'עריכת תקציב' : '+ הגדר תקציב חודשי'}</button>

      <BudgetSettingsSheet open={budgetOpen} onClose={() => setBudgetOpen(false)}
        settings={settings} setSettings={setSettings} categories={categories} subsMonthly={subsMonthly} />
    </div>
  );
}

export { SummaryScreen };
