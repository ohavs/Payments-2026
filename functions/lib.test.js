import { describe, expect, it } from 'vitest';
import lib from './lib.js';

const { budgetMessage, budgetThreshold, expenseMessage, monthRange, subsMonthly, summaryMessage } = lib;

describe('budgetThreshold', () => {
  it('fires 80 then 100, each once', () => {
    expect(budgetThreshold(700, 1000, 0)).toBeNull();
    expect(budgetThreshold(800, 1000, 0)).toBe(80);
    expect(budgetThreshold(900, 1000, 80)).toBeNull();
    expect(budgetThreshold(1000, 1000, 80)).toBe(100);
    expect(budgetThreshold(1500, 1000, 100)).toBeNull();
  });
  it('jumping straight past the cap sends 100', () => {
    expect(budgetThreshold(1200, 1000, 0)).toBe(100);
  });
  it('no cap, no alert', () => {
    expect(budgetThreshold(5000, 0, 0)).toBeNull();
  });
});

describe('messages', () => {
  it('budget', () => {
    expect(budgetMessage(80, 820, 1000, 'הבית שלנו').body).toBe('נשארו ₪180 עד סוף החודש בהבית שלנו');
    expect(budgetMessage(100, 1050, 1000).title).toBe('עברת את התקציב החודשי');
  });
  it('summary compares with the month before', () => {
    expect(summaryMessage(8, 4210, 4800).body).toBe('בספטמבר הוצאת ₪4,210, 12% פחות מאוגוסט 🎉');
    expect(summaryMessage(0, 100, 0).body).toBe('בינואר הוצאת ₪100');
  });
  it('partner expense', () => {
    expect(expenseMessage({ title: 'שופרסל', group: 'קניות', amount: 120 }, 'דנה', 'הבית שלנו'))
      .toEqual({ title: 'דנה הוסיף/ה ₪120', body: 'שופרסל · קניות · הבית שלנו' });
    expect(expenseMessage({ title: 'קניות', group: 'קניות', amount: 50 }, 'דנה', '').body).toBe('קניות');
  });
});

describe('helpers', () => {
  it('monthRange', () => {
    expect(monthRange(2026, 1)).toEqual({ key: '2026-02', from: '2026-02-01', to: '2026-02-28' });
  });
  it('subsMonthly converts cycle and currency', () => {
    expect(subsMonthly([{ price: 120, cycle: 'yearly' }, { price: 10, currency: '$', cycle: 'monthly' }])).toBeCloseTo(47);
  });
});
