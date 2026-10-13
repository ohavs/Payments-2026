// Small building blocks of the design system.
import React from 'react';
import { haptic } from '../lib/platform.js';

// Animates a number towards `value` (ease-out), e.g. totals after adding an
// expense or switching month. Starts from 0 on first render.
export function useCountUp(value, duration = 650) {
  const [shown, setShown] = React.useState(0);
  const fromRef = React.useRef(0);
  const shownRef = React.useRef(0);
  React.useEffect(() => {
    const from = shownRef.current;
    const to = Number(value) || 0;
    if (from === to) return;
    fromRef.current = from;
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const v = from + (to - from) * (1 - Math.pow(1 - p, 4));
      shownRef.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

const fmt = (v, decimals) => v.toLocaleString('he-IL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Big money figure: small currency sign, large digits, laid out LTR so the
// sign sits left of the number in an RTL page.
export function Money({ value, size = 56, currency = '₪', animate = true, decimals, color, style }) {
  const counted = useCountUp(value);
  const v = animate ? counted : value;
  const d = decimals ?? (Math.abs((Number(value) || 0) % 1) > 0.001 ? 2 : 0);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: size * 0.06, direction: 'ltr',
      fontVariantNumeric: 'tabular-nums', color, ...style,
    }}>
      <span style={{ fontSize: size * 0.52, fontWeight: 800, lineHeight: 1 }}>{currency}</span>
      <span style={{ fontSize: size, fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 1 }}>{fmt(v, d)}</span>
    </span>
  );
}

const TONES = {
  neutral: ['var(--surface-2)', 'var(--ink)'],
  green: ['var(--accent-soft)', 'var(--accent-ink)'],
  red: ['var(--danger-soft)', 'var(--danger)'],
  sky: ['var(--sky)', 'var(--ink)'],
  peach: ['var(--peach)', 'var(--ink)'],
  lavender: ['var(--lavender)', 'var(--ink)'],
};

export function Pill({ tone = 'neutral', children, style, onClick }) {
  const [bg, fg] = TONES[tone] || TONES.neutral;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag onClick={onClick} className={onClick ? 'press' : undefined} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999,
      background: bg, color: fg, fontSize: 13, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap',
      border: 'none', cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
      ...style,
    }}>{children}</Tag>
  );
}

export function Card({ children, style, className }) {
  return (
    <div className={className} style={{
      background: 'var(--surface-1)', borderRadius: 26, boxShadow: 'var(--shadow-card)', ...style,
    }}>{children}</div>
  );
}

export function SectionTitle({ title, action, onAction, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 2px 10px', ...style }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
      {action && (
        <button onClick={onAction} style={{
          border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 2px',
          color: 'var(--accent-ink)', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
        }}>{action}</button>
      )}
    </div>
  );
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', padding: 4, borderRadius: 16, background: 'var(--surface-2)', ...style }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} onClick={() => { if (!on) { haptic('select'); onChange(o.id); } }} style={{
            flex: 1, height: 40, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            background: on ? 'var(--surface-1)' : 'transparent',
            boxShadow: on ? '0 2px 8px rgba(20,20,20,.08)' : 'none',
            color: on ? 'var(--ink)' : 'var(--ink-dim)', fontWeight: 800, fontSize: 14.5,
            transition: 'background-color .25s ease, box-shadow .25s ease, color .25s ease',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function RoundButton({ onClick, label, children, disabled }) {
  return (
    <button onClick={onClick} aria-label={label} disabled={disabled} className="press" style={{
      width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: disabled ? 'default' : 'pointer',
      background: 'var(--surface-1)', boxShadow: 'var(--shadow-card)', color: 'var(--ink)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1,
    }}>{children}</button>
  );
}

const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d={dir === 'right' ? 'm9.5 6 6 6-6 6' : 'm14.5 6-6 6 6 6'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// RTL: "previous" points right and sits on the right.
export function MonthSwitcher({ label, onPrev, onNext, nextDisabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <RoundButton onClick={() => { haptic('select'); onPrev(); }} label="חודש קודם"><Chevron dir="right" /></RoundButton>
      <div style={{ minWidth: 112, textAlign: 'center', fontSize: 16, fontWeight: 700 }}>{label}</div>
      <RoundButton onClick={() => { haptic('select'); onNext(); }} label="חודש הבא" disabled={nextDisabled}><Chevron dir="left" /></RoundButton>
    </div>
  );
}

export function ProgressBar({ pct, color = 'var(--accent)', height = 12, style }) {
  return (
    <div style={{ height, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative', ...style }}>
      <div style={{
        position: 'absolute', insetBlock: 0, insetInlineStart: 0, borderRadius: 999, background: color,
        width: `${Math.max(0, Math.min(100, pct))}%`, transition: 'width .7s var(--ease-out), background-color .3s ease',
      }} />
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

// Number pad laid out like a phone keypad (LTR), so typing an amount never
// opens the system keyboard.
export function Keypad({ onKey }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, direction: 'ltr' }}>
      {KEYS.map((k) => (
        <button key={k} onClick={() => { haptic('select'); onKey(k); }} aria-label={k === 'back' ? 'מחיקה' : k}
          className="press" style={{
            height: 54, border: 'none', borderRadius: 18, background: 'var(--surface-2)', color: 'var(--ink)',
            fontFamily: 'inherit', fontSize: 25, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {k === 'back' ? (
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M9 5.5h10.5a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9L3.5 12Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="m11.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : k}
        </button>
      ))}
    </div>
  );
}

// Applies a keypad key to an amount string: max 2 decimals, 7 digits.
export function applyKey(amount, k) {
  if (k === 'back') return amount.slice(0, -1);
  if (k === '.') return amount.includes('.') ? amount : (amount || '0') + '.';
  if (amount.includes('.') && amount.split('.')[1].length >= 2) return amount;
  if (amount.replace('.', '').length >= 7) return amount;
  return (amount === '0' ? '' : amount) + k;
}

export function formatTyped(amount) {
  if (!amount) return '0';
  const [i, d] = amount.split('.');
  const intPart = Number(i || '0').toLocaleString('he-IL');
  return d !== undefined ? `${intPart}.${d}` : intPart;
}

export function EmptyState({ title, text, action, onAction, children }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 20px 30px' }}>
      {children}
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 12 }}>{title}</div>
      {text && <div style={{ fontSize: 14, color: 'var(--ink-dim)', marginTop: 6, lineHeight: 1.5 }}>{text}</div>}
      {action && (
        <button onClick={onAction} className="btn-primary" style={{ marginTop: 18, padding: '12px 22px', fontSize: 15, fontFamily: 'inherit' }}>
          {action}
        </button>
      )}
    </div>
  );
}
