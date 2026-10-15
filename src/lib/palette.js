// The app's palette (Settings > מראה): accent colours and the texture behind
// the screens (styles.css, [data-palette]) and the favicon. The Android
// launcher icon stays green: switching it didn't work on every phone. Kept on
// the phone too, so the next start opens in it before the settings load.
import { iconSvg, validPalette } from './app-icons.js';

const KEY = 'palette';

export function storedPalette() {
  try { return validPalette(localStorage.getItem(KEY)); } catch (e) { return validPalette(null); }
}

export function applyPalette(id) {
  const palette = validPalette(id);
  document.documentElement.dataset.palette = palette;
  try { localStorage.setItem(KEY, palette); } catch (e) { /* private mode */ }
  const icon = document.querySelector('link[rel="icon"][sizes="32x32"]');
  if (icon) icon.href = `data:image/svg+xml,${encodeURIComponent(iconSvg(palette, { size: 32, round: 16 }))}`;
  return palette;
}
