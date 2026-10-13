// In-app updates from GitHub Releases (Android only).
//
// Each release is tagged v<versionName> and its notes end with a marker
// <!-- update {"versionCode":N,"sha256":"…","apk":"payments.apk",
//              "lite":{"apk":"payments-lite.apk","sha256":"…"}} -->
// written by .github/workflows/android.yml. The lite APK has no notification
// listener (Play Protect blocks sideloading apps that declare one); a lite
// install keeps updating to lite until the user turns on payment detection.
import { registerPlugin } from '@capacitor/core';
import { detectStatus } from './detect.js';
import { appVersion, isNative } from './platform.js';

const ApkUpdater = registerPlugin('ApkUpdater');
const REPO = 'ohavs/Payments-2026';
const LAST_CHECK_KEY = 'update-last-check';

export function parseRelease(rel, variant = 'full') {
  const m = /<!--\s*update\s*(\{[\s\S]*?\})\s*-->/.exec(rel.body || '');
  if (!m) return null;
  const meta = JSON.parse(m[1]);
  const pick = variant === 'lite' && meta.lite ? meta.lite : meta;
  const asset = (rel.assets || []).find((a) => a.name === pick.apk);
  if (!asset) return null;
  const notes = (rel.body || '').replace(m[0], '').trim();
  return {
    versionName: rel.tag_name.replace(/^v/, ''),
    versionCode: meta.versionCode,
    sha256: pick.sha256,
    url: asset.browser_download_url,
    sizeMb: Math.round(asset.size / 1e5) / 10,
    // The install hint for new phones (names the APK files) is for GitHub only.
    notes: notes.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter((l) => l && !/\.apk\b/.test(l)),
    publishedAt: rel.published_at,
  };
}

// 'lite' when the installed build has no notification listener. Builds from
// before the split don't report it and are full.
export async function appVariant() {
  try { return (await detectStatus()).available === false ? 'lite' : 'full'; } catch { return 'full'; }
}

async function latestRelease() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('GitHub ' + res.status);
  return res.json();
}

// → { current, latest, available } ; throws on network errors.
export async function checkForUpdate() {
  if (!isNative) return { current: null, latest: null, available: false };
  const [current, variant, rel] = await Promise.all([appVersion(), appVariant(), latestRelease()]);
  const latest = parseRelease(rel, variant);
  try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch {}
  return { current, latest, available: !!latest && latest.versionCode > current.code };
}

// The full build of the latest release, to switch a lite install over
// (same version is fine: Android reinstalls over it and keeps the data).
export async function checkFullBuild() {
  const [current, rel] = await Promise.all([appVersion(), latestRelease()]);
  const latest = parseRelease(rel, 'full');
  return { current, latest, available: !!latest };
}

// Background check at most every 6 hours.
export async function checkForUpdateQuietly() {
  if (!isNative) return null;
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    if (Date.now() - last < 6 * 3600 * 1000) return null;
  } catch {}
  try { return await checkForUpdate(); } catch { return null; }
}

export const canInstallUpdates = async () => (await ApkUpdater.canInstall()).allowed;
export const openInstallSettings = () => ApkUpdater.openInstallSettings();

// Downloads, verifies and opens the installer. onProgress(0..100).
export async function installUpdate(latest, onProgress) {
  const sub = await ApkUpdater.addListener('progress', (e) => onProgress?.(e.percent));
  try {
    await ApkUpdater.downloadAndInstall({ url: latest.url, sha256: latest.sha256 });
  } finally {
    sub.remove();
  }
}
