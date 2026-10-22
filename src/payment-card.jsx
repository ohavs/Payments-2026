// Payment card components — the visual heart of the app.
// StatsCard (the yellow stats card on home) + ListCard (compact row).
import { useMemo } from 'react';
import { Icon, ServiceBubble } from './components.jsx';
import { CYCLE_LABEL, CYCLE_ORDER, countsPerCycle, fmtMoney, fmtRelative, isAutoPaid, isPaused, resolveService, statusDateISO, statusLabel, totalsByMonthlyEquivalent } from './data.jsx';

function ListCard({ payment, onClick, accent }) {
  const service = resolveService(payment);
  const paid = isAutoPaid(payment);
  const paused = isPaused(payment);

  const bg = accent ? 'var(--accent)' : 'var(--surface-1)';
  const fg = accent ? 'var(--accent-fg)' : 'var(--ink)';
  const dim = accent ? 'rgba(0,0,0,.55)' : 'var(--ink-dim)';

  return (
    <button onClick={onClick} className="list-card" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: 14, borderRadius: 20, border: 'none', cursor: 'pointer',
      background: bg, color: fg, fontFamily: 'inherit', textAlign: 'start',
      opacity: paid || paused ? .55 : 1,
      transition: 'transform .12s ease',
    }}>
      <ServiceBubble service={service} size={44} dark={!accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
          {service?.name || 'תשלום'}
          {paid && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              background: 'rgba(34,197,94,.18)', color: '#22C55E',
            }}>שולם</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: dim, marginTop: 2, fontWeight: 500 }}>
          {paused ? statusLabel(payment) : fmtRelative(statusDateISO(payment))} · {CYCLE_LABEL[payment.cycle]}
        </div>
      </div>
      <div style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {fmtMoney(payment.price, payment.currency)}
        </div>
      </div>
    </button>
  );
}

// Section header. Optionally collapsible (tap the title to fold the section)
// and can carry an "add" button glued right next to the title word.
function SectionHeader({ title, count, total, action, onAction, collapsible, collapsed, onToggle, onAdd, addLabel, rightNode }) {
  const titleInner = (
    <>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      {collapsible && (
        <span style={{
          display: 'inline-flex', color: 'var(--ink-dim)',
          transition: 'transform .2s ease',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>
          <Icon name="chevron-down" size={18} />
        </span>
      )}
    </>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '8px 4px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {collapsible ? (
          <button onClick={onToggle} aria-expanded={!collapsed} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--ink)', padding: 0, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {titleInner}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{titleInner}</div>
        )}
        {count != null && (
          <span style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600 }}>
            {count}
          </span>
        )}
        {onAdd && (
          <button onClick={onAdd} aria-label={addLabel || 'הוסף'} title={addLabel || 'הוסף'} style={{
            width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: 'var(--accent-fg)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginInlineStart: 2, flexShrink: 0,
            boxShadow: '0 4px 12px -4px rgba(0,0,0,.4)',
          }}>
            <Icon name="plus" size={15} strokeWidth={2.6} />
          </button>
        )}
      </div>
      {rightNode ? rightNode : total != null ? (
        <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          סה״כ {fmtMoney(total)}
        </div>
      ) : action ? (
        <button onClick={onAction} style={{
          background: 'transparent', border: 'none', color: 'var(--ink-dim)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>{action}</button>
      ) : null}
    </div>
  );
}

export { ListCard, SectionHeader };
