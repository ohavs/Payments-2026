import { describe, expect, it } from 'vitest';
import { detectLogText, detectReasonLabel, detectedItemId, guessCategory, isAlreadyRecorded, merchantKind, suggestionToItem } from './detect.js';

const CATS = ['קניות', 'ביטוחים', 'אוכל בחוץ', 'שונות'];

describe('guessCategory', () => {
  it('uses the category the merchant was filed under before', () => {
    const items = [{ title: 'שופרסל דיל', group: 'שונות' }];
    expect(guessCategory('שופרסל דיל', CATS, items)).toBe('שונות');
  });
  it('falls back to the kind of shop', () => {
    expect(guessCategory('שופרסל דיל', CATS)).toBe('קניות');
    expect(guessCategory('Wolt', CATS)).toBe('אוכל בחוץ');
    expect(guessCategory('הראל ביטוח', CATS)).toBe('ביטוחים');
  });
  it('a pharmacy is not a supermarket', () => {
    expect(merchantKind('סופר פארם')).toBe('heart');
  });
  it('unknown merchants go to the catch-all category', () => {
    expect(guessCategory('Some Shop Ltd', ['קניות', 'אוכל בחוץ', 'שונות'])).toBe('שונות');
    expect(guessCategory('xyz', ['א', 'ב'])).toBe('ב');
  });
});

describe('suggestionToItem', () => {
  it('builds an expense dated on the day of the charge', () => {
    const s = { amount: 45.9, currency: '₪', merchant: 'רמי לוי', time: new Date(2026, 9, 12, 18).getTime(), source: 'wallet' };
    expect(suggestionToItem(s, { categories: CATS })).toEqual({
      title: 'רמי לוי', amount: 45.9, group: 'קניות', note: '', date: '2026-10-12', source: 'wallet',
    });
  });
  it('converts foreign currency and keeps the original in the note', () => {
    const s = { amount: 10, currency: '$', merchant: 'Starbucks', time: Date.now() };
    const it = suggestionToItem(s, { categories: CATS, rates: { ILS: 1, USD: 0.25 } });
    expect(it.amount).toBe(40);
    expect(it.note).toBe('$10');
  });
});

describe('isAlreadyRecorded', () => {
  it('matches the same amount within two days', () => {
    const t = new Date(2026, 9, 12, 18).getTime();
    expect(isAlreadyRecorded({ amount: 45.9, time: t }, [{ amount: 45.9, date: '2026-10-11' }])).toBe(true);
    expect(isAlreadyRecorded({ amount: 45.9, time: t }, [{ amount: 45.9, date: '2026-10-05' }])).toBe(false);
    expect(isAlreadyRecorded({ amount: 45.9, time: t }, [{ amount: 30, date: '2026-10-12' }])).toBe(false);
  });
});

describe('detectedItemId', () => {
  it('is the same for the same suggestion and a valid document id', () => {
    expect(detectedItemId({ id: 'gmail:18c2f/a' })).toBe('detected-gmail_18c2f_a');
    expect(detectedItemId({ id: 'gmail:18c2f/a' })).toBe(detectedItemId({ id: 'gmail:18c2f/a' }));
    expect(detectedItemId({ id: 'b9e0-11' })).not.toBe(detectedItemId({ id: 'b9e0-12' }));
  });
});

describe('detect log', () => {
  it('labels why a notification was or was not offered', () => {
    expect(detectReasonLabel({ reason: 'no-amount' })).toBe('לא נמצא סכום');
    expect(detectReasonLabel({ reason: 'not-a-charge', detail: 'זיכוי' })).toBe('סונן · זיכוי');
    expect(detectReasonLabel({ reason: 'new-reason' })).toBe('new-reason');
  });
  it('copies as plain text with the listener state', () => {
    const text = detectLogText(
      [{ time: 1, pkg: 'com.google.android.apps.walletnfcrel', app: 'Wallet', title: 'שופרסל', text: 'Visa\n•••• 1234', reason: 'ok-no-amount' }],
      { access: true, enabled: true, connected: false },
    );
    expect(text).toContain('מחובר: לא');
    expect(text).toContain('Wallet (com.google.android.apps.walletnfcrel) · הוצע, בלי סכום');
    expect(text).toContain('טקסט: Visa ⏎ •••• 1234');
  });
});
