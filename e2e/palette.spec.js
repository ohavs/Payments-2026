// Palettes (Settings > מראה): picking one recolours the app, adds its
// texture, is saved with the settings and comes back after a reload.
// SHOTS=1 also saves screenshots of every palette, light and dark.
import { test, expect } from '@playwright/test';
import { offline, signInGuest, tab, trackErrors } from './helpers.js';

const accent = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase());

test('palette: colours, texture, saved and restored', async ({ page, context }) => {
  await offline(context);
  const errors = trackErrors(page);
  await signInGuest(page);
  expect(await accent(page)).toBe('#22A45D');

  await tab(page, 'הגדרות');
  await page.getByRole('radio', { name: 'לילך' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'violet');
  expect(await accent(page)).toBe('#8467FF');
  const texture = await page.evaluate(() => getComputedStyle(document.querySelector('.app-bg'), '::before').display);
  expect(texture).toBe('block');
  await expect(page.getByRole('radio', { name: 'לילך' })).toHaveAttribute('aria-checked', 'true');

  // Saved with the settings: a fresh load (no local copy) opens in it.
  await page.waitForFunction(async () => {
    const fb = window.firebase;
    const d = await fb.firestore().doc(`users/${fb.auth().currentUser.uid}/settings/main`).get();
    return d.data()?.palette === 'violet';
  }, null, { timeout: 15_000, polling: 500 });
  await page.evaluate(() => localStorage.removeItem('palette'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'violet', { timeout: 30_000 });

  if (process.env.SHOTS) {
    for (const dark of [false, true]) {
      await tab(page, 'הגדרות');
      await page.getByRole('button', { name: dark ? 'כהה' : 'בהיר', exact: true }).click();
      for (const name of ['קלאסי', 'לילך', 'שקיעה', 'ים', 'דבש']) {
        await tab(page, 'הגדרות');
        await page.getByRole('radio', { name }).click();
        await page.getByRole('radio', { name }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/palette-${name}-${dark ? 'dark' : 'light'}-settings.png` });
        await tab(page, 'הוצאות');
        await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/palette-${name}-${dark ? 'dark' : 'light'}.png` });
      }
    }
  }
  expect(errors).toEqual([]);
});
