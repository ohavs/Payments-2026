// Settings screen, the subscriptions calendar and the subscriptions breakdown sheet.
import React, { useEffect, useMemo, useState } from 'react';
import { BudgetSettingsSheet, useSubsMonthly } from './budget.jsx';
import { Chip, Icon, IconButton, Row, Sheet, Toggle } from './components.jsx';
import { CATEGORIES, CURRENCIES, CYCLE_LABEL, CYCLE_ORDER, CYCLE_PER_MONTH, countsPerCycle, fmtMoney, monthlyEquivalent, resolveService, totalsByMonthlyEquivalent, totalsPerCycle } from './data.jsx';
import { occurrencesBetween } from './lib/recurrence.js';
import { appVersion, isNative } from './lib/platform.js';
import { Spinner, useToast } from './feedback.jsx';
import { ManageExpensesSheet } from './lists.jsx';
import { ensureNotifPermission, notifPermission, registerFcmToken, showLocalNotification } from './notifications.jsx';
import { ListCard, SectionHeader } from './payment-card.jsx';
import { ensureNativeNotifPermission, nativeNotifPermission, sendNativeTestNotification } from './lib/reminders.js';
import { detectStatus, openDetectAccess, setDetectEnabled } from './lib/detect.js';
import { expensesToCSV, shareCSV } from './lib/export.js';
import { App as CapApp } from '@capacitor/app';
import { Segmented } from './ui/kit.jsx';

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
    // Every charge in the month: weekly payments show up on each week, and
    // past-dated anchors keep recurring instead of vanishing.
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    payments.forEach(p => {
      occurrencesBetween(p, from, to).forEach(d => {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(p);
      });
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
function SettingsScreen({ user, settings, setSettings, lists, categories, payments, onSignOut, onOpenUpdates, onOpenGmail }) {
  const [version, setVersion] = useState(null);
  useEffect(() => { appVersion().then(setVersion); }, []);
  const update = (patch) => setSettings({ ...settings, ...patch });
  const toast = useToast();
  const [notifPerm, setNotifPerm] = useState(() => (isNative ? 'prompt' : notifPermission()));
  useEffect(() => { if (isNative) nativeNotifPermission().then(setNotifPerm).catch(() => {}); }, []);
  const [testBusy, setTestBusy] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const currency = settings.defaultCurrency || '₪';
  const subsMonthly = useSubsMonthly(payments, currency);

  const notifTimings = [
    { id: 'week',  label: 'שבוע לפני' },
    { id: 'three', label: '3 ימים לפני' },
    { id: 'day',   label: 'יום לפני' },
    { id: 'same',  label: 'ביום עצמו' },
  ];

  // Turning reminders on asks for the permission right away (Android 13+).
  const setNotif = async (on) => {
    update({ notif: on });
    if (on && isNative) setNotifPerm(await ensureNativeNotifPermission());
  };

  // Payment detection (Android): needs notification access, granted once in
  // the phone's settings. Re-checked whenever the user comes back to the app.
  const [detect, setDetect] = useState({ access: false, enabled: false });
  useEffect(() => {
    if (!isNative) return undefined;
    const check = () => detectStatus().then(setDetect).catch(() => {});
    check();
    const h = CapApp.addListener('resume', check);
    return () => { h.then((x) => x.remove()); };
  }, []);
  const toggleDetect = async (on) => {
    setDetect(await setDetectEnabled(on));
    if (!on) return;
    if ((await ensureNativeNotifPermission()) !== 'granted') toast('בלי הרשאת התראות ההצעות יופיעו רק באפליקציה', { type: 'info' });
    const st = await detectStatus();
    if (!st.access) {
      toast('אשר ל״תשלומים״ גישה להתראות וחזור לאפליקציה', { type: 'info' });
      setTimeout(() => openDetectAccess(), 700);
    }
  };
  const detectSub = !detect.enabled ? 'Google Wallet, אפליקציות האשראי ו־SMS'
    : detect.access ? 'פעיל · תשלום חדש יופיע כהצעה' : 'צריך לאשר גישה להתראות';

  const exportExpenses = async () => {
    const list = lists.activeList;
    if (!lists.items.length) { toast('אין עדיין הוצאות לייצא', { type: 'info' }); return; }
    const shared = (list?.members || []).length > 1;
    const csv = expensesToCSV(lists.items, shared ? {
      payerName: (id) => (id === 'joint' ? 'משותף' : list.memberInfo?.[id]?.name || ''),
    } : {});
    // ASCII file name: some browsers drop a Hebrew one and save "download".
    try { await shareCSV(csv, `${shared ? 'shared-expenses' : 'expenses'}-${new Date().toISOString().slice(0, 10)}.csv`); }
    catch (e) { if (!/cancel/i.test(e?.message || '')) toast('הייצוא נכשל', { type: 'error' }); }
  };

  const sendTestNotification = async () => {
    setTestBusy(true);
    if (isNative) {
      const perm = await ensureNativeNotifPermission();
      setNotifPerm(perm);
      if (perm === 'granted') { await sendNativeTestNotification(); toast('נשלחה התראת בדיקה', { type: 'success' }); }
      else toast('יש לאשר התראות בהגדרות הטלפון', { type: 'error' });
      setTestBusy(false); return;
    }
    const perm = await ensureNotifPermission();
    setNotifPerm(perm);
    if (perm === 'unsupported') {
      toast('המכשיר לא תומך בהתראות', { type: 'error' });
      setTestBusy(false); return;
    }
    if (perm !== 'granted') {
      toast('יש לאשר הרשאת התראות', { type: 'error' });
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
  const displayName = user?.displayName || settings.userName || 'משתמש';
  const email = user?.email;
  const photoURL = user?.photoURL;
  const cap = Number(settings.monthlyCap) || 0;
  const members = (lists.activeList?.members || []).length;
  const chevron = <Icon name="chevron-left" size={18} />;

  return (
    <div style={{ padding: '18px 18px 120px' }}>
      <h1 style={{ margin: '0 0 16px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>הגדרות</h1>

      {/* Profile — Google data when signed in with Google, otherwise editable name */}
      <div className="rise" style={{ background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)', borderRadius: 26, padding: 16, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
        {photoURL ? (
          <img src={photoURL} alt="" referrerPolicy="no-referrer" style={{
            width: 60, height: 60, borderRadius: '50%', objectFit: 'cover',
            border: '2.5px solid var(--stroke)', flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'var(--peach)', border: '2.5px solid var(--stroke)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 24, flexShrink: 0,
          }}>{(displayName || 'מ')[0]}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {user?.displayName ? (
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
          ) : (
            <input value={settings.userName} onChange={e => update({ userName: e.target.value })}
              placeholder="השם שלך" aria-label="השם שלך" style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: 20, fontWeight: 800, fontFamily: 'inherit', padding: 0,
            }} />
          )}
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 3, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isAnon ? 'מחובר ללא חשבון' : (email || 'החשבון שלי')}
          </div>
        </div>
      </div>

      <SettingsGroup title="כסף">
        <Row icon="card" tint="var(--mint)" label="תקציב חודשי"
          sub={cap > 0 ? `${fmtMoney(cap, currency)} לחודש` : 'לא הוגדר'}
          onClick={() => setBudgetOpen(true)} right={chevron} />
        <Row icon="user" tint="var(--lavender)" label="מרחבים ושיתוף"
          sub={`${lists.activeList?.name || 'ההוצאות שלי'}${members > 1 ? ` · ${members} משתתפים` : ''}`}
          onClick={() => setManageOpen(true)} right={chevron} />
        <Row icon="download" tint="var(--sky)" label="ייצוא הוצאות" sub={`קובץ CSV של ${lists.activeList?.name || 'ההוצאות שלי'}`}
          onClick={exportExpenses} right={chevron} />
        <Row icon="shekel" tint="var(--butter)" label="מטבע"
          right={
            <div style={{ display: 'flex', gap: 4 }}>
              {CURRENCIES.map(c => (
                <Chip key={c} active={currency === c} onClick={() => update({ defaultCurrency: c })} style={{ padding: '7px 11px' }}>{c}</Chip>
              ))}
            </div>
          } />
      </SettingsGroup>

      <SettingsGroup title="התראות">
        <Row icon="bell" tint="var(--butter)" label="תזכורות לתשלומים" sub="לפני כל חיוב של מנוי"
          right={<Toggle checked={settings.notif} onChange={setNotif} />} />
        {settings.notif && (
          <div style={{ padding: '4px 16px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {notifTimings.map(t => (
                <Chip key={t.id} active={settings.notifTimings.includes(t.id)} onClick={() => {
                  const has = settings.notifTimings.includes(t.id);
                  update({ notifTimings: has ? settings.notifTimings.filter(x => x !== t.id) : [...settings.notifTimings, t.id] });
                }}>{t.label}</Chip>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>שעה ביום</span>
              <input type="time" value={settings.notifTime} onChange={e => update({ notifTime: e.target.value })} style={{
                background: 'var(--surface-2)', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                padding: '9px 14px', borderRadius: 12, fontVariantNumeric: 'tabular-nums',
              }} />
            </label>
          </div>
        )}
        <Row icon="history" tint="var(--sky)" label="סיכום חודשי" sub="ב־1 לחודש: כמה יצא בחודש שעבר"
          right={<Toggle checked={settings.monthlySummary} onChange={v => update({ monthlySummary: v })} />} />
        <Row icon="card" tint="var(--mint)" label="התראת תקציב" sub="ב־80% וב־100% מהתקרה"
          right={<Toggle checked={settings.budgetAlerts !== false} onChange={v => update({ budgetAlerts: v })} />} />
        <Row icon="user" tint="var(--lavender)" label="פעילות במרחב המשותף" sub="כשמישהו מוסיף הוצאה"
          right={<Toggle checked={settings.sharedNotif !== false} onChange={v => update({ sharedNotif: v })} />} />
        <div style={{ padding: '12px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600 }}>
            {notifPerm === 'granted' ? 'הרשאה: מאושרת ✓' :
             notifPerm === 'denied'  ? 'הרשאה: חסומה — אפשר בהגדרות המכשיר' :
             notifPerm === 'unsupported' ? 'המכשיר לא תומך בהתראות' : 'הרשאה: טרם אושרה'}
          </div>
          <button onClick={sendTestNotification} disabled={testBusy} className="press" style={{
            padding: '10px 14px', borderRadius: 14, border: 'none', cursor: testBusy ? 'wait' : 'pointer',
            background: 'var(--surface-2)', color: 'var(--ink)',
            fontFamily: 'inherit', fontWeight: 800, fontSize: 13.5,
            display: 'flex', alignItems: 'center', gap: 6, opacity: testBusy ? .7 : 1, flexShrink: 0,
          }}>
            {testBusy ? <Spinner size={14} /> : <Icon name="bell" size={15} strokeWidth={2.4} />}
            בדיקה
          </button>
        </div>
      </SettingsGroup>

      {(isNative || !isAnon) && (
        <SettingsGroup title="זיהוי תשלומים אוטומטי">
          {isNative && (
            <Row icon="card" tint="var(--mint)" label="תשלומים מהטלפון" sub={detectSub}
              right={<Toggle checked={detect.enabled} onChange={toggleDetect} />} />
          )}
          {isNative && detect.enabled && !detect.access && (
            <Row icon="bell" tint="var(--butter)" label="אישור גישה להתראות" sub="פעם אחת, בהגדרות הטלפון"
              onClick={() => openDetectAccess()} right={chevron} />
          )}
          {!isAnon && (
            <Row icon="download" tint="var(--sky)" label="קבלות מ־Gmail" sub="מנויים וקניות מהמייל"
              onClick={onOpenGmail} right={chevron} />
          )}
        </SettingsGroup>
      )}

      <SettingsGroup title="מראה">
        <div style={{ padding: 12 }}>
          <Segmented
            options={[{ id: 'system', label: 'אוטומטי' }, { id: 'light', label: 'בהיר' }, { id: 'dark', label: 'כהה' }]}
            value={settings.theme || 'system'} onChange={(v) => update({ theme: v })} />
        </div>
      </SettingsGroup>

      {isNative && (
        <SettingsGroup title="עדכונים">
          <Row icon="download" tint="var(--mint)" label="בדוק עדכונים" sub={version ? `גרסה ${version.name}` : ''}
            onClick={onOpenUpdates} right={chevron} />
        </SettingsGroup>
      )}

      <SettingsGroup title="חשבון">
        <Row icon="arrow-right" tint="var(--danger-soft)" label="התנתקות" sub={email || 'יציאה מהחשבון'} danger onClick={onSignOut} />
      </SettingsGroup>

      <div style={{ textAlign: 'center', color: 'var(--ink-dim)', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
        תשלומים{version ? ` · גרסה ${version.name}` : ''}
      </div>

      <BudgetSettingsSheet open={budgetOpen} onClose={() => setBudgetOpen(false)}
        settings={settings} setSettings={setSettings} categories={categories} subsMonthly={subsMonthly} />
      <ManageExpensesSheet open={manageOpen} onClose={() => setManageOpen(false)} lists={lists} />
    </div>
  );
}

function SettingsGroup({ title, children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div className="rise" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink-dim)', padding: '0 6px 8px' }}>
        {title}
      </div>
      <div style={{ background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)', borderRadius: 24, overflow: 'hidden' }}>
        {items.map((child, i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--divider)' : 'none' }}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

export { CalendarScreen, SettingsScreen, StatsDetailSheet };
