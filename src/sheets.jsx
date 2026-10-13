// Detail sheet, Add Service sheet, and Custom Service builder.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chip, Icon, IconButton, ServiceBubble, Sheet } from './components.jsx';
import { CATEGORIES, CURRENCIES, CYCLE_LABEL, MONTH_NAMES_LONG, SERVICE_CATALOG, dayOfMonthFromDate, dayOfWeekFromDate, fmtDateShort, fmtMoney, fmtRelative, isAutoPaid, lastDayOfMonth, monthFromDate, nextDateForDayOfMonth, nextDateForDayOfWeek, nextDateForMonthDay, nextDueISO, resolveService, statusDateISO, todayLocalISO } from './data.jsx';
import { Spinner, useConfirm, useToast } from './feedback.jsx';
import { occurrencesBetween } from './lib/recurrence.js';
import { Segmented } from './ui/kit.jsx';

// ---------- Edit field row ----------
function EditField({ label, value, onChange, type = 'text', placeholder, suffix }) {
  return (
    <label style={{ display: 'block', padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', fontSize: 17, fontWeight: 600, fontFamily: 'inherit',
            padding: 0, fontVariantNumeric: 'tabular-nums',
          }}
        />
        {suffix && <span style={{ color: 'var(--ink-dim)', fontSize: 15, fontWeight: 600 }}>{suffix}</span>}
      </div>
    </label>
  );
}

// ---------- Subscription form (add + detail) ----------
function FieldLabel({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-dim)', margin: '20px 2px 9px' }}>{children}</div>;
}

const CYCLE_TABS = ['monthly', 'yearly', 'weekly', 'daily'];
const WEEKDAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// Keep the same day when switching cycle, so the picker shows something sane.
function reanchor(cycle, anchorISO) {
  const anchor = anchorISO || todayLocalISO();
  const m = monthFromDate(anchor);
  const d = dayOfMonthFromDate(anchor);
  const w = dayOfWeekFromDate(anchor);
  return cycle === 'yearly' ? nextDateForMonthDay(m, d)
    : cycle === 'monthly' ? nextDateForDayOfMonth(d)
    : cycle === 'weekly' ? nextDateForDayOfWeek(w)
    : todayLocalISO();
}

// One scrolling row of chips; the selected one starts in view.
function ChipRow({ items, value, onPick, round }) {
  const ref = useRef(null);
  useEffect(() => {
    // Centre the selected chip by scrolling the row only (scrollIntoView would
    // also scroll the page while the sheet is still sliding in).
    const row = ref.current;
    const el = row?.querySelector('[data-on="1"]');
    if (!el) return;
    const r = row.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    row.scrollLeft += (e.left + e.width / 2) - (r.left + r.width / 2);
  }, []);
  return (
    <div ref={ref} className="hide-scroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', margin: '0 -22px', padding: '2px 22px' }}>
      {items.map(({ id, label }) => {
        const on = id === value;
        return (
          <button key={id} data-on={on ? '1' : '0'} onClick={() => onPick(id)} className="press" style={{
            flexShrink: 0, minWidth: round ? 44 : undefined, height: 44, padding: round ? 0 : '0 15px',
            borderRadius: round ? '50%' : 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? 'var(--bg)' : 'var(--ink)',
            fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', transition: 'background-color .15s ease',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function SubscriptionForm({ value, onChange }) {
  const { price, currency = '₪', cycle = 'monthly', nextDate, note } = value;
  const [priceText, setPriceText] = useState(price ? String(price) : '');
  // The price can also change from outside (a catalog default arriving).
  useEffect(() => {
    if ((parseFloat(priceText) || 0) !== (Number(price) || 0)) setPriceText(price ? String(price) : '');
  }, [price]);
  const setPrice = (raw) => {
    const t = raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/^(\d*\.\d{0,2}).*$/, '$1');
    setPriceText(t);
    onChange({ price: parseFloat(t) || 0 });
  };
  const month = nextDate ? monthFromDate(nextDate) : new Date().getMonth();
  const day = nextDate ? dayOfMonthFromDate(nextDate) : new Date().getDate();
  const weekday = nextDate ? dayOfWeekFromDate(nextDate) : new Date().getDay();
  const days = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, label: i + 1 }));
  const nextISO = nextDueISO({ cycle, nextDate });

  return (
    <div style={{ padding: '0 22px' }}>
      <div style={{ background: 'var(--surface-2)', borderRadius: 24, padding: '16px 18px 14px', textAlign: 'center' }}>
        <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: 30, fontWeight: 800 }}>{currency}</span>
          <input aria-label="סכום" inputMode="decimal" value={priceText} placeholder="0" onChange={(e) => setPrice(e.target.value)} style={{
            width: `${Math.max(1, priceText.length || 1) + 0.6}ch`, maxWidth: '100%', textAlign: 'left',
            background: 'transparent', border: 'none', outline: 'none', padding: 0, color: 'var(--ink)',
            fontFamily: 'inherit', fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
          {CURRENCIES.map((c) => (
            <Chip key={c} active={currency === c} onClick={() => onChange({ currency: c })} style={{ padding: '6px 13px' }}>{c}</Chip>
          ))}
        </div>
      </div>

      <FieldLabel>כל כמה זמן</FieldLabel>
      <Segmented options={CYCLE_TABS.map((c) => ({ id: c, label: CYCLE_LABEL[c] }))} value={cycle}
        onChange={(c) => onChange({ cycle: c, nextDate: reanchor(c, nextDate) })} />

      {cycle !== 'daily' && <FieldLabel>{cycle === 'weekly' ? 'באיזה יום' : cycle === 'yearly' ? 'מתי בשנה' : 'באיזה יום בחודש'}</FieldLabel>}
      {cycle === 'monthly' && (
        <ChipRow round items={days(31)} value={day} onPick={(d) => onChange({ nextDate: nextDateForDayOfMonth(d) })} />
      )}
      {cycle === 'weekly' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {WEEKDAYS_HE.map((lbl, i) => (
            <button key={i} onClick={() => onChange({ nextDate: nextDateForDayOfWeek(i) })} className="press" style={{
              flex: 1, height: 44, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: weekday === i ? 'var(--ink)' : 'var(--surface-2)', color: weekday === i ? 'var(--bg)' : 'var(--ink)',
              fontSize: 15, fontWeight: 800,
            }}>{lbl}</button>
          ))}
        </div>
      )}
      {cycle === 'yearly' && (
        <>
          <ChipRow items={MONTH_NAMES_LONG.map((m, i) => ({ id: i, label: m }))} value={month}
            onPick={(m) => onChange({ nextDate: nextDateForMonthDay(m, Math.min(day, lastDayOfMonth(2024, m))) })} />
          <div style={{ height: 8 }} />
          <ChipRow round items={days(lastDayOfMonth(2024, month))} value={day}
            onPick={(d) => onChange({ nextDate: nextDateForMonthDay(month, d) })} />
        </>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-dim)', margin: '12px 2px 0' }}>
        {cycle === 'daily' ? 'נגבה כל יום' : `החיוב הבא: ${fmtDateShort(nextISO)} · ${fmtRelative(nextISO)}`}
      </div>

      <FieldLabel>הערה</FieldLabel>
      <input value={note || ''} onChange={(e) => onChange({ note: e.target.value })} placeholder="לא חובה, למשל: חבילת משפחה" style={{
        width: '100%', height: 50, border: 'none', outline: 'none', borderRadius: 16, background: 'var(--surface-2)',
        color: 'var(--ink)', padding: '0 16px', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600,
      }} />
    </div>
  );
}

// =================================================================
// DetailSheet — edit existing payment. No more "mark as paid" button
// (paid status is auto-derived from date).
// =================================================================
function DetailSheet({ payment, open, onClose, onSave, onDelete, onEditCustom }) {
  const [draft, setDraft] = useState(payment);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  useEffect(() => { if (payment) setDraft(payment); }, [payment?.id, open]);

  const isDirty = React.useMemo(() => {
    if (!payment || !draft) return false;
    const keys = ['price', 'currency', 'cycle', 'nextDate', 'note'];
    return keys.some(k => (payment[k] ?? '') !== (draft[k] ?? ''));
  }, [payment, draft]);

  const handleClose = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: 'יש שינויים שלא נשמרו',
        message: 'אם תסגור עכשיו, השינויים יאבדו',
        confirmLabel: 'סגור בלי לשמור',
        cancelLabel: 'המשך עריכה',
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  // Warn before tab close / refresh while sheet is open & dirty
  useEffect(() => {
    if (!open || !isDirty) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, isDirty]);

  if (!draft) return <Sheet open={open} onClose={handleClose}><div /></Sheet>;

  const service = resolveService(draft);
  const isCustom = !!draft.customService;
  const paid = isAutoPaid(draft);
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const pastCharges = payment ? occurrencesBetween(payment, yearAgo, yesterday).reverse().slice(0, 6) : [];
  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    onClose();
  };
  const requestDelete = async () => {
    const ok = await confirm({
      title: 'מחיקת תשלום',
      message: `האם למחוק את "${service?.name || 'התשלום'}"? פעולה זו לא ניתנת לביטול.`,
      confirmLabel: 'מחק',
      danger: true,
    });
    if (ok) onDelete(draft.id);
  };

  return (
    <Sheet open={open} onClose={handleClose} title="פרטי תשלום" height="92%">
      <div style={{ padding: '0 22px 8px' }}>
        {/* Header card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: 16, borderRadius: 20, background: 'var(--surface-2)',
          marginBottom: 14,
        }}>
          <ServiceBubble service={service} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              {service?.name || 'תשלום'}
              {paid && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                  background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                }}>שולם אוטומטית</span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>
              {CYCLE_LABEL[draft.cycle]} · {fmtRelative(statusDateISO(draft))}
            </div>
          </div>
        </div>

        {/* Edit custom service button (only if custom) */}
        {isCustom && (
          <button onClick={() => onEditCustom(draft)} style={{
            width: '100%', padding: '12px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'var(--surface-2)', color: 'var(--ink)',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 14, marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="edit" size={16} />
            ערוך את השירות (שם, תמונה, צבע)
          </button>
        )}
      </div>

      <SubscriptionForm key={draft.id} value={draft} onChange={update} />

      {/* Delete */}
      <div style={{ padding: '16px 22px 0' }}>
        <button onClick={requestDelete} style={{
          width: '100%', padding: '12px 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'var(--danger)',
          fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name="trash" size={16} />
          מחק תשלום
        </button>
      </div>

      {/* Past charges, from the schedule */}
      {pastCharges.length > 0 && (
        <div style={{ padding: '14px 22px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-dim)', margin: '0 2px 9px' }}>חיובים אחרונים</div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 18, overflow: 'hidden' }}>
            {pastCharges.map((d, i) => (
              <div key={d.getTime()} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
                borderTop: i ? '1px solid var(--divider)' : 'none',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{d.getDate()} ב{MONTH_NAMES_LONG[d.getMonth()]} {d.getFullYear()}</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(payment.price, payment.currency)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save bar */}
      <div style={{
        position: 'sticky', bottom: 0, background: 'var(--surface-1)',
        padding: '14px 22px 22px',
        borderTop: '1px solid var(--divider)',
        marginTop: 12,
      }}>
        <button onClick={save} disabled={saving || !isDirty} className="btn-primary" style={{
          width: '100%', height: 56, fontFamily: 'inherit', fontSize: 16.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {saving && <Spinner size={16} color="var(--ink-dim)" />}
          {saving ? 'שומר...' : isDirty ? 'שמור שינויים' : 'אין שינויים'}
        </button>
      </div>
    </Sheet>
  );
}

// =================================================================
// CustomServiceBuilder — name, image upload, color picker, glyph, category
// Used standalone (creating from scratch) and as the "ערוך שירות" flow.
// =================================================================
const SERVICE_PALETTE = [
  '#E50914', '#1DB954', '#10A37F', '#5E6AD2', '#FA0F00',
  '#7E57C2', '#F5A623', '#22C55E', '#0EA5E9', '#EC4899',
  '#000000', '#FFD400',
];

function CustomServiceBuilder({ initial, onCancel, onSave, title = 'שירות מותאם אישית' }) {
  const [name, setName] = useState(initial?.name || '');
  const [cat, setCat] = useState(initial?.cat || 'other');
  const [bg, setBg] = useState(initial?.bg || '#5E6AD2');
  const [glyph, setGlyph] = useState(initial?.glyph || '');
  const [image, setImage] = useState(initial?.image || null);
  const fileRef = useRef(null);
  const toast = useToast();

  const fg = useMemo(() => {
    // Pick contrasting fg based on bg luminance
    const c = bg.replace('#', '');
    const r = parseInt(c.slice(0,2), 16), g = parseInt(c.slice(2,4), 16), b = parseInt(c.slice(4,6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#000000' : '#FFFFFF';
  }, [bg]);

  const preview = {
    id: initial?.id || ('custom_' + Date.now()),
    name: name || 'שם השירות',
    cat, bg, fg, glyph: glyph || (name[0] || '?'),
    image,
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(f);
  };

  const save = () => {
    if (!name.trim()) { toast('יש להזין שם לשירות', { type: 'error' }); return; }
    onSave({
      id: initial?.id || ('custom_' + Date.now()),
      name: name.trim(),
      cat, bg, fg, glyph: glyph || name.trim()[0],
      image,
      price: 0, cycle: 'monthly',
    });
  };

  return (
    <>
      <div style={{ padding: '0 22px 8px' }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-dim)',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', marginBottom: 4,
        }}>
          <Icon name="arrow-right" size={14} /> חזור
        </button>

        {/* Live preview */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: 16, borderRadius: 20, background: 'var(--surface-2)',
          marginBottom: 14,
        }}>
          <ServiceBubble service={preview} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>{preview.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>
              {CATEGORIES.find(c => c.id === cat)?.name}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={{ background: 'var(--surface-2)', borderRadius: 20, margin: '0 22px' }}>
        <EditField label="שם השירות" value={name} onChange={setName} placeholder="לדוגמה: ביטוח חיות מחמד" />

        {/* Image upload */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', marginBottom: 10 }}>תמונה / לוגו</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: image ? `url(${image}) center/cover` : bg,
              color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 22, flexShrink: 0,
              border: '1px solid var(--divider)',
            }}>
              {!image && (glyph || (name[0] || '?'))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--surface-3)', color: 'var(--ink)', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 13,
              }}>{image ? 'החלף תמונה' : 'העלה תמונה'}</button>
              {image && (
                <button onClick={() => setImage(null)} style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'var(--ink-dim)', fontFamily: 'inherit',
                  fontWeight: 600, fontSize: 12,
                }}>הסר תמונה</button>
              )}
            </div>
          </div>
        </div>

        {/* Glyph (if no image) */}
        {!image && (
          <EditField label="אות / סמל (אם אין תמונה)" value={glyph} onChange={setGlyph} placeholder="א, N, ⚡, 🚗..." />
        )}

        {/* Color swatches */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', marginBottom: 10 }}>צבע רקע</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SERVICE_PALETTE.map(c => (
              <button key={c} onClick={() => setBg(c)} aria-label={c} style={{
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                background: c, border: 'none',
                outline: bg === c ? '2px solid var(--ink)' : '2px solid transparent',
                outlineOffset: 2,
              }} />
            ))}
            <label style={{
              width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
              background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <input type="color" value={bg} onChange={e => setBg(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            </label>
          </div>
        </div>

        {/* Category */}
        <div style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-dim)', marginBottom: 10 }}>קטגוריה</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 24 }} />

      <div style={{
        position: 'sticky', bottom: 0, background: 'var(--surface-1)',
        padding: '14px 22px 22px',
        borderTop: '1px solid var(--divider)',
      }}>
        <button onClick={save} className="btn-primary" style={{
          width: '100%', height: 56, fontFamily: 'inherit', fontSize: 16.5,
        }}>המשך</button>
      </div>
    </>
  );
}

// =================================================================
// AddSheet — pick from catalog or build a custom service, then set price/cycle/date.
// =================================================================
// Step states: 'pick' | 'custom' | 'configure'
function AddSheet({ open, onClose, onAdd }) {
  const [step, setStep] = useState('pick');
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [picked, setPicked] = useState(null);   // service object (catalog entry OR custom)
  const [customDraft, setCustomDraft] = useState(null); // the in-progress custom service
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  // configure-step fields
  const [price, setPrice] = useState(0);
  const [cycle, setCycle] = useState('monthly');
  const [currency, setCurrency] = useState('₪');
  const [nextDate, setNextDate] = useState('');
  const [note, setNote] = useState('');

  // Warn if user tries to close with a service picked and step !== 'pick'
  const handleClose = async () => {
    if (step === 'configure' || step === 'custom') {
      const ok = await confirm({
        title: 'יציאה ללא שמירה',
        message: 'התשלום לא נוסף עדיין. האם להמשיך?',
        confirmLabel: 'יציאה',
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setStep('pick'); setQuery(''); setActiveCat('all'); setPicked(null); setCustomDraft(null);
      setNote('');
    }
  }, [open]);

  useEffect(() => {
    if (picked) {
      setPrice(picked.price || 0);
      const c = picked.cycle || 'monthly';
      setCycle(c);
      setCurrency('₪');
      // Default to a sensible next occurrence based on the cycle
      const today = new Date();
      setNextDate(
        c === 'yearly'  ? nextDateForMonthDay(today.getMonth(), today.getDate()) :
        c === 'monthly' ? nextDateForDayOfMonth(today.getDate()) :
        c === 'weekly'  ? nextDateForDayOfWeek(today.getDay()) :
        todayLocalISO()
      );
    }
  }, [picked?.id]);

  const filtered = useMemo(() => {
    return SERVICE_CATALOG.filter(s => {
      const matchCat = activeCat === 'all' || s.cat === activeCat;
      const matchQ = !query || s.name.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQ;
    });
  }, [query, activeCat]);

  const submit = async () => {
    if (!picked || saving) return;
    setSaving(true);
    const isCustom = picked.id.startsWith('custom_');
    await onAdd({
      id: 'p' + Date.now(),
      serviceId: isCustom ? null : picked.id,
      customService: isCustom ? picked : null,
      price, currency, cycle, nextDate, note,
    });
    setSaving(false);
    onClose();
  };

  // ---------- STEP: configure ----------
  if (step === 'configure' && picked) {
    return (
      <Sheet open={open} onClose={handleClose} title="הוספת תשלום" height="92%">
        <div style={{ padding: '0 22px 8px' }}>
          <button onClick={() => { setStep('pick'); setPicked(null); }} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-dim)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', marginBottom: 4,
          }}>
            <Icon name="arrow-right" size={14} /> חזור לרשימה
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: 16, borderRadius: 20, background: 'var(--surface-2)',
            marginBottom: 18,
          }}>
            <ServiceBubble service={picked} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>{picked.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2 }}>
                {CATEGORIES.find(c => c.id === picked.cat)?.name}
              </div>
            </div>
            {picked.id.startsWith('custom_') && (
              <IconButton name="edit" size={36} iconSize={16} onClick={() => { setCustomDraft(picked); setStep('custom'); }} />
            )}
          </div>
        </div>

        <SubscriptionForm key={picked.id} value={{ price, currency, cycle, nextDate, note }} onChange={(p) => {
          if ('price' in p) setPrice(p.price);
          if ('currency' in p) setCurrency(p.currency);
          if ('cycle' in p) setCycle(p.cycle);
          if ('nextDate' in p) setNextDate(p.nextDate);
          if ('note' in p) setNote(p.note);
        }} />

        <div style={{ height: 24 }} />

        <div style={{
          position: 'sticky', bottom: 0, background: 'var(--surface-1)',
          padding: '14px 22px 22px',
          borderTop: '1px solid var(--divider)',
        }}>
          <button onClick={submit} disabled={saving} className="btn-primary" style={{
            width: '100%', height: 56, fontFamily: 'inherit', fontSize: 16.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            {saving && <Spinner size={16} color="var(--ink-dim)" />}
            {saving ? 'מוסיף...' : 'הוסף תשלום'}
          </button>
        </div>
      </Sheet>
    );
  }

  // ---------- STEP: custom service builder ----------
  if (step === 'custom') {
    return (
      <Sheet open={open} onClose={handleClose} title="שירות מותאם אישית" height="92%">
        <CustomServiceBuilder
          initial={customDraft || (query ? { name: query } : null)}
          onCancel={() => { setStep('pick'); setCustomDraft(null); }}
          onSave={(svc) => { setPicked(svc); setCustomDraft(svc); setStep('configure'); }}
        />
      </Sheet>
    );
  }

  // ---------- STEP: pick from catalog ----------
  return (
    <Sheet open={open} onClose={handleClose} title="הוסף שירות" height="92%">
      <div style={{ padding: '0 22px 14px' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'var(--surface-2)', borderRadius: 14, marginBottom: 12,
        }}>
          <Icon name="search" size={18} color="var(--ink-dim)" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="חפש שירות (Netflix, פרטנר...)"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: 15, fontFamily: 'inherit', fontWeight: 500,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-dim)',
              display: 'flex', alignItems: 'center', padding: 0,
            }}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginInline: -22, paddingInline: 22 }} className="hide-scroll">
          <Chip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>הכל</Chip>
          {CATEGORIES.map(c => (
            <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>{c.name}</Chip>
          ))}
        </div>
      </div>

      {/* Add custom — always visible up top */}
      <div style={{ padding: '0 22px 14px' }}>
        <button onClick={() => { setCustomDraft(null); setStep('custom'); }} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 16, border: '1.5px dashed var(--divider)',
          background: 'transparent', color: 'var(--ink)', fontFamily: 'inherit',
          textAlign: 'start', cursor: 'pointer',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)',
            color: 'var(--accent-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="plus" size={18} strokeWidth={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>הוסף שירות מותאם אישית</div>
            <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 2 }}>
              שם, תמונה, צבע, קטגוריה — הכל ניתן לעריכה
            </div>
          </div>
          <Icon name="chevron-left" size={18} color="var(--ink-dim)" />
        </button>
      </div>

      {/* Service grid */}
      <div style={{ padding: '0 22px 22px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--ink-dim)', background: 'var(--surface-2)', borderRadius: 16 }}>
            <div style={{ fontSize: 14, marginBottom: 6 }}>לא נמצא שירות "{query}"</div>
            <div style={{ fontSize: 12, opacity: .8 }}>נסה להוסיף שירות מותאם אישית מלמעלה</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {filtered.map(s => (
              <button key={s.id} onClick={() => { setPicked(s); setStep('configure'); }} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 12, borderRadius: 16, border: 'none', cursor: 'pointer',
                background: 'var(--surface-2)', color: 'var(--ink)',
                fontFamily: 'inherit', textAlign: 'start',
                transition: 'transform .12s ease',
              }} className="service-tile">
                <ServiceBubble service={s} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 2, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    ~{fmtMoney(s.price)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// =================================================================
// EditCustomSheet — wraps CustomServiceBuilder for the "edit existing custom service" flow
// =================================================================
function EditCustomSheet({ payment, open, onClose, onSave }) {
  if (!payment?.customService) return null;
  return (
    <Sheet open={open} onClose={onClose} title="עריכת שירות" height="92%">
      <CustomServiceBuilder
        initial={payment.customService}
        onCancel={onClose}
        onSave={(svc) => { onSave({ ...payment, customService: svc }); onClose(); }}
      />
    </Sheet>
  );
}

export { AddSheet, CustomServiceBuilder, DetailSheet, EditCustomSheet, EditField };
