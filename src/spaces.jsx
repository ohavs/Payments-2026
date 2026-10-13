// Shared spaces UI: the space switcher at the top of the expenses and
// subscriptions tabs, who-paid attribution, per-person totals, and the sheet
// that opens a shared household space and invites a partner.
import React from 'react';
import { Sheet } from './components.jsx';
import { fmtMoney } from './data.jsx';
import { useToast } from './feedback.jsx';
import { fbAuth } from './firebase-init.jsx';
import { isSharedList } from './lists.jsx';
import { haptic } from './lib/platform.js';

const TONES = ['var(--peach)', 'var(--sky)', 'var(--mint)', 'var(--butter)'];
const JOINT = 'joint';

function firstName(info) {
  const n = (info?.name || '').trim();
  if (n) return n.split(/\s+/)[0];
  const e = (info?.email || '').trim();
  return e ? e.split('@')[0] : 'שותף';
}

// Who paid, as a short label: "אני", the member's first name, or "משותף".
function payerLabel(list, payer, myUid) {
  if (payer === JOINT) return 'משותף';
  if (!payer || payer === myUid) return 'אני';
  return firstName(list?.memberInfo?.[payer]);
}

// The people an expense can be attributed to in a shared space: me first, then
// the other members, then the joint account.
function payers(list, myUid) {
  const members = list?.members || [];
  const ordered = [myUid, ...members.filter((m) => m !== myUid)].filter(Boolean);
  return [
    ...ordered.map((uid) => {
      const info = list?.memberInfo?.[uid] || {};
      const label = payerLabel(list, uid, myUid);
      return {
        id: uid, label, info,
        // The avatar shows the person's own initial, so "אני" and a partner
        // whose name starts with א still look different.
        initial: (info.name || info.email) ? firstName(info)[0] : label[0],
        tone: TONES[Math.max(0, members.indexOf(uid)) % TONES.length],
      };
    }),
    { id: JOINT, label: 'משותף', initial: 'מ', joint: true, tone: 'var(--lavender)' },
  ];
}

function Avatar({ label, photo, tone = 'var(--peach)', size = 28, joint }) {
  const box = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: `${size >= 28 ? 2 : 1.5}px solid var(--stroke)`, background: tone, color: 'var(--ink)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.44, fontWeight: 900, lineHeight: 1, overflow: 'hidden',
  };
  if (photo) return <img src={photo} alt="" referrerPolicy="no-referrer" style={{ ...box, objectFit: 'cover' }} />;
  if (joint) {
    return (
      <span style={box} aria-hidden="true">
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62}>
          <circle cx="9" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="15" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" />
        </svg>
      </span>
    );
  }
  return <span style={box} aria-hidden="true">{(label || '?')[0]}</span>;
}

function PeopleIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="11" cy="10" r="4.2" fill="#fff" stroke="#141414" strokeWidth="2" />
      <path d="M3.8 25.5a7.2 7.2 0 0 1 14.4 0Z" fill="#fff" stroke="#141414" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="21.5" cy="11" r="4.2" fill="#4F46E5" stroke="#141414" strokeWidth="2" />
      <path d="M14.3 26.5a7.2 7.2 0 0 1 14.4 0Z" fill="#4F46E5" stroke="#141414" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// "אישי | הבית שלנו | + משותף": one tap moves the whole app to another space.
function SpaceSwitcher({ lists, onCreateShared, style }) {
  const { spaces, activeListId, setActiveListId } = lists;
  const hasShared = spaces.some(isSharedList);
  if (!spaces.length) return null;
  const personalCount = spaces.filter((l) => !isSharedList(l)).length;
  return (
    <div className="hide-scroll" role="tablist" aria-label="מרחב" style={{
      display: 'flex', gap: 8, overflowX: 'auto', margin: '12px -18px 0', padding: '2px 18px', ...style,
    }}>
      {spaces.map((l) => {
        const on = l.id === activeListId;
        const shared = isSharedList(l);
        const label = shared ? (l.name || 'משותף') : (personalCount > 1 ? (l.name || 'אישי') : 'אישי');
        return (
          <button key={l.id} role="tab" aria-selected={on} onClick={() => { if (!on) { haptic('select'); setActiveListId(l.id); } }}
            className="press" style={{
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, height: 40, padding: shared ? '0 14px 0 8px' : '0 16px',
              borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
              background: on ? 'var(--ink)' : 'var(--surface-1)', color: on ? 'var(--bg)' : 'var(--ink)',
              boxShadow: on ? 'none' : 'var(--shadow-card)', whiteSpace: 'nowrap',
              transition: 'background-color .2s ease, color .2s ease',
            }}>
            {shared && <PeopleIcon size={24} />}
            {label}
          </button>
        );
      })}
      {!hasShared && (
        <button onClick={() => { haptic('tap'); onCreateShared(); }} className="press" style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, height: 40, padding: '0 14px',
          borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
          background: 'transparent', color: 'var(--ink)', border: '2px dashed var(--surface-3)', whiteSpace: 'nowrap',
        }}>
          + משותף
        </button>
      )}
    </div>
  );
}

// Who paid: chips for each member and the joint account.
function PayerPicker({ list, value, onChange, style }) {
  const myUid = fbAuth.currentUser?.uid;
  return (
    <div className="hide-scroll" style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', ...style }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)', flexShrink: 0, marginInlineEnd: 2 }}>שילם/ה</span>
      {payers(list, myUid).map((p) => {
        const on = (value || myUid) === p.id;
        return (
          <button key={p.id} onClick={() => { haptic('select'); onChange(p.id); }} aria-pressed={on} className="press" style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, height: 38, padding: '0 12px 0 5px',
            borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800,
            border: on ? '2px solid var(--ink)' : '2px solid transparent',
            background: on ? 'var(--accent-soft)' : 'var(--surface-2)', color: 'var(--ink)', whiteSpace: 'nowrap',
          }}>
            <Avatar label={p.initial} photo={p.info?.photo} tone={p.tone} size={26} joint={p.joint} />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// Per-person totals for the month in a shared space. Tapping one filters the list.
function PayerTotals({ list, items, currency, value, onChange, style }) {
  const myUid = fbAuth.currentUser?.uid;
  const rows = payers(list, myUid).map((p) => ({
    ...p,
    sum: items.filter((it) => (it.paidBy || it.addedBy || myUid) === p.id).reduce((s, it) => s + (Number(it.amount) || 0), 0),
  })).filter((p) => p.sum > 0 || !p.joint);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }}>
      {rows.map((p) => {
        const on = value === p.id;
        return (
          <button key={p.id} onClick={() => { haptic('select'); onChange(on ? null : p.id); }} aria-pressed={on} className="press" style={{
            display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px 0 5px', borderRadius: 999,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? 'var(--bg)' : 'var(--ink)',
            transition: 'background-color .2s ease, color .2s ease',
          }}>
            <Avatar label={p.initial} photo={p.info?.photo} tone={p.tone} size={26} joint={p.joint} />
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{p.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(Math.round(p.sum), currency)}</span>
          </button>
        );
      })}
    </div>
  );
}

// Small payer avatar for list rows in a shared space.
function PayerDot({ list, payer, size = 20 }) {
  const myUid = fbAuth.currentUser?.uid;
  const p = payers(list, myUid).find((x) => x.id === (payer || myUid));
  if (!p) return null;
  return <Avatar label={p.initial} photo={p.info?.photo} tone={p.tone} size={size} joint={p.joint} />;
}

// Open a shared space and invite the partner by their Google account, or join
// one with a code.
function SharedSpaceSheet({ open, onClose, lists }) {
  const toast = useToast();
  const [name, setName] = React.useState('הבית שלנו');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [mode, setMode] = React.useState('create');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) { setName('הבית שלנו'); setEmail(''); setCode(''); setMode('create'); setBusy(false); } }, [open]);

  const create = async () => {
    const e = email.trim().toLowerCase();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast('כתובת מייל לא תקינה', { type: 'error' }); return; }
    setBusy(true);
    try {
      const id = await lists.ops.createList(name.trim() || 'הבית שלנו', 'shared');
      if (e) {
        const res = await lists.ops.inviteEmail(id, e);
        if (!res.ok && res.reason === 'self') toast('זו הכתובת שלך. אפשר להזמין אחר כך מהניהול', { type: 'info' });
        else if (!res.ok) toast('המרחב נפתח, אבל ההזמנה נכשלה. נסה שוב מהניהול', { type: 'error' });
        else toast(`המרחב נפתח והזמנה נשלחה ל־${res.email}`, { type: 'success' });
      } else {
        toast('המרחב נפתח. אפשר להזמין מהניהול', { type: 'success' });
      }
      haptic('success');
      onClose();
    } catch (err) {
      console.error('create shared space', err);
      toast('פתיחת המרחב נכשלה', { type: 'error' });
    }
    setBusy(false);
  };

  const join = async () => {
    setBusy(true);
    const res = await lists.ops.joinByCode(code);
    setBusy(false);
    if (res.ok) { haptic('success'); toast('הצטרפת למרחב המשותף', { type: 'success' }); onClose(); }
    else if (res.reason !== 'empty') toast('קוד לא תקין או שאין הרשאה', { type: 'error' });
  };

  const field = {
    width: '100%', height: 52, border: 'none', outline: 'none', borderRadius: 16, background: 'var(--surface-2)',
    color: 'var(--ink)', padding: '0 16px', fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
  };
  const label = { fontSize: 13.5, fontWeight: 800, color: 'var(--ink-dim)', margin: '0 4px 8px' };

  return (
    <Sheet open={open} onClose={onClose} height="88%">
      <div style={{ padding: '6px 22px 28px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <div style={{ display: 'flex' }}>
            <Avatar label="א" tone="var(--peach)" size={64} photo={fbAuth.currentUser?.photoURL} />
            <span style={{ marginInlineStart: -14 }}><Avatar label="+" tone="var(--sky)" size={64} /></span>
          </div>
        </div>
        <h2 style={{ margin: '16px 0 0', fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', textAlign: 'center' }}>מרחב משותף</h2>
        <p style={{ margin: '8px 6px 0', fontSize: 15, lineHeight: 1.55, color: 'var(--ink-dim)', fontWeight: 600, textAlign: 'center' }}>
          מקום אחד לשניכם להוצאות הבית, למנויים ולתקציב. כל אחד מוסיף מהטלפון שלו, ורואים מי הוציא מה.
        </p>

        {mode === 'create' ? (
          <>
            <div style={{ marginTop: 22 }}>
              <div style={label}>שם המרחב</div>
              <input value={name} onChange={(e) => setName(e.target.value)} style={field} />
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={label}>ה־Gmail של השותף/ה</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" type="email"
                dir="ltr" inputMode="email" autoComplete="off" onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
                style={{ ...field, textAlign: 'left' }} />
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600, margin: '8px 4px 0', lineHeight: 1.5 }}>
                ההזמנה תופיע אצלו/ה באפליקציה אחרי כניסה עם החשבון הזה.
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 20 }} />
            <button onClick={create} disabled={busy} className="btn-primary" style={{ height: 56, fontSize: 17, width: '100%', marginTop: 20 }}>
              {busy ? 'פותח…' : email.trim() ? 'פתח והזמן' : 'פתח מרחב'}
            </button>
            <button onClick={() => setMode('join')} style={{
              marginTop: 12, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--ink-dim)', fontWeight: 800, fontSize: 14, padding: 8,
            }}>קיבלתי קוד הצטרפות</button>
          </>
        ) : (
          <>
            <div style={{ marginTop: 22 }}>
              <div style={label}>קוד הצטרפות</div>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="הדבק כאן את הקוד" dir="ltr"
                autoComplete="off" onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
                style={{ ...field, textAlign: 'left', fontFamily: 'monospace', fontSize: 15 }} />
            </div>
            <div style={{ flex: 1, minHeight: 20 }} />
            <button onClick={join} disabled={busy || !code.trim()} className="btn-primary" style={{ height: 56, fontSize: 17, width: '100%', marginTop: 20 }}>
              {busy ? 'מצטרף…' : 'הצטרף'}
            </button>
            <button onClick={() => setMode('create')} style={{
              marginTop: 12, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--ink-dim)', fontWeight: 800, fontSize: 14, padding: 8,
            }}>פתיחת מרחב חדש</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

export { Avatar, JOINT, PayerDot, PayerPicker, PayerTotals, PeopleIcon, SharedSpaceSheet, SpaceSwitcher, firstName, payerLabel, payers };
