// Quick add: the + button. Amount on a number pad, a category, optional name
// and date, save. Built so a typical expense takes a few taps.
import React from 'react';
import { Sheet } from './components.jsx';
import { fmtMoney } from './data.jsx';
import { useToast } from './feedback.jsx';
import { MiniCalendar, localISO, todayISO } from './lists.jsx';
import { CategoryBadge } from './ui/icons.jsx';
import { Keypad, Segmented, applyKey, formatTyped } from './ui/kit.jsx';
import { haptic } from './lib/platform.js';

function yesterdayISO() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return localISO(d);
}

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}.${m}${y !== new Date().getFullYear() ? `.${String(y).slice(2)}` : ''}`;
}

function QuickAddSheet({ open, onClose, categories, defaultCategory, recentTitles = [], canSave, onAdd, onAddSubscription }) {
  const toast = useToast();
  const [amount, setAmount] = React.useState('');
  const [bump, setBump] = React.useState(0);
  const [category, setCategory] = React.useState(categories[0]);
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setAmount(''); setBump(0); setTitle(''); setDate(todayISO()); setCalendarOpen(false);
    setCategory(defaultCategory && categories.includes(defaultCategory) ? defaultCategory : categories[0]);
  }, [open]);

  const press = (k) => { setAmount((a) => applyKey(a, k)); setBump((b) => b + 1); };
  const value = parseFloat(amount) || 0;
  const ready = value > 0 && canSave;

  const save = () => {
    if (!ready) return;
    const item = { title: title.trim() || category, amount: value, group: category, note: '', date };
    onAdd(item);
    toast(`נוספה הוצאה · ${fmtMoney(value)} · ${category}`, { type: 'success' });
    onClose();
  };

  // A physical keyboard (web, emulator) can type the amount too.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (/^[0-9]$/.test(e.key) || e.key === '.') press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const yesterday = yesterdayISO();
  const dateChoice = date === todayISO() ? 'today' : date === yesterday ? 'yesterday' : 'other';
  const dateChip = (id, label, onClick) => {
    const on = dateChoice === id;
    return (
      <button key={id} onClick={onClick} className="press" style={{
        height: 42, padding: '0 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
        border: on ? '2px solid var(--ink)' : '2px solid transparent',
        background: on ? 'var(--accent-soft)' : 'var(--surface-2)', color: 'var(--ink)',
        fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0,
      }}>{label}</button>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} height="93%">
      <div style={{ padding: '2px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100%' }}>
        <Segmented
          options={[{ id: 'expense', label: 'הוצאה' }, { id: 'sub', label: 'מנוי קבוע' }]}
          value="expense"
          onChange={(id) => { if (id === 'sub') onAddSubscription(); }}
        />

        {/* Amount */}
        <div key={bump % 2 ? 'a' : 'b'} className={bump ? (bump % 2 ? 'bump-a' : 'bump-b') : undefined} style={{
          display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 4, direction: 'ltr',
          color: amount ? 'var(--ink)' : 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums', padding: '4px 0',
        }} aria-live="polite">
          <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>₪</span>
          <span style={{ fontSize: 58, fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 1 }}>{formatTyped(amount)}</span>
        </div>

        {/* Category */}
        <div className="hide-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
          {categories.map((c) => {
            const on = c === category;
            return (
              <button key={c} onClick={() => { haptic('select'); setCategory(c); }} style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 4px', minWidth: 68, flexShrink: 0,
              }}>
                <CategoryBadge name={c} size={54} selected={on} />
                <span style={{ fontSize: 13, fontWeight: on ? 800 : 600, whiteSpace: 'nowrap', maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</span>
              </button>
            );
          })}
        </div>

        {/* Name + date */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>שם ההוצאה</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="על מה? (לא חובה)"
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              style={{
                width: '100%', height: 42, border: 'none', outline: 'none', borderRadius: 14,
                background: 'var(--surface-2)', color: 'var(--ink)', padding: '0 14px',
                fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
              }} />
          </label>
          {dateChip('today', 'היום', () => { setDate(todayISO()); setCalendarOpen(false); })}
          {dateChip('yesterday', 'אתמול', () => { setDate(yesterday); setCalendarOpen(false); })}
          {dateChip('other', dateChoice === 'other' ? shortDate(date) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-label="תאריך אחר" role="img" style={{ display: 'block' }}>
              <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          ), () => setCalendarOpen((v) => !v))}
        </div>
        {recentTitles.length > 0 && !calendarOpen && (
          <div className="hide-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '-6px -18px 0', padding: '0 18px' }}>
            {recentTitles.map((t) => (
              <button key={t} onClick={() => setTitle(t)} className="press" style={{
                border: 'none', borderRadius: 999, padding: '7px 12px', cursor: 'pointer', flexShrink: 0,
                background: title === t ? 'var(--ink)' : 'var(--surface-2)', color: title === t ? 'var(--bg)' : 'var(--ink)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}>{t}</button>
            ))}
          </div>
        )}
        {calendarOpen && (
          <MiniCalendar value={date} onPick={(iso) => { setDate(iso); setCalendarOpen(false); }} />
        )}

        <div style={{ flex: 1 }} />
        <Keypad onKey={press} />
        <button onClick={save} disabled={!ready} className="btn-primary" style={{
          height: 58, fontSize: 17, fontFamily: 'inherit', width: '100%',
        }}>
          {value > 0 ? `שמור · ₪${formatTyped(amount)}` : 'הקלד סכום'}
        </button>
      </div>
    </Sheet>
  );
}

export { QuickAddSheet };
