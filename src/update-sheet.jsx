// "Check for updates" (Android): compare with the latest GitHub Release,
// download it in-app and open Android's installer.
import React from 'react';
import { App as CapApp } from '@capacitor/app';
import { Sheet } from './components.jsx';
import { Spinner } from './feedback.jsx';
import { canInstallUpdates, checkForUpdate, installUpdate, openInstallSettings } from './lib/updater.js';

function UpdateSheet({ open, onClose, initial }) {
  // checking | uptodate | available | permission | downloading | installing | error
  const [state, setState] = React.useState('checking');
  const [info, setInfo] = React.useState(initial || null);
  const [pct, setPct] = React.useState(0);

  const check = React.useCallback(async () => {
    setState('checking');
    try {
      const r = await checkForUpdate();
      setInfo(r);
      setState(r.available ? 'available' : 'uptodate');
    } catch (e) {
      setState('error');
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (initial?.available) { setInfo(initial); setState('available'); } else check();
  }, [open]);

  // Coming back from Android's "install unknown apps" screen: continue.
  React.useEffect(() => {
    if (!open || state !== 'permission') return;
    const sub = CapApp.addListener('resume', async () => {
      if (await canInstallUpdates()) setState('available');
    });
    return () => { sub.then((s) => s.remove()); };
  }, [open, state]);

  const update = async () => {
    if (!(await canInstallUpdates())) { setState('permission'); return; }
    setState('downloading'); setPct(0);
    try {
      await installUpdate(info.latest, (p) => setPct(Math.max(0, p)));
      setState('installing');
    } catch (e) {
      setState('error');
    }
  };

  const latest = info?.latest;
  const current = info?.current;

  return (
    <Sheet open={open} onClose={onClose} title="עדכונים" height="72%">
      <div style={{ padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--ink-dim)', fontWeight: 600 }}>
          הגרסה שלך: {current ? current.name : '…'}
        </div>

        {state === 'checking' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
            <Spinner size={18} /> בודק אם יש גרסה חדשה…
          </div>
        )}

        {state === 'uptodate' && (
          <div style={{ fontSize: 18, fontWeight: 800 }}>יש לך את הגרסה האחרונה ✓</div>
        )}

        {state === 'error' && (
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FF5C5C' }}>
            לא הצלחתי לבדוק או להוריד עדכון. בדוק חיבור לאינטרנט ונסה שוב.
          </div>
        )}

        {latest && ['available', 'permission', 'downloading', 'installing'].includes(state) && (
          <>
            <div>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>גרסה {latest.versionName} זמינה</div>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 4, fontWeight: 600 }}>{latest.sizeMb}MB</div>
            </div>
            {latest.notes.length > 0 && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>מה חדש</div>
                {latest.notes.slice(0, 8).map((n, i) => (
                  <div key={i} style={{ fontSize: 14, lineHeight: 1.5, display: 'flex', gap: 8 }}>
                    <span aria-hidden="true">•</span><span>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {state === 'permission' && (
          <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
            אנדרואיד צריך אישור חד־פעמי להתקין עדכונים מהאפליקציה. במסך שייפתח הפעל את "אפשר מהמקור הזה" וחזור לכאן.
          </div>
        )}

        {state === 'downloading' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--ink-dim)' }}>
              <span>מוריד</span><span>{pct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-2)', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width .15s linear' }} />
            </div>
          </div>
        )}

        {state === 'installing' && (
          <div style={{ fontSize: 14, fontWeight: 700 }}>אשר את ההתקנה בחלון של אנדרואיד.</div>
        )}

        {state === 'available' && (
          <button onClick={update} style={primaryBtn}>עדכן עכשיו</button>
        )}
        {state === 'permission' && (
          <button onClick={openInstallSettings} style={primaryBtn}>אפשר התקנת עדכונים</button>
        )}
        {(state === 'uptodate' || state === 'error') && (
          <button onClick={check} style={{ ...primaryBtn, background: 'var(--surface-2)', color: 'var(--ink)' }}>בדוק שוב</button>
        )}
      </div>
    </Sheet>
  );
}

const primaryBtn = {
  width: '100%', height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: 'var(--accent-fg)',
  fontFamily: 'inherit', fontWeight: 800, fontSize: 16,
};

export { UpdateSheet };
