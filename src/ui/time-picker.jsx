// Time picker in the app's own style: two snapping wheels, hours on the
// left and minutes on the right (time reads left to right even in Hebrew),
// with a few one-tap presets. Replaces the browser's <input type="time">.
import React from 'react';
import { Sheet } from '../components.jsx';
import { haptic } from '../lib/platform.js';

const ITEM = 46;      // row height
const VISIBLE = 5;    // rows shown; the middle one is selected
const pad = (n) => String(n).padStart(2, '0');

function Wheel({ values, value, onChange, label }) {
  const ref = React.useRef(null);
  const index = Math.max(0, values.indexOf(value));
  const settle = React.useRef(null);
  const last = React.useRef(index);

  // Start on the current value (no animation), and follow outside changes.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM;
    last.current = index;
  }, [index]);

  const onScroll = () => {
    const el = ref.current;
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
    if (i !== last.current) { last.current = i; haptic('select'); }
    clearTimeout(settle.current);
    settle.current = setTimeout(() => { if (values[i] !== value) onChange(values[i]); }, 90);
  };

  return (
    <div role="listbox" aria-label={label} ref={ref} onScroll={onScroll} className="hide-scroll" style={{
      height: ITEM * VISIBLE, width: 92, overflowY: 'auto', scrollSnapType: 'y mandatory',
      overscrollBehavior: 'contain', position: 'relative', zIndex: 1,
      maskImage: 'linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)',
    }}>
      <div style={{ height: ITEM * Math.floor(VISIBLE / 2) }} />
      {values.map((v, i) => {
        const on = v === value;
        return (
          <button key={v} role="option" aria-selected={on} onClick={() => {
            ref.current.scrollTo({ top: i * ITEM, behavior: 'smooth' });
            onChange(v);
          }} style={{
            display: 'block', width: '100%', height: ITEM, border: 'none', background: 'transparent', cursor: 'pointer',
            scrollSnapAlign: 'center', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
            fontSize: on ? 34 : 24, fontWeight: on ? 800 : 600, letterSpacing: '-0.02em',
            color: on ? 'var(--ink)' : 'var(--ink-dim)', transition: 'font-size .15s ease, color .15s ease',
          }}>{pad(v)}</button>
        );
      })}
      <div style={{ height: ITEM * Math.floor(VISIBLE / 2) }} />
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PRESETS = ['08:00', '09:00', '12:00', '20:00'];

function parse(v) {
  const [h, m] = String(v || '09:00').split(':').map(Number);
  return { h: Math.min(23, Math.max(0, h || 0)), m: Math.min(55, Math.round((m || 0) / 5) * 5) };
}

function TimePickerSheet({ open, value, onClose, onSave, title = 'בחירת שעה' }) {
  const [t, setT] = React.useState(() => parse(value));
  React.useEffect(() => { if (open) setT(parse(value)); }, [open]);
  const current = `${pad(t.h)}:${pad(t.m)}`;

  return (
    <Sheet open={open} onClose={onClose} title={title} height="auto">
      <div style={{ padding: '4px 22px 22px' }}>
        <div dir="ltr" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {/* Selection band behind the middle row */}
          <div aria-hidden="true" style={{
            position: 'absolute', left: 0, right: 0, top: '50%', height: ITEM + 4, transform: 'translateY(-50%)',
            borderRadius: 18, background: 'var(--surface-2)',
          }} />
          <Wheel label="שעות" values={HOURS} value={t.h} onChange={(h) => setT((x) => ({ ...x, h }))} />
          <div aria-hidden="true" style={{ position: 'relative', zIndex: 1, fontSize: 32, fontWeight: 800, paddingBottom: 4 }}>:</div>
          <Wheel label="דקות" values={MINUTES} value={t.m} onChange={(m) => setT((x) => ({ ...x, m }))} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
          {PRESETS.map((p) => {
            const on = p === current;
            return (
              <button key={p} onClick={() => { haptic('select'); setT(parse(p)); }} className="press" style={{
                height: 38, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? 'var(--bg)' : 'var(--ink)',
                fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              }}>{p}</button>
            );
          })}
        </div>

        <button onClick={() => { haptic('success'); onSave(current); onClose(); }} className="btn-primary" style={{
          width: '100%', height: 56, marginTop: 20, fontFamily: 'inherit', fontSize: 16.5,
        }}>שמור · {current}</button>
      </div>
    </Sheet>
  );
}

export { TimePickerSheet };
