import { expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}), Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/app', () => ({ App: {} }));
vi.mock('@capacitor/status-bar', () => ({ StatusBar: {}, Style: {} }));

const { parseRelease } = await import('./updater.js');

// Shape of a real release as published by .github/workflows/android.yml.
const release = {
  tag_name: 'v2.0.4',
  published_at: '2026-10-13T05:18:31Z',
  body: '- אפליקציית אנדרואיד ראשונה\n- פתיחה מהירה יותר\n\n<!-- update {"versionCode":104,"sha256":"56caf3fcf0c5845f359e142ecd14831bf0ed896abe898e755c5fc9d9d9adcfa9","apk":"payments.apk"} -->\n',
  assets: [{ name: 'payments.apk', size: 6315022, browser_download_url: 'https://github.com/ohavs/Payments-2026/releases/download/v2.0.4/payments.apk' }],
};

it('reads version, checksum, download URL and notes from a release', () => {
  expect(parseRelease(release)).toEqual({
    versionName: '2.0.4',
    versionCode: 104,
    sha256: '56caf3fcf0c5845f359e142ecd14831bf0ed896abe898e755c5fc9d9d9adcfa9',
    url: 'https://github.com/ohavs/Payments-2026/releases/download/v2.0.4/payments.apk',
    sizeMb: 6.3,
    notes: ['אפליקציית אנדרואיד ראשונה', 'פתיחה מהירה יותר'],
    publishedAt: '2026-10-13T05:18:31Z',
  });
});

it('ignores releases without the update marker or the APK', () => {
  expect(parseRelease({ ...release, body: 'notes only' })).toBeNull();
  expect(parseRelease({ ...release, assets: [] })).toBeNull();
});
