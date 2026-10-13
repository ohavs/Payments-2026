import { describe, expect, it } from 'vitest';
import { expensesToCSV } from './export.js';

describe('expensesToCSV', () => {
  it('writes a BOM, a Hebrew header and rows by date, quoting where needed', () => {
    const csv = expensesToCSV([
      { date: '2026-10-12', title: 'וולט', group: 'אוכל בחוץ', amount: 61.9, note: 'פיצה, משלוח', source: 'gmail' },
      { date: '2026-10-01', title: 'שופרסל', group: 'קניות', amount: 245 },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('תאריך,שם,קטגוריה,סכום,הערה,מקור');
    expect(lines[1]).toBe('2026-10-01,שופרסל,קניות,245,,ידני');
    expect(lines[2]).toBe('2026-10-12,וולט,אוכל בחוץ,61.9,"פיצה, משלוח",Gmail');
  });
  it('adds who paid in a shared space', () => {
    const csv = expensesToCSV([{ date: '2026-10-01', title: 'x', amount: 1, paidBy: 'u1' }], { payerName: (id) => (id === 'u1' ? 'דנה' : '?') });
    expect(csv.split('\r\n')[1]).toBe('2026-10-01,x,,1,,דנה,ידני');
  });
});
