// Stacked payment list — ONE rounded container holding all payment rows,
// like a single "package" with continuous left/right edges (per user reference).
// Rows are flush, separated only by a subtle horizontal divider.
// Tap a row → it expands inline; tap again or wait 3s → collapses.

const AUTO_COLLAPSE_MS = 3000;

function StackedPaymentList({ payments, onOpenDetail }) {
  const [expandedId, setExpandedId] = useState(null);
  const timerRef = useRef(null);

  // Auto-collapse after 3s; resets on any interaction (state change re-fires effect).
  useEffect(() => {
    if (!expandedId) return;
    timerRef.current = setTimeout(() => setExpandedId(null), AUTO_COLLAPSE_MS);
    return () => clearTimeout(timerRef.current);
  }, [expandedId]);

  const handleOpenDetail = (p) => {
    setExpandedId(null);
    setTimeout(() => onOpenDetail(p), 80);
  };

  return (
    <div className="hide-scroll" style={{
      flex: 1, minHeight: 0,
      overflowY: 'auto', overflowX: 'hidden',
      padding: '4px 18px 140px',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* The single container — continuous rounded shell around all rows */}
      <div className="glass-accent" style={{
        borderRadius: 24,
        padding: 0,
        color: 'var(--accent-fg)',
        boxShadow: '0 14px 36px -18px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.22)',
        overflow: 'hidden',
      }}>
        {payments.map((p, i) => (
          <PaymentRow
            key={p.id}
            payment={p}
            index={i}
            total={payments.length}
            isExpanded={expandedId === p.id}
            onTap={() => setExpandedId(prev => prev === p.id ? null : p.id)}
            onOpenDetail={() => handleOpenDetail(p)}
          />
        ))}
      </div>
    </div>
  );
}

function PaymentRow({ payment, index, total, isExpanded, onTap, onOpenDetail }) {
  const service = resolveService(payment);
  const paid = isAutoPaid(payment);
  const isLast = index === total - 1;

  // Darker overlay graduates more aggressively from top → bottom so upper rows
  // feel "underneath" and lower ones rise on top.
  const darkOverlay = Math.max(0, 18 - index * 3);
  // Soft drop-shadow above each row (except first) + bright top edge highlight
  // → each row looks like a physical card lifted on top of the previous one.
  const liftShadow = index > 0
    ? '0 -6px 14px -2px rgba(0,0,0,.28), inset 0 1.5px 0 rgba(255,255,255,.32)'
    : 'inset 0 1px 0 rgba(255,255,255,.2)';

  return (
    <div
      onClick={onTap}
      style={{
        position: 'relative',
        cursor: 'pointer',
        background: isExpanded
          ? 'rgba(0,0,0,.16)'
          : `color-mix(in srgb, var(--accent-fg) ${darkOverlay}%, transparent)`,
        boxShadow: liftShadow,
        // Rounded top corners on every row except the first → combined with the
        // shadow above, each row reads as a discrete card lifting.
        borderTopLeftRadius: index > 0 ? 18 : 0,
        borderTopRightRadius: index > 0 ? 18 : 0,
        // Negative top margin so the rounded lip overlaps the previous row,
        // producing the "stacked / rising" silhouette.
        marginTop: index > 0 ? -10 : 0,
        // Later rows go higher so the lift shadow renders above the previous row.
        zIndex: index + 1,
        transition: 'background .25s ease',
        opacity: paid ? 0.6 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* The collapsed row content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', minHeight: 56 }}>
        <ServiceBubble service={service} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
            {service?.name || 'תשלום'}
            {paid && (
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
                background: 'rgba(0,0,0,.18)', color: '#0B0B0B',
              }}>שולם</span>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: .65, marginTop: 2 }}>
            {fmtRelative(payment.nextDate)} · {CYCLE_LABEL[payment.cycle]}
          </div>
        </div>
        <div style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {fmtMoney(payment.price, payment.currency)}
          </div>
        </div>
      </div>

      {/* Expand area — grid-row accordion pattern */}
      <div className="stack-expand-area" data-open={isExpanded ? 'true' : 'false'}>
        <div className="stack-expand-wrap">
          <div className="stack-expand-inner" style={{
            padding: '4px 18px 16px',
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? 'translateY(0)' : 'translateY(8px)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <Stat label="תאריך" value={fmtDateShort(payment.nextDate)} />
              <Stat label="תדירות" value={CYCLE_LABEL[payment.cycle]} />
            </div>
            {payment.note && (
              <div style={{ fontSize: 12, opacity: .7, marginBottom: 12, lineHeight: 1.3 }}>
                {payment.note}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); onOpenDetail(); }} style={{
              width: '100%', padding: '11px 14px', borderRadius: 12, border: 'none',
              background: '#0B0B0B', color: 'var(--accent)', fontFamily: 'inherit',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icon name="edit" size={14} />
              ערוך פרטים
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, opacity: .55, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{value}</div>
    </div>
  );
}

Object.assign(window, { StackedPaymentList, PaymentRow });
