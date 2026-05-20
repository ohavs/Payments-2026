// Toast + Confirm dialog + Full-screen loader — custom-styled, no native alert/confirm.

const ToastContext = React.createContext({ show: () => {} });
const ConfirmContext = React.createContext({ confirm: () => Promise.resolve(false) });

function useToast() { return React.useContext(ToastContext).show; }
function useConfirm() { return React.useContext(ConfirmContext).confirm; }

function FeedbackProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const [dialog, setDialog] = React.useState(null);

  const show = React.useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, msg, type: opts.type || 'info', duration: opts.duration ?? 2800 };
    setToasts(t => [...t, toast]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), toast.duration);
  }, []);

  const confirm = React.useCallback((opts) => {
    return new Promise(resolve => setDialog({ ...opts, resolve }));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <ConfirmContext.Provider value={{ confirm }}>
        {children}
        <ToastViewport toasts={toasts} />
        {dialog && <ConfirmDialog dialog={dialog} onResolve={(v) => { dialog.resolve(v); setDialog(null); }} />}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts }) {
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
      width: 'calc(100% - 32px)', maxWidth: 380, pointerEvents: 'none',
    }}>
      {toasts.map(t => <Toast key={t.id} toast={t} />)}
    </div>
  );
}

function Toast({ toast }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const palette = {
    success: { bg: '#0F2E1A', border: 'rgba(34,197,94,.35)', icon: 'check', iconColor: '#22C55E' },
    error:   { bg: '#2E0F12', border: 'rgba(255,92,92,.35)', icon: 'close', iconColor: '#FF5C5C' },
    info:    { bg: 'rgba(20,20,20,.92)', border: 'rgba(255,255,255,.08)', icon: 'bell', iconColor: 'var(--accent)' },
  }[toast.type] || {};
  return (
    <div style={{
      pointerEvents: 'auto',
      background: palette.bg,
      color: '#FAFAFA',
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: `1px solid ${palette.border}`,
      boxShadow: '0 10px 30px -10px rgba(0,0,0,.5)',
      fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' : 'translateY(-12px)',
      transition: 'opacity .25s ease, transform .25s cubic-bezier(.22,.61,.36,1)',
      direction: 'rtl', textAlign: 'start',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 999,
        background: 'rgba(255,255,255,.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: palette.iconColor, flexShrink: 0,
      }}>
        <Icon name={palette.icon} size={16} strokeWidth={2.4} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{toast.msg}</div>
    </div>
  );
}

function ConfirmDialog({ dialog, onResolve }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    const onKey = (e) => {
      if (e.key === 'Escape') onResolve(false);
      if (e.key === 'Enter') onResolve(true);
    };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey); };
  }, []);

  const danger = dialog.danger;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, direction: 'rtl',
    }}>
      <div onClick={() => onResolve(false)} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)',
        opacity: show ? 1 : 0, transition: 'opacity .2s ease',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 360,
        background: 'var(--surface-1)', color: 'var(--ink)',
        borderRadius: 24, padding: 22,
        boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)',
        border: '1px solid var(--divider)',
        transform: show ? 'scale(1) translateY(0)' : 'scale(.94) translateY(8px)',
        opacity: show ? 1 : 0,
        transition: 'transform .22s cubic-bezier(.22,.61,.36,1), opacity .22s ease',
      }}>
        {dialog.title && (
          <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {dialog.title}
          </h3>
        )}
        {dialog.message && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-dim)', lineHeight: 1.45 }}>
            {dialog.message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => onResolve(false)} style={{
            flex: 1, padding: '12px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'var(--surface-2)', color: 'var(--ink)',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          }}>{dialog.cancelLabel || 'ביטול'}</button>
          <button onClick={() => onResolve(true)} style={{
            flex: 1, padding: '12px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: danger ? '#FF5C5C' : 'var(--accent)',
            color: danger ? '#FFF' : 'var(--accent-fg)',
            fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
          }}>{dialog.confirmLabel || 'אישור'}</button>
        </div>
      </div>
    </div>
  );
}

function FullScreenLoader({ label }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', color: 'var(--ink)', gap: 18, zIndex: 1000,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '3px solid var(--divider)',
        borderTopColor: 'var(--accent)',
        animation: 'spin .9s linear infinite',
      }} />
      {label && <div style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 500 }}>{label}</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Spinner({ size = 16, color = 'currentColor' }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(255,255,255,.18)`,
      borderTopColor: color,
      display: 'inline-block',
      animation: 'spin .8s linear infinite',
    }} />
  );
}

Object.assign(window, { FeedbackProvider, useToast, useConfirm, FullScreenLoader, Spinner });
