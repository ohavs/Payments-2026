// Two people share a space: invite by code, who-paid, live sync, shared
// subscriptions, and the rules keep personal spaces private.
import { expect, test } from '@playwright/test';
import { offline, quickAdd, signInGuest, spaceItems, tab, trackErrors } from './helpers.js';

test('a shared space for two', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await offline(ctxA); await offline(ctxB);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const errors = [...[a, b].map(trackErrors)];

  await signInGuest(a, 'אוהב כהן');
  await a.getByRole('button', { name: '+ משותף' }).click();
  await a.getByRole('button', { name: 'פתח מרחב' }).click();
  await expect(a.getByRole('tab', { name: /הבית שלנו/ })).toHaveAttribute('aria-selected', 'true');
  const shared = await spaceItems(a, 'shared');
  const personalA = await spaceItems(a, 'personal');

  await signInGuest(b, 'דנה לוי');
  await b.getByRole('button', { name: '+ משותף' }).click();
  await b.getByRole('button', { name: 'קיבלתי קוד הצטרפות' }).click();
  await b.getByPlaceholder('הדבק כאן את הקוד').fill(shared.id);
  await b.getByRole('button', { name: 'הצטרף', exact: true }).click();
  await expect(b.getByRole('tab', { name: /הבית שלנו/ })).toHaveAttribute('aria-selected', 'true');

  // A pays from the joint account, B pays for themself; each sees both.
  await quickAdd(a, ['1', '2', '0'], 'אוכל בחוץ', 'משותף');
  await quickAdd(b, ['9', '0'], 'חשבונות');
  const amounts = async (page) => (await spaceItems(page, 'shared')).items.map((i) => i.amount).sort((x, y) => x - y);
  await expect.poll(() => amounts(a)).toEqual([90, 120]);
  await expect.poll(() => amounts(b)).toEqual([90, 120]);
  const items = (await spaceItems(a, 'shared')).items;
  expect(items.find((i) => i.amount === 120).paidBy).toBe('joint');
  expect(items.find((i) => i.amount === 90).paidBy).toBe(await b.evaluate(() => window.firebase.auth().currentUser.uid));
  await expect(a.getByRole('button', { name: /^דנה/ }).first()).toContainText('90');
  await expect(b.getByRole('button', { name: /^אוהב/ }).first()).toBeVisible();

  // A subscription added by B shows up for A.
  await tab(b, 'מנויים');
  await b.getByRole('button', { name: '+ מנוי' }).click();
  await b.getByText('Disney+').first().click();
  await b.getByRole('button', { name: 'הוסף תשלום' }).click();
  await tab(a, 'מנויים');
  await expect(a.getByText('Disney+').first()).toBeVisible();

  // B can't read A's personal space.
  const denied = await b.evaluate(async (id) => {
    try { await window.firebase.firestore().collection('lists').doc(id).collection('items').get(); return false; }
    catch (e) { return e.code === 'permission-denied'; }
  }, personalA.id);
  expect(denied).toBe(true);

  expect(errors.flat()).toEqual([]);
  await ctxA.close(); await ctxB.close();
});
