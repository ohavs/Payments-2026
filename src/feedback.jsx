// Toast + Confirm dialog + Full-screen loader — custom-styled, no native alert/confirm.
import React from 'react';
import { Icon } from './components.jsx';
import { CoinLogo } from './ui/icons.jsx';

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
      position: 'fixed', top: 'calc(16px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
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
    success: { icon: 'check', dot: '#22A45D' },
    error:   { icon: 'close', dot: '#E5484D' },
    info:    { icon: 'bell', dot: '#5C6BFF' },
  }[toast.type] || { icon: 'bell', dot: '#5C6BFF' };
  return (
    <div style={{
      pointerEvents: 'auto',
      background: '#141414',
      color: '#FAFAFA',
      borderRadius: 999, padding: '10px 18px 10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 12px 30px -10px rgba(0,0,0,.45)',
      fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(.96)',
      transition: 'opacity .25s ease, transform .45s cubic-bezier(.34,1.56,.64,1)',
      direction: 'rtl', textAlign: 'start',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 999,
        background: palette.dot,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#FFFFFF', flexShrink: 0,
      }}>
        <Icon name={palette.icon} size={15} strokeWidth={3} />
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
        position: 'absolute', inset: 0, background: 'rgba(15,15,17,.45)',
        opacity: show ? 1 : 0, transition: 'opacity .2s ease',
      }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 360,
        background: 'var(--surface-1)', color: 'var(--ink)',
        borderRadius: 28, padding: 22,
        boxShadow: '0 30px 80px -20px rgba(0,0,0,.45)',
        transform: show ? 'scale(1) translateY(0)' : 'scale(.92) translateY(8px)',
        opacity: show ? 1 : 0,
        transition: 'transform .35s cubic-bezier(.34,1.56,.64,1), opacity .2s ease',
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
            flex: 1, padding: '13px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'var(--surface-2)', color: 'var(--ink)',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
          }}>{dialog.cancelLabel || 'ביטול'}</button>
          <button onClick={() => onResolve(true)} style={{
            flex: 1, padding: '13px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: danger ? 'var(--danger)' : 'var(--accent)',
            color: danger ? '#FFF' : 'var(--accent-fg)',
            fontFamily: 'inherit', fontWeight: 800, fontSize: 15,
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
      <CoinLogo size={72} style={{ animation: 'coinPulse 1.4s ease-in-out infinite' }} />
      {label && <div style={{ fontSize: 14, color: 'var(--ink-dim)', fontWeight: 600 }}>{label}</div>}
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

export { FeedbackProvider, FullScreenLoader, Spinner, useConfirm, useToast };
