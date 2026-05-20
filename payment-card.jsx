// Payment card components — the visual heart of the app.
// StatsCard (the yellow stats card on home) + ListCard (compact row).

function StatsCard({ paid, planned, count, onClick }) {
  const pct = planned > 0 ? Math.min(100, Math.round(paid / planned * 100)) : 0;
  const remaining = Math.max(0, planned - paid);
  const today = new Date();
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  return (
    <div className="hero-card glass-accent" style={{
      width: '100%', textAlign: 'start',
      color: 'var(--accent-fg)',
      borderRadius: 28, padding: 22, fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 18,
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 18px 40px -16px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.25)',
    }}>
      {/* decorative grid */}
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.07, pointerEvents: 'none' }} viewBox="0 0 400 280" preserveAspectRatio="none">
        {Array.from({length: 14}).map((_, i) => (
          <line key={i} x1={i * 30} y1="0" x2={i * 30 - 80} y2="280" stroke="#000" strokeWidth="1" />
        ))}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: .65, marginBottom: 4, letterSpacing: '-0.01em' }}>
            שולם החודש
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, opacity: .85 }}>
            {monthNames[today.getMonth()]} · עד {today.getDate()} בחודש
          </div>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: 999, background: '#000', color: 'var(--accent)',
          fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        }}>
          {count} תשלומים
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative' }}>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {fmtMoney(paid)}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, opacity: .55 }}>
          / {fmtMoney(planned)}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          height: 8, borderRadius: 999, background: 'rgba(0,0,0,.15)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', background: '#000', borderRadius: 999,
            transition: 'width .4s cubic-bezier(.22,.61,.36,1)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, fontWeight: 700 }}>
          <span style={{ opacity: .65 }}>נותר לחודש</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(remaining)}</span>
        </div>
      </div>
    </div>
  );
}

// Compact list row card — used in sections + upcoming list
function ListCard({ payment, onClick, accent }) {
  const service = resolveService(payment);
  const paid = isAutoPaid(payment);

  const bg = accent ? 'var(--accent)' : 'var(--surface-1)';
  const fg = accent ? 'var(--accent-fg)' : 'var(--ink)';
  const dim = accent ? 'rgba(0,0,0,.55)' : 'var(--ink-dim)';

  return (
    <button onClick={onClick} className="list-card" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: 14, borderRadius: 20, border: 'none', cursor: 'pointer',
      background: bg, color: fg, fontFamily: 'inherit', textAlign: 'start',
      opacity: paid ? .55 : 1,
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
          {fmtRelative(payment.nextDate)} · {CYCLE_LABEL[payment.cycle]}
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

// Section header
function SectionHeader({ title, count, total, action, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '8px 4px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {title}
        </h3>
        {count != null && (
          <span style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600 }}>
            {count}
          </span>
        )}
      </div>
      {total != null ? (
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

Object.assign(window, { StatsCard, ListCard, SectionHeader });
