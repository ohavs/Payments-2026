// Settings → "מה נקלט לאחרונה": the payment notifications the phone saw and
// what was decided about each, plus whether the listener is connected. Lets a
// missed Wallet payment be explained, and copied to fix the parser.
import React from 'react';
import { Sheet } from './components.jsx';
import { useToast } from './feedback.jsx';
import { clearDetectLog, detectLog, detectLogText, detectReasonLabel, detectStatus, openDetectAccess } from './lib/detect.js';

function when(ms) {
  if (!ms) return '—';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return `לפני ${h === 1 ? 'שעה' : `${h} שעות`}`;
  return new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

const OFFERED = new Set(['ok', 'ok-no-amount', 'duplicate']);

export function DetectLogSheet({ open, onClose }) {
  const toast = useToast();
  const [entries, setEntries] = React.useState([]);
  const [status, setStatus] = React.useState({});
  const load = React.useCallback(() => {
    detectLog().then(setEntries).catch(() => {});
    detectStatus().then(setStatus).catch(() => {});
  }, []);
  React.useEffect(() => { if (open) load(); }, [open, load]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(detectLogText(entries, status)); toast('הועתק', { type: 'success' }); }
    catch { toast('לא ניתן להעתיק', { type: 'error' }); }
  };
  const clear = async () => { await clearDetectLog().catch(() => {}); setEntries([]); };

  const ok = status.access && status.connected;
  const stateText = !status.enabled ? 'הזיהוי כבוי'
    : !status.access ? 'אין גישה להתראות'
      : status.connected ? 'מחובר ומאזין להתראות' : 'לא מחובר: הטלפון לא מעביר התראות לאפליקציה';

  return (
    <Sheet open={open} onClose={onClose} title="מה נקלט לאחרונה" height="88%">
      <div style={{ padding: '4px 20px 24px' }}>
        <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: ok ? 'var(--accent)' : 'var(--danger)' }} />
            {stateText}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 4 }}>
            התראה אחרונה שנקלטה: {when(status.lastSeen)} · חובר: {when(status.lastConnected)}
          </div>
          {status.enabled && status.access && !status.connected && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
                בהגדרות הטלפון: כבה והדלק את הגישה של ״תשלומים״ להתראות, וחזור לכאן.
              </div>
              <button className="btn-primary" onClick={() => openDetectAccess()} style={{ marginTop: 10, height: 38, padding: '0 14px', borderRadius: 12, fontSize: 13.5 }}>
                פתח גישה להתראות
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={copy} disabled={!entries.length} className="btn-primary" style={{ flex: 1, height: 40, borderRadius: 12, fontSize: 14 }}>העתקה</button>
          <button onClick={clear} disabled={!entries.length} style={{
            flex: 1, height: 40, borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            border: 'none', background: 'var(--surface-2)', color: 'var(--ink)',
          }}>ניקוי</button>
        </div>

        {!entries.length && (
          <div style={{ fontSize: 13.5, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 18, lineHeight: 1.6, textAlign: 'center' }}>
            עוד לא נקלטו התראות תשלום.<br />אחרי התשלום הבא בטלפון הוא יופיע כאן, עם מה שהוחלט עליו.
          </div>
        )}
        {entries.map((e, i) => (
          <div key={`${e.time}-${i}`} style={{ padding: '12px 0', borderTop: i ? '1px solid var(--divider)' : 'none', marginTop: i ? 0 : 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-dim)' }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.app || e.pkg} · {when(e.time)}</span>
              <span style={{
                flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 800,
                background: OFFERED.has(e.reason) ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: OFFERED.has(e.reason) ? 'var(--accent-ink)' : 'var(--ink)',
              }}>{detectReasonLabel(e)}</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 4, wordBreak: 'break-word' }}>{e.title || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{e.text}</div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
