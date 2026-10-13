// Shared UI atoms for the payments app
import React, { useEffect, useRef, useState } from 'react';
import { pushBackHandler } from './lib/platform.js';

// Brand glyph for a service (logo bubble). Size in px.
function ServiceBubble({ service, size = 44, dark = false }) {
  if (!service) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: dark ? '#1a1a1a' : '#fff', color: dark ? '#fff' : '#111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
      }}>?</div>
    );
  }
  // image source: service.image (data URL or URL) — takes priority over glyph
  if (service.image) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '2px solid var(--stroke)',
        background: service.bg || '#222',
        backgroundImage: `url(${service.image})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: service.bg, color: service.fg,
      border: '2px solid var(--stroke)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.4, flexShrink: 0,
      lineHeight: 1, fontFamily: 'inherit',
    }}>{service.glyph}</div>
  );
}

// Generic icon, line style. name: home, calendar, settings, plus, bell, search, chevron, check, edit, trash, close, arrow-up-right, repeat, x, more
function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2 }) {
  const s = size;
  const c = color;
  const w = strokeWidth;
  const base = { width: s, height: s, fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return (<svg {...base} viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>);
    case 'calendar': return (<svg {...base} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>);
    case 'settings': return (<svg {...base} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
    case 'plus': return (<svg {...base} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>);
    case 'bell': return (<svg {...base} viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>);
    case 'search': return (<svg {...base} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>);
    case 'chevron-left': return (<svg {...base} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>);
    case 'chevron-right': return (<svg {...base} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>);
    case 'chevron-down': return (<svg {...base} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>);
    case 'check': return (<svg {...base} viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>);
    case 'edit': return (<svg {...base} viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>);
    case 'trash': return (<svg {...base} viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/></svg>);
    case 'close': return (<svg {...base} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>);
    case 'arrow-up-right': return (<svg {...base} viewBox="0 0 24 24"><path d="M7 17L17 7M7 7h10v10"/></svg>);
    case 'arrow-left': return (<svg {...base} viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>);
    case 'arrow-right': return (<svg {...base} viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>);
    case 'repeat': return (<svg {...base} viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>);
    case 'more': return (<svg style={{...base, fill: c, stroke: 'none'}} viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>);
    case 'card': return (<svg {...base} viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>);
    case 'user': return (<svg {...base} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>);
    case 'pin': return (<svg {...base} viewBox="0 0 24 24"><path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>);
    case 'shekel': return (<svg style={{...base, fill: c, stroke: 'none'}} viewBox="0 0 24 24"><text x="12" y="17" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="system-ui">₪</text></svg>);
    case 'sun': return (<svg {...base} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>);
    case 'moon': return (<svg {...base} viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>);
    case 'globe': return (<svg {...base} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>);
    case 'download': return (<svg {...base} viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>);
    case 'history': return (<svg {...base} viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>);
    default: return null;
  }
}

// Pill / chip
function Chip({ active, children, onClick, color, bg, style }) {
  return (
    <button onClick={onClick} className="chip" style={{
      padding: '9px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5,
      background: active ? (bg || 'var(--ink)') : 'var(--chip-bg)',
      color: active ? (color || 'var(--bg)') : 'var(--chip-fg)',
      whiteSpace: 'nowrap',
      transition: 'all .15s ease',
      ...style,
    }}>{children}</button>
  );
}

// Round icon button
function IconButton({ name, onClick, size = 40, iconSize = 20, bg = 'var(--surface-2)', color = 'var(--ink)', ariaLabel, style }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} className="iconbtn" style={{
      width: size, height: size, borderRadius: '50%', border: 'none',
      background: bg, color, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, transition: 'transform .15s ease, background .15s ease',
      ...style,
    }}>
      <Icon name={name} size={iconSize} />
    </button>
  );
}

// Bottom sheet — slides up from bottom, full overlay.
// Supports drag-down-to-close (swipe the sheet down past a threshold to dismiss)
// and contains overscroll so pulling it down never triggers the browser's
// pull-to-refresh on the page behind it.
function Sheet({ open, onClose, title, children, height = '88%' }) {
  // Defer applying the transition until after first paint, so the initial
  // render of `transform: translateY(100%)` settles before we animate to 0.
  const [animReady, setAnimReady] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Android back button closes the topmost open sheet. Registered once per
  // opening (not per render) so the stack keeps the order sheets opened in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => { if (open) return pushBackHandler(() => onCloseRef.current()); }, [open]);
  // Reset any drag offset whenever the sheet opens/closes; dismiss the keyboard
  // when the sheet closes (covers close via button / backdrop / drag).
  useEffect(() => {
    setDragY(0); setDragging(false);
    if (!open) {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) ae.blur();
    }
  }, [open]);

  // Native touch listeners (passive:false) so we can preventDefault the browser
  // pull-to-refresh while dragging the sheet down.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    let startY = 0, active = false, cur = 0, blurred = false;
    const ts = (e) => {
      if (!open || e.touches.length !== 1) return;
      active = true; startY = e.touches[0].clientY; cur = 0; blurred = false;
    };
    const tm = (e) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      const atTop = !scrollRef.current || scrollRef.current.scrollTop <= 0;
      if (dy > 0 && atTop) {
        // Dismiss the keyboard as soon as a downward drag begins, so pulling the
        // sheet down closes the keyboard too (not just the sheet).
        if (!blurred) {
          const ae = document.activeElement;
          if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) ae.blur();
          blurred = true;
        }
        cur = dy; setDragY(dy); setDragging(true);
        if (e.cancelable) e.preventDefault(); // block pull-to-refresh
      } else if (dy < -2) {
        active = false; setDragY(0); setDragging(false);
      }
    };
    const te = () => {
      if (!active) return;
      active = false; setDragging(false);
      if (cur > 110) onClose(); else setDragY(0);
    };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te, { passive: true });
    el.addEventListener('touchcancel', te, { passive: true });
    return () => {
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', te);
      el.removeEventListener('touchcancel', te);
    };
  }, [open, onClose]);

  const translate = open ? `translateY(${dragY}px)` : 'translateY(100%)';
  const panelTransition = dragging ? 'none' : (animReady ? 'transform .45s cubic-bezier(.22,1,.36,1)' : 'none');

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(15,15,17,.42)',
        opacity: open ? Math.max(0, 1 - dragY / 500) : 0,
        transition: dragging ? 'none' : (animReady ? 'opacity .3s ease' : 'none'),
      }} />
      <div ref={panelRef} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: height,
        background: 'var(--surface-1)',
        color: 'var(--ink)',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        transform: translate,
        transition: panelTransition,
        display: 'flex', flexDirection: 'column',
        // Closed sheets wait just below the screen; without this their shadow
        // bleeds up into view as a dark band behind the tab bar.
        boxShadow: open ? '0 -16px 40px rgba(0,0,0,.16)' : 'none',
        touchAction: 'pan-y',
      }}>
        {/* Sticky header: handle + title + close */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          background: 'var(--surface-1)',
          borderTopLeftRadius: 30, borderTopRightRadius: 30,
        }}>
          {/* Tappable drag handle that also closes */}
          <button onClick={onClose} aria-label="סגור" style={{
            width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
            <div style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--surface-3)' }} />
          </button>
          {title && (
            <div style={{
              padding: '4px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
              <button onClick={onClose} aria-label="סגור" className="press" style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'var(--surface-2)', color: 'var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="close" size={18} strokeWidth={2.4} />
              </button>
            </div>
          )}
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Toggle switch
function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={!!checked} onClick={() => onChange(!checked)} style={{
      width: 52, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer',
      background: checked ? 'var(--accent)' : 'var(--surface-3)',
      position: 'relative', transition: 'background .25s ease', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 3, insetInlineStart: checked ? 23 : 3,
        width: 26, height: 26, borderRadius: '50%', background: '#fff',
        transition: 'inset-inline-start .3s cubic-bezier(.34,1.56,.64,1)',
        boxShadow: '0 1px 4px rgba(0,0,0,.25)',
      }} />
    </button>
  );
}

// List row (settings-style)
// Settings-style row. A button only when tappable, so a Toggle on the right
// isn't a button nested in a button.
function Row({ icon, iconNode, tint, label, sub, right, onClick, danger }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={onClick ? 'row' : undefined} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 16px', background: 'transparent', border: 'none',
      cursor: onClick ? 'pointer' : 'default', textAlign: 'start',
      color: danger ? 'var(--danger)' : 'var(--ink)', fontFamily: 'inherit',
    }}>
      {(icon || iconNode) && (
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: tint || 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: danger ? 'var(--danger)' : 'var(--ink)', flexShrink: 0,
        }}>
          {iconNode || <Icon name={icon} size={19} />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-dim)' }}>
        {right}
      </div>
    </Tag>
  );
}

export { Chip, Icon, IconButton, Row, ServiceBubble, Sheet, Toggle };
