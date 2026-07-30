// Main screens: Home, Calendar, Settings

// ---------- Swipeable stats carousel (One UI-style widget pager) ----------
function StatsCarousel({ pages }) {
  const railRef = React.useRef(null);
  const [page, setPage] = React.useState(0);

  // Snap-scroll observer → derive the active page from scroll position
  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = rail.clientWidth;
        const idx = Math.round(rail.scrollLeft / w);
        // RTL: scrollLeft can be negative or inverted. Normalize.
        const childCount = pages.length;
        const computed = childCount > 1 ? Math.min(childCount - 1, Math.max(0, Math.abs(idx))) : 0;
        setPage(computed);
      });
    };
    rail.addEventListener('scroll', onScroll, { passive: true });
    return () => { rail.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [pages.length]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div ref={railRef} className="hide-scroll" style={{
        display: 'flex', overflowX: 'auto', overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        gap: 0,
      }}>
        {pages.map((p, i) => (
          <div key={i} style={{
            flex: '0 0 100%', scrollSnapAlign: 'center',
            scrollSnapStop: 'always',
            paddingInline: 1,
          }}>{p}</div>
        ))}
      </div>
      {/* Pagination dots — hidden when there's only one page */}
      {pages.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          marginTop: 10,
        }}>
          {pages.map((_, i) => (
            <span key={i} style={{
              width: page === i ? 18 : 6, height: 6, borderRadius: 999,
              background: page === i ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'width .25s cubic-bezier(.22,.61,.36,1), background .2s ease',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Stats detail sheet (totals breakdown) ----------
function StatsDetailSheet({ open, onClose, payments, currency = '₪', rates }) {
  const stats = React.useMemo(() => {
    const monthly = totalsByMonthlyEquivalent(payments, rates, currency);
    const perCycle = totalsPerCycle(payments, rates, currency);
    const counts = countsPerCycle(payments);
    const yearly = monthly * 12;

    const byMonthlyEq = payments.map(p => ({ p, eq: monthlyEquivalent(p, rates, currency) }))
      .sort((a, b) => b.eq - a.eq);
    const top = byMonthlyEq[0];
    const cheapest = byMonthlyEq[byMonthlyEq.length - 1];
    const avg = payments.length ? monthly / payments.length : 0;

    const catTotals = {};
    payments.forEach(p => {
      const s = resolveService(p);
      const cat = s?.cat || 'other';
      catTotals[cat] = (catTotals[cat] || 0) + monthlyEquivalent(p, rates, currency);
    });
    const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { monthly, yearly, perCycle, counts, top: top?.p, topEq: top?.eq, cheapest: cheapest?.p, cheapestEq: cheapest?.eq, avg, topCats };
  }, [payments, rates, currency]);

  if (!payments.length) {
    return (
      <Sheet open={open} onClose={onClose} title="ניתוח הוצאות" height="80%">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-dim)', fontSize: 14 }}>
          אין עדיין תשלומים לניתוח
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="ניתוח הוצאות" height="88%">
      <div style={{ padding: '0 22px 32px' }}>
        {/* Big numbers */}
        <div style={{
          background: 'var(--surface-2)', borderRadius: 22, padding: 20, marginBottom: 14,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
        }}>
          <BigStat label="חודשי" value={fmtMoney(stats.monthly, currency)} />
          <BigStat label="שנתי (צפי)" value={fmtMoney(stats.yearly, currency)} />
          <BigStat label="ממוצע לתשלום" value={fmtMoney(stats.avg, currency)} />
          <BigStat label="סה״כ פעילים" value={String(payments.length)} />
        </div>

        {/* Per-cycle breakdown */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 22, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 14, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            פירוט לפי תדירות
          </div>
          {CYCLE_ORDER.map(c => {
            const sumRaw = stats.perCycle[c] || 0;
            const cnt = stats.counts[c] || 0;
            if (!cnt) return null;
            const equiv = sumRaw * (CYCLE_PER_MONTH[c] || 1);
            const pct = stats.monthly > 0 ? Math.round(equiv / stats.monthly * 100) : 0;
            return (
              <div key={c} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{CYCLE_LABEL[c]}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600 }}>{cnt} תשלומים · {pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width .4s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(sumRaw, currency)} {c === 'yearly' ? 'בשנה' : c === 'monthly' ? 'בחודש' : c === 'weekly' ? 'בשבוע' : 'ביום'} · {fmtMoney(equiv, currency)} שווה-ערך חודשי
                </div>
              </div>
            );
          })}
        </div>

        {/* Highlights */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 22, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 14, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            דגשים
          </div>
          {stats.top && <HighlightRow icon="arrow-up-right" label="ההוצאה הגבוהה ביותר"
            value={`${resolveService(stats.top)?.name || 'תשלום'} · ${fmtMoney(stats.topEq, currency)}/ח'`} />}
          {stats.cheapest && stats.cheapest !== stats.top && (
            <HighlightRow icon="check" label="ההוצאה הקטנה ביותר"
              value={`${resolveService(stats.cheapest)?.name || 'תשלום'} · ${fmtMoney(stats.cheapestEq, currency)}/ח'`} />
          )}
        </div>

        {/* Top categories */}
        {stats.topCats.length > 0 && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 22, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 14, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              לפי קטגוריה
            </div>
            {stats.topCats.map(([catId, sum]) => {
              const cat = CATEGORIES.find(x => x.id === catId);
              const pct = stats.monthly > 0 ? Math.round(sum / stats.monthly * 100) : 0;
              return (
                <div key={catId} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{cat?.name || catId}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoney(sum, currency)} · {pct}%
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function BigStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-dim)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}
function HighlightRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: 'var(--surface-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-dim)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  );
}


// ---------- HOME ----------
// Layout: header + compact stats card pinned at top, stacked card list fills the rest
// and scrolls INTERNALLY (the page itself does NOT scroll).
function HomeScreen({ user, payments, paymentsLoading, onOpenPayment, onOpenAdd, settings, setSettings }) {
  const [statsDetailOpen, setStatsDetailOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetSettingsOpen, setBudgetSettingsOpen] = useState(false);
  // Collapse state for each home section — persisted per device so the choice
  // survives reloads. Tap a section title to fold/unfold it.
  const [paymentsCollapsed, setPaymentsCollapsed] = usePersistentFlag('home.paymentsCollapsed', false);
  const fx = useExchangeRates();
  const currency = settings.defaultCurrency || '₪';
  const lists = useLists(user?.uid, user);

  // Budget for the *current* month — the widget card and its detail sheet always
  // report "now", independent of the month being browsed in the expenses list.
  const subsMonthly = useSubsMonthly(payments, currency);
  const budgetCategories = (lists.activeList?.groups && lists.activeList.groups.length)
    ? lists.activeList.groups : DEFAULT_CATEGORIES;
  const now = new Date();
  const budgetArgs = {
    items: lists.items,
    income: Number(settings.monthlyIncome) || 0,
    cap: Number(settings.monthlyCap) || 0,
    subsMonthly, includeSubs: settings.includeSubsInBudget !== false,
    categories: budgetCategories, categoryCaps: settings.categoryCaps || {},
  };
  const budgetStats = useMemo(
    () => computeBudgetStats({ ...budgetArgs, y: now.getFullYear(), m: now.getMonth() }),
    [lists.items, settings, subsMonthly, budgetCategories.join('|')]
  );
  const prevBudgetStats = useMemo(() => {
    const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return computeBudgetStats({ ...budgetArgs, y: p.getFullYear(), m: p.getMonth() });
  }, [lists.items, settings, subsMonthly, budgetCategories.join('|')]);
  // Show EVERY payment — nothing is hidden as the month progresses. Payments
  // whose date already passed this cycle (auto-paid) sink to the bottom and are
  // rendered dimmed, while still-upcoming ones stay on top, sorted by date.
  const upcoming = useMemo(() => {
    return [...payments].sort((a, b) => {
      const pa = isAutoPaid(a), pb = isAutoPaid(b);
      if (pa !== pb) return pa ? 1 : -1; // upcoming first, paid last
      return parseISODate(a.nextDate) - parseISODate(b.nextDate);
    });
  }, [payments]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0,
    }}>
      <div style={{ padding: '0 18px', flexShrink: 0 }}>
        <Header onOpenAdd={onOpenAdd} user={user} fallbackName={settings.userName} />
      </div>

      {/* Single scroll surface holding the stats card + both sections. */}
      <div className="hide-scroll" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: '0 18px 140px', WebkitOverflowScrolling: 'touch',
      }}>
        <StatsCarousel pages={[
          <TotalsCard key="totals" payments={payments} currency={currency} rates={fx?.rates}
            onClick={() => setStatsDetailOpen(true)} />,
          <BudgetHeroCard key="budget" stats={budgetStats}
            onOpenDetail={() => setBudgetOpen(true)}
            onOpenSettings={() => setBudgetSettingsOpen(true)} />,
        ]} />

        {/* ---- Payments ---- (tap the title to collapse the whole list) */}
        <SectionHeader title="תשלומים" count={paymentsLoading ? null : upcoming.length}
          collapsible collapsed={paymentsCollapsed}
          onToggle={() => setPaymentsCollapsed(v => !v)} />
        {!paymentsCollapsed && (
          paymentsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Spinner size={28} color="var(--accent)" />
            </div>
          ) : upcoming.length > 0 ? (
            <StackedPaymentList payments={upcoming} onOpenDetail={onOpenPayment} embedded />
          ) : (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-dim)' }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>אין תשלומים קרובים</div>
              <button onClick={onOpenAdd} style={{
                background: 'var(--accent)', color: 'var(--accent-fg)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '10px 18px', borderRadius: 999, fontWeight: 700, fontSize: 14,
              }}>הוסף תשלום ראשון</button>
            </div>
          )
        )}

        {/* ---- Monthly expenses tracker (budget-aware, shareable) ---- */}
        <div style={{ height: 10 }} />
        <ExpenseListSection lists={lists} settings={settings} setSettings={setSettings}
          subsMonthly={subsMonthly} onOpenBudget={() => setBudgetOpen(true)} />
      </div>

      <StatsDetailSheet open={statsDetailOpen} onClose={() => setStatsDetailOpen(false)}
        payments={payments} currency={currency} rates={fx?.rates} />
      <BudgetDetailSheet open={budgetOpen} onClose={() => setBudgetOpen(false)}
        stats={budgetStats} prevStats={prevBudgetStats}
        monthLabel={`${MONTH_NAMES_HE[now.getMonth()]} ${now.getFullYear()}`}
        onOpenSettings={() => { setBudgetOpen(false); setTimeout(() => setBudgetSettingsOpen(true), 220); }} />
      <BudgetSettingsSheet open={budgetSettingsOpen} onClose={() => setBudgetSettingsOpen(false)}
        settings={settings} setSettings={setSettings}
        categories={budgetCategories} subsMonthly={subsMonthly} />
    </div>
  );
}

// Small persisted boolean flag backed by localStorage (per device).
function usePersistentFlag(key, initial) {
  const [val, setVal] = useState(() => {
    try { const v = localStorage.getItem(key); return v == null ? initial : v === '1'; }
    catch { return initial; }
  });
  const set = React.useCallback((next) => {
    setVal(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem(key, resolved ? '1' : '0'); } catch {}
      return resolved;
    });
  }, [key]);
  return [val, set];
}

// Variation A: Stacked sections
function StackedSections({ byCycle, onOpenPayment }) {
  return (
    <div>
      {CYCLE_ORDER.map(cycle => {
        const list = byCycle[cycle];
        if (!list.length) return null;
        const total = list.reduce((s, p) => s + p.price, 0);
        return (
          <div key={cycle} style={{ marginBottom: 24 }}>
            <SectionHeader title={CYCLE_LABEL[cycle]} count={list.length} total={total} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(p => (
                <ListCard key={p.id} payment={p} onClick={() => onOpenPayment(p)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Variation B: Tabbed (segmented control) single list
function TabbedList({ rest, onOpenPayment }) {
  const [tab, setTab] = useState('all');
  const filtered = tab === 'all' ? rest : rest.filter(p => p.cycle === tab);
  const total = filtered.reduce((s, p) => s + p.price, 0);

  return (
    <div>
      <div style={{
        display: 'flex', background: 'var(--surface-2)', borderRadius: 14, padding: 4, marginBottom: 16,
        position: 'relative',
      }}>
        {[{id: 'all', label: 'הכל'}, ...CYCLE_ORDER.map(c => ({id: c, label: CYCLE_LABEL[c]}))].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'var(--surface-1)' : 'transparent',
            color: tab === t.id ? 'var(--ink)' : 'var(--ink-dim)',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            transition: 'all .15s ease',
            boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,.3)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      <SectionHeader title="תשלומים פעילים" count={filtered.length} total={total} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-dim)', background: 'var(--surface-1)', borderRadius: 18, fontSize: 14 }}>
            אין תשלומים בתדירות זו
          </div>
        ) : filtered.map(p => (
          <ListCard key={p.id} payment={p} onClick={() => onOpenPayment(p)} />
        ))}
      </div>
    </div>
  );
}

// Variation C: Accordion sections
function AccordionSections({ byCycle, onOpenPayment }) {
  const [open, setOpen] = useState({ monthly: true, weekly: false, daily: false });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {CYCLE_ORDER.map(cycle => {
        const list = byCycle[cycle];
        if (!list.length) return null;
        const total = list.reduce((s, p) => s + p.price, 0);
        const isOpen = open[cycle];
        return (
          <div key={cycle} style={{ background: 'var(--surface-1)', borderRadius: 20, overflow: 'hidden' }}>
            <button onClick={() => setOpen({ ...open, [cycle]: !isOpen })} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--ink)', fontFamily: 'inherit', textAlign: 'start',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{CYCLE_LABEL[cycle]}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600 }}>{list.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(total)}</span>
                <span style={{ transition: 'transform .2s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', display: 'inline-flex', color: 'var(--ink-dim)' }}>
                  <Icon name="chevron-down" size={18} />
                </span>
              </div>
            </button>
            {isOpen && (
              <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {list.map(p => (
                  <ListCard key={p.id} payment={p} onClick={() => onOpenPayment(p)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Page header — uses Google profile photo when available
function Header({ onOpenAdd, user, fallbackName }) {
  const displayName = user?.displayName || fallbackName || 'משתמש';
  const photoURL = user?.photoURL;
  const initial = (displayName || 'מ')[0];
  return (
    <div style={{ padding: '18px 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {photoURL ? (
          <img src={photoURL} alt={displayName} referrerPolicy="no-referrer" style={{
            width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
            border: '1.5px solid var(--accent)',
          }} />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#000', fontSize: 15,
          }}>{initial}</div>
        )}
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 500 }}>שלום,</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {displayName.split(' ')[0]}
          </div>
        </div>
      </div>
      <button onClick={onOpenAdd} aria-label="הוסף תשלום" style={{
        background: 'var(--accent)', color: 'var(--accent-fg)',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        width: 42, height: 42, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 18px -6px rgba(242,255,68,.5)',
      }}>
        <Icon name="plus" size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ---------- CALENDAR ----------
function CalendarScreen({ payments, onOpenPayment, onOpenAdd }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const monthLabel = useMemo(() => {
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    return `${months[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [cursor]);

  const monthGrid = useMemo(() => {
    const first = new Date(cursor); first.setDate(1);
    const startDay = first.getDay(); // Sun=0
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const paymentsByDay = useMemo(() => {
    const map = {};
    payments.forEach(p => {
      const d = parseISODate(p.nextDate);
      if (d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(p);
      }
    });
    return map;
  }, [payments, cursor]);

  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const selectedPayments = paymentsByDay[selectedDay] || [];

  const monthTotal = useMemo(() => {
    return Object.values(paymentsByDay).flat().reduce((s, p) => s + p.price, 0);
  }, [paymentsByDay]);

  const today = new Date();
  const isCurrentMonth = today.getMonth() === cursor.getMonth() && today.getFullYear() === cursor.getFullYear();

  const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  return (
    <div style={{ padding: '18px 18px 120px' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{monthLabel}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconButton name="chevron-right" size={38} iconSize={18} onClick={() => {
            const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d);
          }} />
          <IconButton name="chevron-left" size={38} iconSize={18} onClick={() => {
            const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d);
          }} />
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 500, marginBottom: 18 }}>
        סך החודש: <span style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(monthTotal)}</span>
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {dayNames.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink-dim)', padding: '6px 0' }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 22 }}>
        {monthGrid.map((d, i) => {
          if (!d) return <div key={i} />;
          const list = paymentsByDay[d] || [];
          const isToday = isCurrentMonth && d === today.getDate();
          const isSelected = d === selectedDay;
          const dayTotal = list.reduce((s, p) => s + p.price, 0);
          return (
            <button key={i} onClick={() => setSelectedDay(d)} style={{
              aspectRatio: '1 / 1.15',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: 12, padding: '6px 4px',
              background: isSelected ? 'var(--accent)' : (list.length ? 'var(--surface-1)' : 'transparent'),
              color: isSelected ? 'var(--accent-fg)' : 'var(--ink)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
              position: 'relative',
              outline: isToday && !isSelected ? '1.5px solid var(--accent)' : 'none',
              outlineOffset: -1.5,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d}</div>
              {list.length > 0 ? (
                <div style={{ fontSize: 9, fontWeight: 700, opacity: isSelected ? .75 : .65, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  ₪{Math.round(dayTotal)}
                </div>
              ) : <div style={{ height: 9 }} />}
              {list.length > 0 && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {list.slice(0, 3).map((p, idx) => {
                    const s = resolveService(p);
                    return <span key={idx} style={{
                      width: 5, height: 5, borderRadius: 999,
                      background: isSelected ? '#000' : (s?.bg || 'var(--ink)'),
                    }} />;
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day payments */}
      <SectionHeader title={`${selectedDay} ${monthLabel.split(' ')[0]}`} count={selectedPayments.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selectedPayments.length === 0 ? (
          <div style={{
            background: 'var(--surface-1)', borderRadius: 18,
            padding: 24, textAlign: 'center', color: 'var(--ink-dim)', fontSize: 14,
          }}>
            אין תשלומים בתאריך זה
          </div>
        ) : selectedPayments.map(p => (
          <ListCard key={p.id} payment={p} onClick={() => onOpenPayment(p)} />
        ))}
      </div>
    </div>
  );
}

// ---------- SETTINGS ----------
function SettingsScreen({ user, settings, setSettings, accent, setAccent, onSignOut }) {
  const update = (patch) => setSettings({ ...settings, ...patch });
  const toast = useToast();
  const [notifPerm, setNotifPerm] = useState(() => notifPermission());
  const [testBusy, setTestBusy] = useState(false);

  const notifTimings = [
    { id: 'week',  label: 'שבוע לפני' },
    { id: 'three', label: '3 ימים לפני' },
    { id: 'day',   label: 'יום לפני' },
    { id: 'same',  label: 'ביום עצמו' },
  ];

  const sendTestNotification = async () => {
    setTestBusy(true);
    const perm = await ensureNotifPermission();
    setNotifPerm(perm);
    if (perm === 'unsupported') {
      toast('הדפדפן לא תומך בהתראות', { type: 'error' });
      setTestBusy(false); return;
    }
    if (perm !== 'granted') {
      toast('יש לאשר הרשאת התראות בדפדפן', { type: 'error' });
      setTestBusy(false); return;
    }
    // Register FCM token so the server can push (idempotent)
    const token = await registerFcmToken(user?.uid);
    const ok = await showLocalNotification(
      'בדיקת התראות',
      token ? 'מצוין! התראות פעילות גם כשהאפליקציה סגורה.'
            : 'מצוין! ההתראות עובדות בתוך האפליקציה.',
      { tag: 'test-' + Date.now() }
    );
    toast(ok ? 'נשלחה התראת בדיקה' : 'שליחה נכשלה', { type: ok ? 'success' : 'error' });
    setTestBusy(false);
  };

  const isAnon = user?.isAnonymous;
  const displayName = user?.displayName || settings.userName || 'משתמש אנונימי';
  const email = user?.email;
  const photoURL = user?.photoURL;

  return (
    <div style={{ padding: '18px 18px 120px' }}>
      <h1 style={{ margin: '8px 0 24px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>הגדרות</h1>

      {/* Profile — Google data when signed in with Google, otherwise editable name */}
      <div style={{ background: 'var(--surface-1)', borderRadius: 20, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        {photoURL ? (
          <img src={photoURL} alt={displayName} referrerPolicy="no-referrer" style={{
            width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
            border: '2px solid var(--accent)', flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#000', fontSize: 22, flexShrink: 0,
          }}>{(displayName || 'מ')[0]}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {user?.displayName ? (
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
          ) : (
            <input value={settings.userName} onChange={e => update({ userName: e.target.value })}
              placeholder="השם שלך" style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', fontFamily: 'inherit', padding: 0,
            }} />
          )}
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isAnon ? 'מחובר ללא חשבון' : (email || 'החשבון שלי')}
          </div>
        </div>
        <IconButton name="close" size={36} iconSize={16} onClick={onSignOut} ariaLabel="התנתק" />
      </div>

      {/* Notifications group */}
      <SettingsGroup title="התראות">
        <Row icon="bell" label="קבלת התראות" sub="התראות פוש על תשלומים קרובים"
          right={<Toggle checked={settings.notif} onChange={v => update({ notif: v })} />} />

        <div style={{ padding: '4px 18px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', marginBottom: 10 }}>מתי להתריע</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {notifTimings.map(t => (
              <Chip key={t.id} active={settings.notifTimings.includes(t.id)} onClick={() => {
                const has = settings.notifTimings.includes(t.id);
                update({ notifTimings: has ? settings.notifTimings.filter(x => x !== t.id) : [...settings.notifTimings, t.id] });
              }}>{t.label}</Chip>
            ))}
          </div>
        </div>

        <div style={{ padding: '4px 18px 14px', borderTop: '1px solid var(--divider)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', marginBottom: 10 }}>שעה ביום</div>
          <input type="time" value={settings.notifTime} onChange={e => update({ notifTime: e.target.value })} style={{
            background: 'var(--surface-2)', border: 'none', outline: 'none',
            color: 'var(--ink)', fontSize: 17, fontWeight: 700, fontFamily: 'inherit',
            padding: '10px 14px', borderRadius: 12, fontVariantNumeric: 'tabular-nums',
          }} />
        </div>

        <Row icon="card" label="סיכום חודשי" sub="קבל סיכום בתחילת כל חודש"
          right={<Toggle checked={settings.monthlySummary} onChange={v => update({ monthlySummary: v })} />} />

        {/* Permission state + test notification */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>הרשאת התראות</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 2 }}>
                {notifPerm === 'granted' ? 'מאושרת ✓' :
                 notifPerm === 'denied'  ? 'נדחתה — שנה בהגדרות הדפדפן' :
                 notifPerm === 'unsupported' ? 'לא נתמך בדפדפן זה' :
                 'נדרשת הרשאה'}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: notifPerm === 'granted' ? 'rgba(34,197,94,.18)' :
                          notifPerm === 'denied' ? 'rgba(255,92,92,.18)' : 'var(--surface-2)',
              color: notifPerm === 'granted' ? '#22C55E' :
                     notifPerm === 'denied' ? '#FF5C5C' : 'var(--ink-dim)',
            }}>
              {notifPerm === 'granted' ? 'פעיל' : notifPerm === 'denied' ? 'חסום' : 'ממתין'}
            </span>
          </div>
          <button onClick={sendTestNotification} disabled={testBusy} style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', cursor: testBusy ? 'wait' : 'pointer',
            background: 'var(--accent)', color: 'var(--accent-fg)',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: testBusy ? .7 : 1,
          }}>
            {testBusy ? <Spinner size={14} color="var(--accent-fg)" /> : <Icon name="bell" size={15} strokeWidth={2.4} />}
            שלח התראת בדיקה
          </button>
        </div>
      </SettingsGroup>

      {/* Appearance group */}
      <SettingsGroup title="עיצוב ושפה">
        <Row icon={settings.theme === 'dark' ? 'moon' : 'sun'} label="ערכת נושא"
          right={
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active={settings.theme === 'dark'} onClick={() => update({ theme: 'dark' })}>כהה</Chip>
              <Chip active={settings.theme === 'light'} onClick={() => update({ theme: 'light' })}>בהיר</Chip>
            </div>
          } />

        {/* Accent color picker — swatch grid */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink)',
              }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>צבע הדגשה</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>{ACCENT_PALETTE.find(p => p.color === accent)?.label || 'מותאם'}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
            {ACCENT_PALETTE.map(p => {
              const isActive = accent === p.color;
              return (
                <button key={p.id} onClick={() => setAccent(p.color)} aria-label={p.label} style={{
                  aspectRatio: '1 / 1', width: '100%',
                  borderRadius: '50%', cursor: 'pointer',
                  background: p.color, border: 'none',
                  outline: isActive ? '2.5px solid var(--ink)' : '2.5px solid transparent',
                  outlineOffset: 2,
                  transform: isActive ? 'scale(1)' : 'scale(.92)',
                  transition: 'transform .18s ease, outline-color .18s ease',
                }} />
              );
            })}
          </div>
          {/* Free custom color */}
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 14, padding: '10px 14px', borderRadius: 12, background: 'var(--surface-2)',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>צבע חופשי</span>
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>{accent.toUpperCase()}</span>
              <span style={{
                width: 28, height: 28, borderRadius: '50%', background: accent,
                outline: '2px solid var(--divider)',
              }} />
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)} style={{
                position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
              }} />
            </span>
          </label>
        </div>

        <Row icon="globe" label="שפה"
          right={
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active={settings.language === 'he'} onClick={() => update({ language: 'he' })}>עברית</Chip>
              <Chip active={settings.language === 'en'} onClick={() => update({ language: 'en' })}>EN</Chip>
            </div>
          } />
        <Row icon="shekel" label="מטבע ברירת מחדל"
          right={
            <div style={{ display: 'flex', gap: 4 }}>
              {CURRENCIES.map(c => (
                <Chip key={c} active={settings.defaultCurrency === c} onClick={() => update({ defaultCurrency: c })}>{c}</Chip>
              ))}
            </div>
          } />
      </SettingsGroup>

      {/* Data group */}
      <SettingsGroup title="נתונים">
        <Row icon="download" label="ייצוא לקובץ CSV" sub="כל התשלומים והיסטוריה"
          onClick={() => toast('ייצוא CSV יתווסף בהמשך', { type: 'info' })}
          right={<Icon name="chevron-left" size={18} />} />
        <Row icon="download" label="ייצוא לקובץ PDF" sub="דוח מסודר להדפסה"
          onClick={() => toast('ייצוא PDF יתווסף בהמשך', { type: 'info' })}
          right={<Icon name="chevron-left" size={18} />} />
      </SettingsGroup>

      {/* Account group */}
      <SettingsGroup title="חשבון">
        <Row icon="arrow-right" label="התנתקות" sub={email || 'יציאה מהחשבון'} danger onClick={onSignOut} />
      </SettingsGroup>

      <div style={{ textAlign: 'center', color: 'var(--ink-dim)', fontSize: 12, marginTop: 28 }}>
        תשלומים · גרסה 1.0
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-dim)', letterSpacing: '0.08em', padding: '0 6px 8px', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ background: 'var(--surface-1)', borderRadius: 20, overflow: 'hidden' }}>
        {React.Children.map(children, (child, i) => (
          <div style={{ borderBottom: i < React.Children.count(children) - 1 ? '1px solid var(--divider)' : 'none' }}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, CalendarScreen, SettingsScreen });
