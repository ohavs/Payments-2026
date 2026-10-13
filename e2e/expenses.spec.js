// One person: expenses, quick add, subscriptions, summary and settings.
import { expect, test } from '@playwright/test';
import { offline, quickAdd, signInGuest, spaceItems, tab, trackErrors } from './helpers.js';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const inDays = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

const PAYMENTS = [
  { id: 'p-netflix', serviceId: 'netflix', price: 54.9, currency: '₪', cycle: 'monthly', nextDate: inDays(3), note: '' },
  { id: 'p-spotify', serviceId: 'spotify', price: 21.9, currency: '₪', cycle: 'monthly', nextDate: inDays(9), note: '' },
];
const ITEMS = [
  { id: 'i1', title: 'שופרסל', group: 'קניות', amount: 286, note: '', date: today },
  { id: 'i2', title: 'ארוחת צהריים', group: 'אוכל בחוץ', amount: 74, note: 'עם דנה', date: today },
];

test('expenses, quick add, subscriptions and settings', async ({ page, context }) => {
  await offline(context);
  const errors = trackErrors(page);
  await signInGuest(page);

  await page.evaluate(async ({ PAYMENTS, ITEMS }) => {
    const fb = window.firebase;
    const db = fb.firestore();
    const uid = fb.auth().currentUser.uid;
    for (const { id, ...p } of PAYMENTS) await db.collection('users').doc(uid).collection('payments').doc(id).set(p);
    const lists = await db.collection('lists').where('members', 'array-contains', uid).get();
    for (const { id, ...it } of ITEMS) {
      await lists.docs[0].ref.collection('items').doc(id).set({ ...it, createdAt: fb.firestore.FieldValue.serverTimestamp() });
    }
  }, { PAYMENTS, ITEMS });

  await expect(page.getByText('שופרסל').first()).toBeVisible();
  await expect(page.getByText('ארוחת צהריים').first()).toBeVisible();

  // Quick add from the + button.
  await quickAdd(page, ['4', '5'], 'אוכל בחוץ');
  await expect.poll(async () => (await spaceItems(page, 'personal')).items.map((i) => i.amount).sort((x, y) => x - y)).toEqual([45, 74, 286]);

  await tab(page, 'מנויים');
  await expect(page.getByText('Netflix').first()).toBeVisible();
  await expect(page.getByText('Spotify').first()).toBeVisible();

  await tab(page, 'סיכום');
  await tab(page, 'הגדרות');
  await page.getByRole('button', { name: 'כהה', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  expect(errors).toEqual([]);
});
