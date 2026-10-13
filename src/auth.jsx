// Login screen — Google primary, anonymous fallback.
import React from 'react';
import { Spinner, useToast } from './feedback.jsx';
import { CoinLogo } from './ui/icons.jsx';

function LoginScreen({ onSignInGoogle, onSignInAnonymous }) {
  const [busy, setBusy] = React.useState(null); // 'google' | 'anon' | null
  const toast = useToast();

  const handleGoogle = async () => {
    setBusy('google');
    try { await onSignInGoogle(); }
    catch (e) {
      const cancelled = e?.code === 'auth/popup-closed-by-user' || /cancel/i.test(e?.message || '');
      toast(cancelled ? 'ההתחברות בוטלה' : 'שגיאה בהתחברות', { type: 'error' });
      setBusy(null);
    }
  };
  const handleAnon = async () => {
    setBusy('anon');
    try { await onSignInAnonymous(); }
    catch (e) { toast('שגיאה ביצירת חשבון', { type: 'error' }); setBusy(null); }
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'var(--bg)', color: 'var(--ink)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, direction: 'rtl',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'relative', textAlign: 'center', maxWidth: 360, width: '100%',
      }}>
        <CoinLogo size={96} style={{ marginBottom: 22 }} />

        <h1 className="rise" style={{ margin: '0 0 10px', fontSize: 38, fontWeight: 900, letterSpacing: '-0.035em' }}>
          תשלומים
        </h1>
        <p className="rise" style={{ animationDelay: '60ms', margin: '0 0 40px', fontSize: 16.5, color: 'var(--ink-dim)', lineHeight: 1.5, fontWeight: 500 }}>
          כל ההוצאות והמנויים במקום אחד,<br />עם תזכורת לפני כל חיוב
        </p>

        <button onClick={handleGoogle} disabled={!!busy} className="btn-primary" style={{
          width: '100%', height: 58, padding: '0 18px',
          cursor: busy ? 'wait' : 'pointer', background: '#FFFFFF', color: '#1F1F1F',
          fontFamily: 'inherit', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginBottom: 14, opacity: busy && busy !== 'google' ? .55 : 1,
        }}>
          {busy === 'google' ? <Spinner size={18} color="#1F1F1F" /> : <GoogleLogo />}
          המשך עם Google
        </button>

        <button onClick={handleAnon} disabled={!!busy} style={{
          width: '100%', padding: '14px 18px', borderRadius: 16,
          border: 'none', cursor: busy ? 'wait' : 'pointer',
          background: 'transparent', color: 'var(--ink-dim)',
          fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: busy && busy !== 'anon' ? .55 : 1,
          transition: 'opacity .15s ease',
        }}>
          {busy === 'anon' ? <Spinner size={16} /> : null}
          המשך ללא חשבון
        </button>

        <p style={{ margin: '28px 0 0', fontSize: 11.5, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
          הנתונים שלך פרטיים ומאוחסנים בחשבון שלך בלבד
        </p>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.27h2.9c1.7-1.57 2.7-3.88 2.7-6.63z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.27c-.8.54-1.83.87-3.06.87a5.4 5.4 0 0 1-5.05-3.71H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.95H.96a9 9 0 0 0 0 8.1l2.99-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.57-2.57A8.96 8.96 0 0 0 9 0 9 9 0 0 0 .96 4.95l2.99 2.34A5.4 5.4 0 0 1 9 3.58z" />
    </svg>
  );
}

export { LoginScreen };
