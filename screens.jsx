// Main screens: Home (with 3 variations), Calendar, Settings

// ---------- HOME ----------
// Layout: header + compact stats card pinned at top, stacked card list fills the rest
// and scrolls INTERNALLY (the page itself does NOT scroll).
function HomeScreen({ payments, onOpenPayment, onOpenAdd, settings }) {
  // Upcoming = not auto-paid yet, sorted by date
  const upcoming = useMemo(() => {
    return [...payments]
      .filter(p => !isAutoPaid(p))
      .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));
  }, [payments]);

  // Stats for the yellow card
  const stats = useMemo(() => {
    const paid = paidThisMonth(payments);
    const planned = plannedThisMonth(payments);
    const today = new Date();
    const m = today.getMonth(), y = today.getFullYear();
    const paidCount = payments.filter(p => {
      const d = new Date(p.nextDate);
      return d.getFullYear() === y && d.getMonth() === m && d <= today;
    }).length;
    return { paid, planned, paidCount };
  }, [payments]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0,
      // The home screen owns the viewport; cards scroll WITHIN their own area.
    }}>
      {/* Fixed top: header + stats + section title */}
      <div style={{ padding: '0 18px', flexShrink: 0 }}>
        <Header onOpenAdd={onOpenAdd} userName={settings.userName} />
        <div style={{ marginBottom: 16 }}>
          <StatsCard paid={stats.paid} planned={stats.planned} count={stats.paidCount} />
        </div>
        <SectionHeader title="מועדים קרובים" count={upcoming.length} />
      </div>

      {/* Stacked scroll area — flex:1 grabs remaining space */}
      {upcoming.length > 0 ? (
        <StackedPaymentList payments={upcoming} onOpenDetail={onOpenPayment} />
      ) : (
        <div style={{ padding: '40px 18px', textAlign: 'center', color: 'var(--ink-dim)' }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>אין תשלומים קרובים</div>
          <button onClick={onOpenAdd} style={{
            background: 'var(--accent)', color: 'var(--accent-fg)',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            padding: '10px 18px', borderRadius: 999, fontWeight: 700, fontSize: 14,
          }}>הוסף תשלום ראשון</button>
        </div>
      )}
    </div>
  );
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

// Page header
function Header({ onOpenAdd, userName }) {
  return (
    <div style={{ padding: '18px 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F2FF44, #B8C700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, color: '#000', fontSize: 15,
        }}>{(userName || 'נ')[0]}</div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 500 }}>שלום,</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{userName || 'נועה'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <IconButton name="bell" size={42} iconSize={20} />
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
      const d = new Date(p.nextDate);
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
function SettingsScreen({ settings, setSettings, accent, setAccent }) {
  const update = (patch) => setSettings({ ...settings, ...patch });
  const notifTimings = [
    { id: 'week',  label: 'שבוע לפני' },
    { id: 'three', label: '3 ימים לפני' },
    { id: 'day',   label: 'יום לפני' },
    { id: 'same',  label: 'ביום עצמו' },
  ];

  return (
    <div style={{ padding: '18px 18px 120px' }}>
      <h1 style={{ margin: '8px 0 24px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>הגדרות</h1>

      {/* Profile */}
      <div style={{ background: 'var(--surface-1)', borderRadius: 20, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F2FF44, #B8C700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, color: '#000', fontSize: 22,
        }}>{(settings.userName || 'נ')[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={settings.userName} onChange={e => update({ userName: e.target.value })} style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', fontFamily: 'inherit', padding: 0,
          }} />
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 2 }}>החשבון שלי</div>
        </div>
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
        <Row icon="download" label="ייצוא לקובץ CSV" sub="כל התשלומים והיסטוריה" onClick={() => alert('ייצוא CSV')} right={<Icon name="chevron-left" size={18} />} />
        <Row icon="download" label="ייצוא לקובץ PDF" sub="דוח מסודר להדפסה" onClick={() => alert('ייצוא PDF')} right={<Icon name="chevron-left" size={18} />} />
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
