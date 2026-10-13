// Sticker-style icons: flat colour fills with an ink outline. Nav icons take an
// `active` flag and go grey when inactive. Category icons are picked from the
// category's name (categories are free text the user types).
import React from 'react';

const INK = '#141414';
const sw = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' };

function Svg({ size, children, style }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={style}>{children}</svg>;
}

// ---------- Navigation ----------
// a/b/c are fills when active; inactive renders muted greys.
export function NavIcon({ name, active, size = 28 }) {
  const on = (c) => (active ? c : 'var(--nav-off-fill, #E4E4E7)');
  const st = { ...sw, stroke: active ? INK : 'var(--nav-off-stroke, #A1A1AA)' };
  switch (name) {
    case 'expenses': return (
      <Svg size={size}>
        <path d="M3.6 10.6 12 3.6l8.4 7v8.8a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2Z" fill={on('#FFC93C')} {...st} />
        <path d="M9.6 20.6v-5.4h4.8v5.4" fill={on('#F25C54')} {...st} />
      </Svg>
    );
    case 'subs': return (
      <Svg size={size}>
        <rect x="3.4" y="5" width="17.2" height="15.6" rx="3" fill={active ? '#FFFFFF' : 'var(--nav-off-fill, #F4F4F5)'} {...st} />
        <path d="M3.4 8a3 3 0 0 1 3-3h11.2a3 3 0 0 1 3 3v2.2H3.4Z" fill={on('#F25C54')} {...st} />
        <path d="M8 3.2v3.6M16 3.2v3.6" {...st} />
        <circle cx="12" cy="15.2" r="2.3" fill={active ? '#4F46E5' : 'var(--nav-off-stroke, #A1A1AA)'} />
      </Svg>
    );
    case 'settings': return (
      <Svg size={size}>
        <path d="M19.25 10.53 L21.52 10.76 L21.52 13.24 L19.25 13.47 L18.17 16.09 L19.61 17.85 L17.85 19.61 L16.09 18.17 L13.47 19.25 L13.24 21.52 L10.76 21.52 L10.53 19.25 L7.91 18.17 L6.15 19.61 L4.39 17.85 L5.83 16.09 L4.75 13.47 L2.48 13.24 L2.48 10.76 L4.75 10.53 L5.83 7.91 L4.39 6.15 L6.15 4.39 L7.91 5.83 L10.53 4.75 L10.76 2.48 L13.24 2.48 L13.47 4.75 L16.09 5.83 L17.85 4.39 L19.61 6.15 L18.17 7.91 Z" fill={on('#4F46E5')} {...st} />
        <circle cx="12" cy="12" r="3.2" fill={active ? '#FFFFFF' : 'var(--nav-off-fill, #F4F4F5)'} {...st} />
      </Svg>
    );
    default: return null;
  }
}

// ---------- Category stickers ----------
const CATEGORY_ICONS = {
  cart: (
    <>
      <path d="M2.8 4.2h2.6l.9 3.8" fill="none" {...sw} />
      <path d="M6.3 8h14.2l-1.8 6.6a1.6 1.6 0 0 1-1.5 1.2H9.4a1.6 1.6 0 0 1-1.6-1.3Z" fill="#22A45D" {...sw} />
      <circle cx="9.8" cy="19.6" r="1.6" fill="#fff" {...sw} />
      <circle cx="16.8" cy="19.6" r="1.6" fill="#fff" {...sw} />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 4.6 5.8v5.6c0 4.6 3.1 8.2 7.4 9.8 4.3-1.6 7.4-5.2 7.4-9.8V5.8Z" fill="#4F46E5" {...sw} />
      <path d="m8.7 12.1 2.2 2.2 4.4-4.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  food: (
    <>
      <path d="M4.2 10.6a7.8 6 0 0 1 15.6 0Z" fill="#FF8A3D" {...sw} />
      <rect x="3.4" y="12.6" width="17.2" height="3.2" rx="1.6" fill="#7C3A1D" {...sw} />
      <path d="M4.6 17.8h14.8v.4a2.6 2.6 0 0 1-2.6 2.6H7.2a2.6 2.6 0 0 1-2.6-2.6Z" fill="#FF8A3D" {...sw} />
    </>
  ),
  box: (
    <>
      <path d="M4.4 9.4h15.2v9.4a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6Z" fill="#F2B705" {...sw} />
      <rect x="3" y="5.4" width="18" height="4" rx="1.3" fill="#FFE08A" {...sw} />
      <path d="M12 5.4v15" {...sw} />
    </>
  ),
  car: (
    <>
      <path d="M3.5 15.5v-3l2-4.6a2 2 0 0 1 1.8-1.2h9.4a2 2 0 0 1 1.8 1.2l2 4.6v3a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5Z" fill="#3B82F6" {...sw} />
      <path d="M6.5 11.5h11" {...sw} />
      <circle cx="7.5" cy="17.5" r="2" fill="#fff" {...sw} />
      <circle cx="16.5" cy="17.5" r="2" fill="#fff" {...sw} />
    </>
  ),
  house: (
    <>
      <path d="M3.6 10.6 12 3.6l8.4 7v8.8a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2Z" fill="#FFC93C" {...sw} />
      <path d="M9.6 20.6v-5.4h4.8v5.4" fill="#F25C54" {...sw} />
    </>
  ),
  bolt: (
    <path d="M13.6 2.6 4.8 13.4h6.1l-1.5 8 8.8-10.8h-6.1Z" fill="#FFC93C" {...sw} />
  ),
  heart: (
    <path d="M12 20.2s-7.6-4.6-7.6-10a4.3 4.3 0 0 1 7.6-2.8 4.3 4.3 0 0 1 7.6 2.8c0 5.4-7.6 10-7.6 10Z" fill="#F25C54" {...sw} />
  ),
  gift: (
    <>
      <rect x="3.6" y="9" width="16.8" height="11.4" rx="1.6" fill="#EC4899" {...sw} />
      <rect x="2.8" y="6.4" width="18.4" height="3.6" rx="1.2" fill="#F9A8D4" {...sw} />
      <path d="M12 6.4v14M12 6.4c-1.5-3.2-5.2-3.4-5.2-1.2 0 1.2 2.6 1.2 5.2 1.2Zm0 0c1.5-3.2 5.2-3.4 5.2-1.2 0 1.2-2.6 1.2-5.2 1.2Z" fill="none" {...sw} />
    </>
  ),
  plane: (
    <path d="M21 15.5v-1.8l-7.5-4.7V4.3a1.5 1.5 0 0 0-3 0V9L3 13.7v1.8l7.5-2.3v4.9l-2 1.5v1.4l3.5-1 3.5 1v-1.4l-2-1.5v-4.9Z" fill="#0EA5E9" {...sw} />
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12.4a1.6 1.6 0 0 1-1.6 1.4H7.6A1.6 1.6 0 0 1 6 20.4Z" fill="#A855F7" {...sw} />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" fill="none" {...sw} />
    </>
  ),
};

// Name → icon + tint. Order matters: first match wins.
const RULES = [
  [/קני|סופר|מכול|שוק|groc/i, 'cart', 'var(--mint)'],
  [/ביטוח/, 'shield', 'var(--lavender)'],
  [/אוכל|מסעד|קפה|בחוץ|פיצה|ארוח|food/i, 'food', 'var(--peach)'],
  [/דלק|רכב|תחבור|חני|מונית|car|fuel/i, 'car', 'var(--sky)'],
  [/חשבונ|חשמל|מים|גז|ארנונ|אינטרנט|bill/i, 'bolt', 'var(--lavender)'],
  [/בית|דיר|שכיר/, 'house', 'var(--butter)'],
  [/בריא|רופא|תרופ|פארם|health/i, 'heart', 'var(--danger-soft)'],
  [/מתנ|gift/i, 'gift', 'var(--danger-soft)'],
  [/טיס|חופש|נסיע|טיול|travel/i, 'plane', 'var(--sky)'],
  [/בגד|קניות אונליין|ביגוד|נעל|shop/i, 'bag', 'var(--lavender)'],
  [/שונ|אחר|כללי|misc/i, 'box', 'var(--butter)'],
];
const FALLBACK = [
  ['#22A45D', 'var(--mint)'], ['#4F46E5', 'var(--lavender)'], ['#FF8A3D', 'var(--peach)'],
  ['#3B82F6', 'var(--sky)'], ['#EC4899', 'var(--danger-soft)'], ['#F2B705', 'var(--butter)'],
];

// Chart/bar colour per icon, so a category looks the same everywhere.
const ICON_COLOR = { cart: '#22A45D', shield: '#4F46E5', food: '#FF8A3D', car: '#3B82F6', house: '#F2B705', bolt: '#EAB308', heart: '#F25C54', gift: '#EC4899', plane: '#0EA5E9', bag: '#A855F7', box: '#F2B705' };

export function categoryVisual(name = '') {
  for (const [re, icon, soft] of RULES) {
    if (re.test(name)) return { icon, soft, color: ICON_COLOR[icon] };
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [color, soft] = FALLBACK[h % FALLBACK.length];
  return { icon: null, soft, color, letter: (name.trim()[0] || '•') };
}

// Round tinted badge with the category's sticker (or its first letter).
export function CategoryBadge({ name, size = 44, selected = false }) {
  const v = categoryVisual(name);
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: v.soft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: selected ? '2.5px solid var(--ink)' : '2.5px solid transparent',
      transition: 'border-color .2s ease',
    }}>
      {v.icon ? (
        <Svg size={Math.round(size * 0.56)}>{CATEGORY_ICONS[v.icon]}</Svg>
      ) : (
        <span style={{
          width: size * 0.56, height: size * 0.56, borderRadius: '50%', background: v.color,
          border: `2px solid ${INK}`, color: '#fff', fontWeight: 800, fontSize: size * 0.28,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{v.letter}</span>
      )}
    </span>
  );
}

// Coin logo (login, loader).
export function CoinLogo({ size = 84, style }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={style}>
      <circle cx="50" cy="50" r="46" fill="#22A45D" stroke={INK} strokeWidth="6" />
      <text x="50" y="66" textAnchor="middle" fontSize="48" fontWeight="900" fill={INK}
        fontFamily="'Rubik Variable', Rubik, system-ui, sans-serif">₪</text>
    </svg>
  );
}
