// The app's looks ("palettes"): each has its own accent colour, a texture
// behind the screens (styles.css) and a launcher icon. The icons are SVG on
// the adaptive icon canvas (108×108, launchers show the middle 72): a
// background layer (colour + texture) and the ₪ sticker on top. Settings
// shows them; scripts/make_icons.mjs renders the Android and web icons from
// the same markup.

export const PALETTES = [
  { id: 'green', name: 'קלאסי', swatch: '#22A45D' },
  { id: 'violet', name: 'לילך', swatch: '#8467FF' },
  { id: 'coral', name: 'שקיעה', swatch: '#FF7A45' },
  { id: 'ocean', name: 'ים', swatch: '#3D8BFF' },
  { id: 'honey', name: 'דבש', swatch: '#F5B800' },
];
export const DEFAULT_PALETTE = 'green';
export const validPalette = (id) => (PALETTES.some((p) => p.id === id) ? id : DEFAULT_PALETTE);
export const paletteAccent = (id) => PALETTES.find((p) => p.id === validPalette(id)).swatch;

const INK = '#141414';
// ₪ from Rubik ExtraBold (font units, y up; bounds 57,0 – 979,571).
const SHEKEL = 'M324 0Q314 0 306 7.5Q298 15 298 26V345Q298 355 306 363Q314 371 324 371H465Q476 371 483.5 363Q491 355 491 345V153H691Q740 153 763.5 178Q787 203 787 250V546Q787 557 794.5 564Q802 571 813 571H953Q964 571 971.5 563.5Q979 556 979 545V252Q979 158 947 102.5Q915 47 852 23.5Q789 0 696 0ZM83 0Q72 0 64.5 7.5Q57 15 57 26V545Q57 556 64.5 563.5Q72 571 83 571H454Q547 571 610 547.5Q673 524 705.5 468.5Q738 413 738 319V227Q738 216 730 208.5Q722 201 711 201H571Q560 201 552.5 208Q545 215 545 226V321Q545 369 521.5 393.5Q498 418 449 418H249V26Q249 15 241.5 7.5Q234 0 223 0Z';
const r2 = (v) => Math.round(v * 100) / 100;

/** ₪ centred on (cx, cy), h tall. */
export function shekel(cx, cy, h, fill = INK) {
  const k = h / 571;
  return `<path fill="${fill}" transform="translate(${r2(cx - 518 * k)} ${r2(cy + 285.5 * k)}) scale(${r2(k)} ${r2(-k)})" d="${SHEKEL}"/>`;
}

// The sticker look of the app's buttons: ink outline over a hard ink shadow.
function sticker(shape, fill) {
  return `<g transform="translate(0 3)">${shape(INK)}</g>${shape(fill)}`;
}

const CX = 54, CY = 52;   // the sticker's centre, a little above the middle for its shadow

function rays(color, count, opacity) {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a0 = (i * 2 * Math.PI) / count, a1 = a0 + Math.PI / count;
    d += `M${CX} ${CY}L${r2(CX + 90 * Math.cos(a0))} ${r2(CY + 90 * Math.sin(a0))}L${r2(CX + 90 * Math.cos(a1))} ${r2(CY + 90 * Math.sin(a1))}Z`;
  }
  return `<path d="${d}" fill="${color}" fill-opacity="${opacity}"/>`;
}

function dots(color, step, r, opacity) {
  let d = '';
  for (let row = 0, y = step / 2; y < 108; row++, y += step) {
    for (let x = (row % 2) * (step / 2); x < 108 + step; x += step) {
      d += `M${r2(x - r)} ${r2(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
  }
  return `<path d="${d}" fill="${color}" fill-opacity="${opacity}"/>`;
}

function waves(color, gap, amp, opacity, width) {
  let d = '';
  for (let y = gap / 2; y < 108 + gap; y += gap) {
    d += `M-6 ${y}`;
    for (let x = -6; x < 114; x += 12) d += `q3 ${-amp} 6 0t6 0`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round"/>`;
}

function hexagon(cx, cy, s) {
  const w = (Math.sqrt(3) * s) / 2;
  return `M${r2(cx)} ${r2(cy - s)}L${r2(cx + w)} ${r2(cy - s / 2)}L${r2(cx + w)} ${r2(cy + s / 2)}L${r2(cx)} ${r2(cy + s)}L${r2(cx - w)} ${r2(cy + s / 2)}L${r2(cx - w)} ${r2(cy - s / 2)}Z`;
}

function honeycomb(color, s, opacity, width) {
  const w = Math.sqrt(3) * s;
  let d = '';
  for (let row = -1; row * 1.5 * s < 108 + s; row++) {
    for (let cx = -w + (row & 1 ? w / 2 : 0); cx < 108 + w; cx += w) d += hexagon(cx, row * 1.5 * s, s);
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linejoin="round"/>`;
}

const coin = (fill) => `<circle cx="${CX}" cy="${CY}" r="21" fill="${fill}" stroke="${INK}" stroke-width="3.2"/>`;

const ICONS = {
  // Classic: the green, sun rays and a cream coin.
  green: {
    bg: () => `<rect width="108" height="108" fill="#22A45D"/>${rays('#FFFFFF', 18, 0.11)}`,
    fg: () => sticker(coin, '#FFFBEA')
      + `<circle cx="${CX}" cy="${CY}" r="16" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="1.5"/>`
      + shekel(CX, CY, 15.5),
  },
  // Lilac: violet with a dot grid, a tilted square sticker.
  violet: {
    bg: () => `<rect width="108" height="108" fill="#7B5CF6"/>${dots('#FFFFFF', 9, 1.5, 0.22)}`,
    fg: () => {
      const sq = (fill) => `<rect x="${CX - 18.5}" y="${CY - 18.5}" width="37" height="37" rx="10.5" fill="${fill}" stroke="${INK}" stroke-width="3.2" transform="rotate(-8 ${CX} ${CY})"/>`;
      return sticker(sq, '#F1EDFF') + `<g transform="rotate(-8 ${CX} ${CY})">${shekel(CX, CY, 15)}</g>`;
    },
  },
  // Sunset: an evening sky, horizon stripes and a yellow sun.
  coral: {
    defs: '<linearGradient id="coral-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB45C"/><stop offset="1" stop-color="#FF5A7D"/></linearGradient>',
    bg: () => '<rect width="108" height="108" fill="url(#coral-sky)"/>'
      + [[66, 2], [73, 3], [81, 4], [90, 5], [100, 6]].map(([y, h]) => `<rect x="0" y="${y}" width="108" height="${h}" fill="#FFFFFF" fill-opacity=".2"/>`).join(''),
    fg: () => sticker(coin, '#FFE27A') + shekel(CX, CY, 16),
  },
  // Sea: blue with waves and bubbles, a pale coin with a shine.
  ocean: {
    bg: () => `<rect width="108" height="108" fill="#2F7DF0"/>${waves('#FFFFFF', 11, 3.2, 0.2, 1.8)}`
      + [[77, 33, 3.5], [84, 44, 2.2], [70, 26, 1.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.4"/>`).join(''),
    fg: () => sticker(coin, '#EAF2FF')
      + `<path d="M${CX - 13} ${CY - 5}a14 14 0 0 1 8.5-8.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>`
      + shekel(CX, CY + 1, 16),
  },
  // Honey: honeycomb behind a hexagon sticker.
  honey: {
    bg: () => `<rect width="108" height="108" fill="#F5B800"/>${honeycomb(INK, 8, 0.12, 1.4)}`,
    fg: () => sticker((fill) => `<path d="${hexagon(CX, CY, 24)}" fill="${fill}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>`, '#FFF7DB')
      + shekel(CX, CY, 15),
  },
};

/** The icon's layers as SVG fragments on the 108×108 canvas. */
export function iconLayers(id) {
  const icon = ICONS[validPalette(id)];
  return { defs: icon.defs || '', bg: icon.bg(), fg: icon.fg() };
}

/**
 * A whole icon as an <svg>: the part a launcher shows (the middle 72), or
 * the full canvas (full: true) for a layer that gets masked later.
 */
export function iconSvg(id, { size = 108, layer = 'both', full = false, round = 0 } = {}) {
  const { defs, bg, fg } = iconLayers(id);
  let body = layer === 'bg' ? bg : layer === 'fg' ? fg : bg + fg;
  const box = full ? '0 0 108 108' : '18 18 72 72';
  let clip = '';
  if (round) {
    // Rounded corners of the shown part (a favicon has no launcher to mask it).
    clip = `<clipPath id="icon-round"><rect x="18" y="18" width="72" height="72" rx="${round}"/></clipPath>`;
    body = `<g clip-path="url(#icon-round)">${body}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${size}" height="${size}"><defs>${defs}${clip}</defs>${body}</svg>`;
}
