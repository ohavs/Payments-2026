// Detected payments: the inbox card on the expenses screen (Wallet / card
// notifications on Android) and the Gmail receipts scan.
import React from 'react';
import { App as CapApp } from '@capacitor/app';
import { Icon, ServiceBubble, Sheet } from './components.jsx';
import { fmtMoney, getService } from './data.jsx';
import { Spinner } from './feedback.jsx';
import { detectSupported, isAlreadyRecorded, listSuggestions, onDetectEvent, removeSuggestions, suggestionToItem } from './lib/detect.js';
import { scanGmail } from './lib/gmail.js';
import { haptic, isNative } from './lib/platform.js';
import { CategoryBadge } from './ui/icons.jsx';
import { Card } from './ui/kit.jsx';

const SOURCE_LABEL = { wallet: 'Google Wallet', sms: 'SMS', card: 'אשראי', gmail: 'Gmail' };

function ago(t) {
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h === 1 ? 'שעה' : `${h} שעות`}`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

// Pending suggestions from the native listener, kept fresh while the app runs.
function useDetectedSuggestions(enabled) {
  const [list, setList] = React.useState([]);
  const refresh = React.useCallback(() => {
    if (!detectSupported) return;
    listSuggestions().then(setList).catch(() => {});
  }, []);
  React.useEffect(() => {
    if (!detectSupported || !enabled) return undefined;
    refresh();
    const offChanged = onDetectEvent('changed', refresh);
    const resume = CapApp.addListener('resume', refresh);
    return () => { offChanged(); resume.then((h) => h.remove()); };
  }, [enabled, refresh]);
  const remove = React.useCallback(async (ids) => {
    setList((l) => l.filter((s) => !ids.includes(s.id)));
    await removeSuggestions(ids).catch(() => {});
  }, []);
  return { suggestions: list, refresh, remove };
}

function SuggestionRow({ s, category, onAdd, onDismiss, onEdit }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <button onClick={onEdit} aria-label="עריכה לפני הוספה" style={{
        display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, border: 'none', background: 'transparent',
        padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'right',
      }}>
        <CategoryBadge name={category} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.merchant || 'תשלום'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--ink)', fontWeight: 800, fontSize: 13.5 }}>{fmtMoney(s.amount, s.currency)}</span>
            {' · '}{category} · {SOURCE_LABEL[s.source] || s.app || 'זוהה'}{s.last4 ? ` ••${s.last4}` : ''} · {ago(s.time)}
          </div>
        </div>
      </button>
      <button onClick={onDismiss} aria-label="התעלם" className="press" style={{
        width: 36, height: 36, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: 'var(--surface-2)', color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon name="close" size={16} strokeWidth={2.6} /></button>
      <button onClick={onAdd} className="btn-primary" style={{
        height: 36, padding: '0 14px', borderRadius: 12, borderWidth: 2, fontSize: 13.5, flexShrink: 0,
      }}>הוסף</button>
    </div>
  );
}

// "זוהו 2 תשלומים" — add with one tap, tap the row to adjust first.
function SuggestionsCard({ suggestions, categories, items, onAdd, onDismiss, onEdit, style }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!suggestions.length) return null;
  const shown = expanded ? suggestions : suggestions.slice(0, 3);
  return (
    <Card className="rise" style={{ padding: '14px 16px 6px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 14.5, fontWeight: 800 }}>
          {suggestions.length === 1 ? 'זוהה תשלום' : `זוהו ${suggestions.length} תשלומים`}
        </div>
        {suggestions.length > 1 && (
          <button onClick={() => onAdd(suggestions)} style={{
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--accent-ink)', fontSize: 13.5, fontWeight: 800,
          }}>הוסף הכל</button>
        )}
      </div>
      {shown.map((s, i) => (
        <div key={s.id} style={{ borderTop: i ? '1px solid var(--divider)' : 'none' }}>
          <SuggestionRow s={s} category={suggestionToItem(s, { categories, items }).group}
            onAdd={() => onAdd([s])} onDismiss={() => onDismiss([s])} onEdit={() => onEdit(s)} />
        </div>
      ))}
      {suggestions.length > 3 && (
        <button onClick={() => setExpanded((e) => !e)} style={{
          width: '100%', border: 'none', background: 'transparent', padding: '6px 0 10px', cursor: 'pointer',
          fontFamily: 'inherit', color: 'var(--ink-dim)', fontSize: 13, fontWeight: 700,
        }}>{expanded ? 'הצג פחות' : `ועוד ${suggestions.length - 3}`}</button>
      )}
    </Card>
  );
}

// ---------- Gmail ----------
const HANDLED_KEY = 'gmail-handled-v1';
function loadHandled() {
  try { return new Set(JSON.parse(localStorage.getItem(HANDLED_KEY) || '[]')); } catch (e) { return new Set(); }
}
function saveHandled(set) {
  try { localStorage.setItem(HANDLED_KEY, JSON.stringify([...set].slice(-500))); } catch (e) { /* private mode */ }
}

const CYCLE_HE = { monthly: 'לחודש', yearly: 'לשנה' };

function gmailError(e) {
  if (e?.code === 'gmail/api-disabled') return 'הגישה ל־Gmail עוד לא הופעלה בפרויקט. זה בטיפול.';
  if (e?.code === 'gmail/forbidden' || e?.code === 'auth/user-cancelled' || /access_denied|denied|12501|blocked/i.test(e?.message || '')) {
    return 'Google חסמה את הגישה ל־Gmail. צריך לפרסם את האפליקציה (Publish app) במסך ההרשאות ב־Google Cloud.';
  }
  if (e?.code === 'auth/popup-closed-by-user' || /cancel/i.test(e?.message || '')) return 'הכניסה בוטלה.';
  if (e?.code === 'auth/user-mismatch') return 'צריך לבחור את אותו חשבון Google שמחובר לאפליקציה.';
  return 'הסריקה נכשלה. נסה שוב.';
}

function GmailScanSheet({ open, onClose, categories, items, subs, currency, rates, onAddExpense, onAddSubscription }) {
  const [state, setState] = React.useState('idle'); // idle | scanning | done | error
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState({ receipts: [], recurring: [] });
  const [handled, setHandled] = React.useState(loadHandled);

  React.useEffect(() => { if (open && state === 'error') setState('idle'); }, [open]);

  const markHandled = (keys) => {
    setHandled((prev) => { const next = new Set(prev); keys.forEach((k) => next.add(k)); saveHandled(next); return next; });
  };

  const scan = async () => {
    setState('scanning'); setError('');
    try {
      const r = await scanGmail();
      setResult(r);
      setState('done');
    } catch (e) {
      console.error('gmail scan failed', e);
      setError(gmailError(e));
      setState('error');
    }
  };

  // Hide what is already tracked: subscriptions the user has, receipts that
  // match an expense or belong to a subscription.
  const subNames = new Set(subs.map((p) => (p.customService?.name || getService(p.serviceId)?.name || '').toLowerCase()));
  const subIds = new Set(subs.map((p) => p.serviceId).filter(Boolean));
  const isTracked = (r) => (r.serviceId && subIds.has(r.serviceId)) || subNames.has((r.merchant || '').toLowerCase());
  const recurring = result.recurring.filter((s) => !handled.has(s.key) && !isTracked(s));
  const recurringIds = new Set(result.recurring.flatMap((s) => s.receiptIds));
  const receipts = result.receipts.filter((r) => !handled.has(r.id) && !recurringIds.has(r.id) && !isTracked(r) && !isAlreadyRecorded(r, items));

  const addSub = (s) => {
    const svc = s.serviceId ? getService(s.serviceId) : null;
    onAddSubscription({
      id: 'p' + Date.now(),
      serviceId: svc ? svc.id : null,
      customService: svc ? null : {
        id: 'custom_' + Date.now(), name: s.merchant, cat: 'software', bg: '#4F46E5', fg: '#FFFFFF',
        glyph: (s.merchant || '?')[0], image: null, price: 0, cycle: s.cycle,
      },
      price: s.amount, currency: s.currency, cycle: s.cycle, nextDate: s.nextDate, note: 'זוהה מ־Gmail',
    });
    markHandled([s.key, ...s.receiptIds]);
    haptic('success');
  };
  const addReceipt = (r) => {
    onAddExpense(suggestionToItem(r, { categories, items, currency, rates }));
    markHandled([r.id]);
  };

  return (
    <Sheet open={open} onClose={onClose} title="קבלות מ־Gmail" height="88%">
      <div style={{ padding: '0 20px 30px' }}>
        {(state === 'idle' || state === 'error') && (
          <div style={{ textAlign: 'center', padding: '18px 6px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-dim)', lineHeight: 1.55 }}>
              מחפש קבלות וחיובים מ־90 הימים האחרונים ומציע להוסיף אותם כהוצאות או כמנויים.
              הקריאה היא לקריאה בלבד ונעשית בטלפון. שום מייל לא נשמר.
            </div>
            {state === 'error' && (
              <div role="alert" style={{ marginTop: 14, color: 'var(--danger)', fontWeight: 700, fontSize: 14 }}>{error}</div>
            )}
            <button onClick={scan} className="btn-primary" style={{ marginTop: 20, height: 52, padding: '0 26px', fontSize: 16 }}>
              סרוק את Gmail
            </button>
          </div>
        )}
        {state === 'scanning' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0', color: 'var(--ink-dim)', fontWeight: 700 }}>
            <Spinner size={26} /> סורק קבלות…
          </div>
        )}
        {state === 'done' && (
          <>
            {!recurring.length && !receipts.length && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-dim)', fontWeight: 700 }}>
                לא נמצאו קבלות חדשות. הכל כבר רשום.
              </div>
            )}
            {recurring.length > 0 && (
              <>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink-dim)', margin: '8px 4px 8px' }}>נראים כמו מנויים</div>
                <Card style={{ padding: '4px 14px' }}>
                  {recurring.map((s, i) => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i ? '1px solid var(--divider)' : 'none' }}>
                      {s.serviceId ? <ServiceBubble service={getService(s.serviceId)} size={40} /> : <CategoryBadge name={s.merchant} size={40} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.serviceId ? getService(s.serviceId).name : s.merchant}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 2 }}>
                          {fmtMoney(s.amount, s.currency)} {CYCLE_HE[s.cycle]}{s.count > 1 ? ` · ${s.count} חיובים` : ''}
                        </div>
                      </div>
                      <button onClick={() => markHandled([s.key, ...s.receiptIds])} aria-label="התעלם" className="press" style={{
                        width: 36, height: 36, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                        background: 'var(--surface-2)', color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}><Icon name="close" size={16} strokeWidth={2.6} /></button>
                      <button onClick={() => addSub(s)} className="btn-primary" style={{ height: 36, padding: '0 12px', borderRadius: 12, borderWidth: 2, fontSize: 13 }}>
                        הוסף מנוי
                      </button>
                    </div>
                  ))}
                </Card>
              </>
            )}
            {receipts.length > 0 && (
              <>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink-dim)', margin: '18px 4px 8px' }}>קבלות</div>
                <Card style={{ padding: '0 14px' }}>
                  {receipts.map((r, i) => (
                    <div key={r.id} style={{ borderTop: i ? '1px solid var(--divider)' : 'none' }}>
                      <SuggestionRow s={r} category={suggestionToItem(r, { categories, items }).group}
                        onAdd={() => addReceipt(r)} onDismiss={() => markHandled([r.id])} onEdit={() => addReceipt(r)} />
                    </div>
                  ))}
                </Card>
              </>
            )}
            <button onClick={scan} style={{
              display: 'block', margin: '18px auto 0', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit', color: 'var(--ink-dim)', fontSize: 13.5, fontWeight: 700,
            }}>סרוק שוב</button>
          </>
        )}
        {!isNative && state !== 'scanning' && (
          <div style={{ fontSize: 12, color: 'var(--ink-dim)', textAlign: 'center', marginTop: 22, fontWeight: 600 }}>
            בכניסה הראשונה Google תבקש אישור לקריאת המיילים.
          </div>
        )}
      </div>
    </Sheet>
  );
}

export { GmailScanSheet, SuggestionsCard, useDetectedSuggestions };
