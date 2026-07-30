// Monthly budget tool — sits on top of the expenses tracker.
//
// The user sets a monthly income and a spending ceiling (cap). Everything else
// is derived: what's left to spend, an allowed daily rate for the days left,
// whether spending is ahead of or behind pace, an end-of-month projection,
// share of income, expected savings, per-category ceilings and a daily chart.
//
// Reuses helpers from lists.jsx (expenseDate, localISO, MONTH_NAMES_HE,
// FieldInput, Label, PrimaryButton, Section, ghostBtn) and data.jsx (fmtMoney).

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

// Monthly equivalent of all recurring payments, in the user's currency.
function useSubsMonthly(payments, currency) {
  const fx = useExchangeRates();
  return React.useMemo(
    () => totalsByMonthlyEquivalent(payments || [], fx?.rates, currency || '₪'),
    [payments, fx?.rates, currency]
  );
}

// ---------- Progress ring ----------
function ProgressRing({ pct, size = 132, stroke = 12, color, track = 'var(--surface-2)', children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const shown = clamp(pct, 0, 100);
  const dash = circ * (shown / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: 'stroke-dasharray .5s cubic-bezier(.22,.61,.36,1), stroke .3s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 6,
      }}>{children}</div>
    </div>
  );
}

function budgetColor(stats) {
  if (!stats.hasCap) return 'var(--accent)';
  if (stats.overCap) return '#FF5C5C';
  if (!stats.onPace) return '#F5A623';
  return '#22C55E';
}

// ---------- Hero card (page in the home widget pager) ----------
function BudgetHeroCard({ stats, onOpenDetail, onOpenSettings, big }) {
  const color = budgetColor(stats);
  const shell = {
    width: '100%', textAlign: 'start', fontFamily: 'inherit', color: 'var(--ink)',
    background: 'color-mix(in srgb, var(--surface-1) 78%, transparent)',
    backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid var(--glass-border)', borderRadius: 28, padding: big ? 24 : 22,
    boxShadow: '0 18px 40px -16px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08)',
    position: 'relative', overflow: 'hidden',
  };

  // No ceiling yet → a single clear call to action.
  if (!stats.hasCap) {
    return (
      <div style={{ ...shell, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 6 }}>תקציב חודשי</div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, color: 'var(--ink-dim)' }}>
            הגדר הכנסה ותקרת הוצאות כדי לראות כמה נשאר לבזבז, מותר ליום, וקצב מול היעד.
          </div>
        </div>
        <button onClick={onOpenSettings} style={{
          alignSelf: 'flex-start', background: 'var(--accent)', color: 'var(--accent-fg)',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          padding: '11px 18px', borderRadius: 999, fontWeight: 800, fontSize: 14,
        }}>הגדר תקציב</button>
      </div>
    );
  }

  return (
    <button onClick={onOpenDetail} className="hero-card" style={{ ...shell, cursor: 'pointer', border: '1px solid var(--glass-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: big ? 22 : 18 }}>
        <ProgressRing pct={stats.pctUsed} color={color} size={big ? 124 : 132} stroke={big ? 13 : 12}>
          <div style={{ fontSize: big ? 28 : 23, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {Math.round(stats.pctUsed)}%
          </div>
          <div style={{ fontSize: big ? 11.5 : 10.5, fontWeight: 700, color: 'var(--ink-dim)', marginTop: 3 }}>מהתקרה</div>
        </ProgressRing>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: big ? 13.5 : 12.5, fontWeight: 700, color: 'var(--ink-dim)' }}>
            {stats.overCap ? 'חריגה מהתקרה' : 'נשאר לבזבז'}
          </div>
          <div style={{
            fontSize: big ? 31 : 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums', color: stats.overCap ? '#FF5C5C' : 'var(--ink)',
            marginTop: 2,
          }}>
            {fmtMoney(Math.abs(stats.remaining))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            מתוך {fmtMoney(stats.cap)}
          </div>

          {!big && <PaceChips stats={stats} color={color} />}
        </div>
      </div>
      {big && <div style={{ marginTop: 16 }}><PaceChips stats={stats} color={color} big /></div>}
      {big && stats.catRows.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-dim)', letterSpacing: '.05em',
            textTransform: 'uppercase', marginBottom: 12 }}>
            לפי קטגוריה
          </div>
          {stats.catRows.slice(0, 4).map(r => (
            <div key={r.cat} style={{ marginBottom: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cat}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  color: r.overCap ? '#FF5C5C' : 'var(--ink-dim)' }}>
                  {r.cap > 0 ? `${fmtMoney(r.sum)} / ${fmtMoney(r.cap)}` : `${fmtMoney(r.sum)} · ${r.pct}%`}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ width: `${clamp(r.cap > 0 ? r.capPct : r.pct, 0, 100)}%`, height: '100%', borderRadius: 999,
                  background: r.overCap ? '#FF5C5C' : 'var(--accent)',
                  transition: 'width .45s cubic-bezier(.22,.61,.36,1)' }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-dim)', marginTop: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            {stats.catRows.length > 4 ? `ועוד ${stats.catRows.length - 4} · ` : ''}לכל הסטטיסטיקות
            <Icon name="chevron-left" size={13} />
          </div>
        </div>
      )}
    </button>
  );
}

// "allowed per day" + pace chips. Sits beside the ring on the compact card and
// on its own full-width row on the large one.
function PaceChips({ stats, color, big }) {
  const pill = big ? { ...pillStyle, fontSize: 12.5, padding: '7px 13px' } : pillStyle;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: big ? 8 : 6, marginTop: big ? 0 : 12 }}>
      {stats.daysLeft > 0 && (
        <span style={pill}>
          {fmtMoney(stats.dailyAllowance)} ליום · {stats.daysLeft} ימים
        </span>
      )}
      <span style={{ ...pill, background: `color-mix(in srgb, ${color} 20%, transparent)`, color: 'var(--ink)' }}>
        {stats.overCap ? 'מעל התקרה'
          : stats.onPace ? 'בקצב טוב'
          : `מעל הקצב ב-${fmtMoney(Math.abs(stats.paceDelta))}`}
      </span>
    </div>
  );
}

const pillStyle = {
  padding: '5px 10px', borderRadius: 999, background: 'var(--surface-2)',
  fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
};

// ---------- Small building blocks ----------
function StatTile({ label, value, sub, tone }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: '13px 14px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 5 }}>{label}</div>
      <div style={{
        fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
        color: tone === 'bad' ? '#FF5C5C' : tone === 'good' ? '#22C55E' : 'var(--ink)',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 3, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function MeterRow({ label, value, pct, color = 'var(--accent)', right, over }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: over ? '#FF5C5C' : 'var(--ink-dim)',
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{right != null ? right : value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div style={{ width: `${clamp(pct, 0, 100)}%`, height: '100%', background: over ? '#FF5C5C' : color,
          borderRadius: 999, transition: 'width .45s cubic-bezier(.22,.61,.36,1)' }} />
      </div>
    </div>
  );
}

// Daily spend bars for the month.
function DailyBars({ stats }) {
  const { daily, dailyMax, isCurrent, dayOfMonth } = stats;
  if (dailyMax <= 0) {
    return <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', padding: '8px 0' }}>אין הוצאות להצגה בחודש זה</div>;
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 84 }}>
        {daily.map((v, i) => {
          const isToday = isCurrent && (i + 1) === dayOfMonth;
          const h = dailyMax > 0 ? Math.max(v > 0 ? 4 : 1, Math.round(v / dailyMax * 80)) : 1;
          return (
            <div key={i} title={`${i + 1}: ${fmtMoney(v)}`} style={{
              flex: 1, height: h, borderRadius: 3, minWidth: 0,
              background: isToday ? 'var(--accent)' : (v > 0 ? 'color-mix(in srgb, var(--ink) 32%, transparent)' : 'var(--surface-3)'),
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--ink-dim)', fontWeight: 700 }}>
        <span>1</span><span>{Math.round(stats.daysInMonth / 2)}</span><span>{stats.daysInMonth}</span>
      </div>
    </div>
  );
}

// ---------- Detail sheet ----------
function BudgetDetailSheet({ open, onClose, stats, prevStats, monthLabel, onOpenSettings }) {
  if (!stats) return <Sheet open={open} onClose={onClose} title="תקציב"><div /></Sheet>;
  const color = budgetColor(stats);
  const deltaPrev = prevStats ? stats.spent - prevStats.spent : null;

  return (
    <Sheet open={open} onClose={onClose} title={`תקציב · ${monthLabel}`} height="92%">
      <div style={{ padding: '18px 22px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Ring + headline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'var(--surface-2)', borderRadius: 22, padding: 18 }}>
          <ProgressRing pct={stats.hasCap ? stats.pctUsed : 0} color={color} size={116} stroke={11} track="var(--surface-3)">
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {stats.hasCap ? `${Math.round(stats.pctUsed)}%` : '—'}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-dim)', marginTop: 3 }}>מהתקרה</div>
          </ProgressRing>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-dim)' }}>סך ההוצאה</div>
            <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
              {fmtMoney(stats.used)}
            </div>
            {stats.hasCap && (
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4,
                color: stats.overCap ? '#FF5C5C' : 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {stats.overCap ? `חריגה של ${fmtMoney(-stats.remaining)}` : `נשאר ${fmtMoney(stats.remaining)} מתוך ${fmtMoney(stats.cap)}`}
              </div>
            )}
          </div>
        </div>

        {/* Key numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {stats.hasCap && stats.daysLeft > 0 && (
            <StatTile label="מותר לי ליום" value={fmtMoney(stats.dailyAllowance)} sub={`${stats.daysLeft} ימים נותרו`} />
          )}
          <StatTile label="ממוצע ליום עד כה" value={fmtMoney(stats.avgPerDay)} sub={`${stats.count} רשומות`} />
          <StatTile label="תחזית לסוף החודש" value={fmtMoney(stats.projected)}
            tone={stats.hasCap ? (stats.projected > stats.cap ? 'bad' : 'good') : undefined}
            sub={stats.hasCap ? (stats.projected > stats.cap ? `צפוי לחרוג ב-${fmtMoney(stats.projected - stats.cap)}` : 'בתוך התקרה') : null} />
          {stats.hasCap && (
            <StatTile label="קצב מול היעד" value={stats.onPace ? 'בקצב טוב' : 'מעל הקצב'}
              tone={stats.onPace ? 'good' : 'bad'}
              sub={`היה אמור לעמוד על ${fmtMoney(stats.expectedByNow)}`} />
          )}
          {stats.hasIncome && (
            <>
              <StatTile label="הכנסה חודשית" value={fmtMoney(stats.income)} sub={`${Math.round(stats.pctOfIncome)}% נוצלו`} />
              <StatTile label="חיסכון צפוי" value={fmtMoney(stats.savings)}
                tone={stats.savings >= 0 ? 'good' : 'bad'}
                sub={stats.savings >= 0 ? 'הכנסה פחות הוצאות' : 'ההוצאות עברו את ההכנסה'} />
            </>
          )}
        </div>

        {/* Income usage */}
        {stats.hasIncome && (
          <div>
            <SubTitle>ניצול ההכנסה</SubTitle>
            <MeterRow label="הוצאות מתוך ההכנסה" pct={stats.pctOfIncome}
              right={`${fmtMoney(stats.used)} · ${Math.round(stats.pctOfIncome)}%`}
              color={color} over={stats.used > stats.income} />
          </div>
        )}

        {/* Composition: tracked expenses vs recurring commitments */}
        {stats.committed > 0 && (
          <div>
            <SubTitle>הרכב ההוצאה</SubTitle>
            <MeterRow label="הוצאות שרשמתי" pct={stats.used > 0 ? stats.spent / stats.used * 100 : 0}
              right={fmtMoney(stats.spent)} color="var(--accent)" />
            <MeterRow label="מנויים ותשלומים קבועים" pct={stats.used > 0 ? stats.committed / stats.used * 100 : 0}
              right={fmtMoney(stats.committed)} color="color-mix(in srgb, var(--ink) 45%, transparent)" />
          </div>
        )}

        {/* Daily chart */}
        <div>
          <SubTitle>הוצאה יומית</SubTitle>
          <DailyBars stats={stats} />
        </div>

        {/* Categories */}
        {stats.catRows.length > 0 && (
          <div>
            <SubTitle>לפי קטגוריה</SubTitle>
            {stats.catRows.map(r => (
              <MeterRow key={r.cat} label={r.cat}
                pct={r.cap > 0 ? r.capPct : r.pct}
                right={r.cap > 0 ? `${fmtMoney(r.sum)} / ${fmtMoney(r.cap)}` : `${fmtMoney(r.sum)} · ${r.pct}%`}
                over={r.overCap} />
            ))}
          </div>
        )}

        {/* vs previous month */}
        {prevStats && (prevStats.spent > 0 || stats.spent > 0) && (
          <div>
            <SubTitle>מול החודש הקודם</SubTitle>
            <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: '14px 15px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)' }}>
                חודש קודם: <span style={{ color: 'var(--ink)' }}>{fmtMoney(prevStats.spent)}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                color: deltaPrev > 0 ? '#FF5C5C' : '#22C55E' }}>
                {deltaPrev > 0 ? '▲' : '▼'} {fmtMoney(Math.abs(deltaPrev))}
              </div>
            </div>
          </div>
        )}

        {/* Biggest expenses */}
        {stats.top.length > 0 && (
          <div>
            <SubTitle>ההוצאות הגדולות</SubTitle>
            <div style={{ background: 'var(--surface-2)', borderRadius: 16, overflow: 'hidden' }}>
              {stats.top.map((it, i) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--divider)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-dim)', width: 14 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.title || 'הוצאה'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-dim)', fontWeight: 600 }}>{it.group || 'ללא קטגוריה'}</div>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(it.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onOpenSettings} style={{ ...ghostBtn, width: '100%', padding: '13px' }}>
          <Icon name="settings" size={16} /> הגדרות תקציב
        </button>
      </div>
    </Sheet>
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

Object.assign(window, {
  PaceChips, computeBudgetStats, useSubsMonthly, ProgressRing, BudgetHeroCard,
  BudgetDetailSheet, BudgetSettingsSheet, DailyBars, MeterRow, StatTile, budgetColor,
});
