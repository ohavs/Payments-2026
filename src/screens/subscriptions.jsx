// Subscriptions tab: monthly total, the next charge, then everything grouped by
// when it's due. A calendar view shows the month's charges by day.
import React from 'react';
import { ServiceBubble } from '../components.jsx';
import {
  CYCLE_LABEL, fmtDateShort, fmtMoney, fmtRelative, isAutoPaid, nextDueISO, parseISODate,
  resolveService, statusDateISO, totalsByMonthlyEquivalent,
} from '../data.jsx';
import { useExchangeRates } from '../fx.jsx';
import { useStickyState } from '../lists.jsx';
import { CalendarScreen, StatsDetailSheet } from '../screens.jsx';
import { SpaceSwitcher } from '../spaces.jsx';
import { CoinLogo } from '../ui/icons.jsx';
import { Card, EmptyState, Money, Pill, Segmented } from '../ui/kit.jsx';
import { haptic } from '../lib/platform.js';

function daysFromToday(iso) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((parseISODate(iso) - t) / 86400000);
}

function SubscriptionsScreen({ payments, loading, lists, onCreateShared, settings, onOpenPayment, onOpenAdd }) {
  const fx = useExchangeRates();
  const currency = settings.defaultCurrency || '₪';
  const [calendar, setCalendar] = useStickyState('subs.calendar', false);
  const [statsOpen, setStatsOpen] = React.useState(false);

  const monthly = totalsByMonthlyEquivalent(payments, fx?.rates, currency);

  const { next, groups } = React.useMemo(() => {
    const today = new Date();
    const rows = payments.map((p) => ({ p, paid: isAutoPaid(p), due: nextDueISO(p) }));
    const upcoming = rows.filter((r) => !r.paid).sort((a, b) => a.due.localeCompare(b.due));
    const paid = rows.filter((r) => r.paid).sort((a, b) => statusDateISO(a.p).localeCompare(statusDateISO(b.p)));
    const g = [
      { title: 'השבוע', rows: upcoming.filter((r) => daysFromToday(r.due) <= 7) },
      {
        title: 'עוד החודש',
        rows: upcoming.filter((r) => {
          const d = parseISODate(r.due);
          return daysFromToday(r.due) > 7 && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }),
      },
    ];
    const used = new Set(g.flatMap((x) => x.rows));
    g.push({ title: 'בהמשך', rows: upcoming.filter((r) => !used.has(r)) });
    g.push({ title: 'שולם החודש', rows: paid, paid: true });
    return { next: upcoming[0], groups: g.filter((x) => x.rows.length) };
  }, [payments]);

  return (
    <div style={{ padding: '18px 18px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>מנויים</h1>
        <button onClick={() => { haptic('tap'); onOpenAdd(); }} className="press" style={{
          height: 42, padding: '0 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)', color: 'var(--ink)',
          fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
        }}>+ מנוי</button>
      </div>
      <SpaceSwitcher lists={lists} onCreateShared={onCreateShared} />

      {!loading && payments.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <EmptyState title="עוד אין מנויים" text="Netflix, חשמל, ביטוח… כל חיוב קבוע, עם תזכורת לפני שהוא יורד"
            action="הוסף מנוי" onAction={onOpenAdd}>
            <CoinLogo size={64} />
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card className="rise" style={{ marginTop: 16, padding: '16px 18px 18px' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink-dim)' }}>סה״כ בחודש</div>
            <Money value={monthly} size={48} currency={currency} style={{ marginTop: 6 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <Pill tone="lavender">{payments.length === 1 ? 'מנוי אחד' : `${payments.length} מנויים`}</Pill>
              <Pill>{fmtMoney(monthly * 12, currency)} בשנה</Pill>
              <Pill onClick={() => setStatsOpen(true)}>
                פירוט
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Pill>
            </div>
          </Card>

          {next && (
            <button onClick={() => onOpenPayment(next.p)} className="rise press" style={{
              animationDelay: '60ms', width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 14,
              padding: 16, borderRadius: 24, border: 'none', cursor: 'pointer', background: 'var(--peach)',
              fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'start',
            }}>
              <ServiceBubble service={resolveService(next.p)} size={52} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)' }}>החיוב הבא</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {resolveService(next.p)?.name || 'תשלום'}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-dim)', marginTop: 1 }}>
                  {fmtRelative(next.due)} · {fmtDateShort(next.due)}
                </div>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(next.p.price, next.p.currency)}</div>
            </button>
          )}

          <Segmented style={{ marginTop: 16 }}
            options={[{ id: 'list', label: 'רשימה' }, { id: 'cal', label: 'לוח שנה' }]}
            value={calendar ? 'cal' : 'list'} onChange={(id) => setCalendar(id === 'cal')} />

          {calendar ? (
            <div style={{ margin: '0 -18px' }}>
              <CalendarScreen payments={payments} onOpenPayment={onOpenPayment} onOpenAdd={onOpenAdd} />
            </div>
          ) : (
            groups.map((g, gi) => (
              <section key={g.title} className="rise" style={{ animationDelay: `${120 + gi * 50}ms` }}>
                <div style={{ padding: '20px 4px 8px', fontSize: 13.5, fontWeight: 800, color: 'var(--ink-dim)' }}>{g.title}</div>
                <Card style={{ padding: '2px 14px' }}>
                  {g.rows.map(({ p }, i) => {
                    const s = resolveService(p);
                    return (
                      <button key={p.id} onClick={() => { haptic('tap'); onOpenPayment(p); }} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                        border: 'none', borderTop: i ? '1px solid var(--divider)' : 'none', background: 'transparent',
                        cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'start',
                        opacity: g.paid ? 0.62 : 1,
                      }}>
                        <ServiceBubble service={s} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s?.name || 'תשלום'}</div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-dim)', marginTop: 2 }}>
                            {g.paid ? `שולם ${fmtRelative(statusDateISO(p))}` : fmtRelative(statusDateISO(p))} · {CYCLE_LABEL[p.cycle]}
                          </div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {fmtMoney(p.price, p.currency)}
                        </div>
                      </button>
                    );
                  })}
                </Card>
              </section>
            ))
          )}
        </>
      )}

      <StatsDetailSheet open={statsOpen} onClose={() => setStatsOpen(false)} payments={payments} currency={currency} rates={fx?.rates} />
    </div>
  );
}

export { SubscriptionsScreen };
