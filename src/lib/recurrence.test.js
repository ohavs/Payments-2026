import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  daysUntilNext, isPaidThisCycle, isPaused, lastOccurrenceBefore, nextOccurrence, occurrencesBetween,
  pausedFrom, pausedThrough, resumedFrom, toISO,
} from './recurrence.js';

const d = (iso) => { const [y, m, day] = iso.split('-').map(Number); return new Date(y, m - 1, day); };
const next = (cycle, nextDate, today) => toISO(nextOccurrence({ cycle, nextDate }, d(today)));

describe('nextOccurrence', () => {
  it('keeps a future anchor as is', () => {
    expect(next('monthly', '2026-10-20', '2026-10-13')).toBe('2026-10-20');
  });

  it('treats today as due, not past', () => {
    expect(next('monthly', '2026-10-13', '2026-10-13')).toBe('2026-10-13');
  });

  it('rolls a past monthly date forward instead of leaving it stuck', () => {
    expect(next('monthly', '2026-09-05', '2026-10-13')).toBe('2026-11-05');
    expect(next('monthly', '2025-01-20', '2026-10-13')).toBe('2026-10-20');
  });

  it('clamps day 31 to short months without drifting', () => {
    expect(next('monthly', '2026-01-31', '2026-02-10')).toBe('2026-02-28');
    expect(next('monthly', '2026-01-31', '2026-03-01')).toBe('2026-03-31');
    expect(next('monthly', '2026-01-31', '2026-04-01')).toBe('2026-04-30');
  });

  it('handles leap days in yearly payments', () => {
    expect(next('yearly', '2024-02-29', '2025-01-01')).toBe('2025-02-28');
    expect(next('yearly', '2024-02-29', '2027-06-01')).toBe('2028-02-29');
  });

  it('steps weekly and daily payments', () => {
    expect(next('weekly', '2026-10-01', '2026-10-13')).toBe('2026-10-15');
    expect(next('weekly', '2026-10-06', '2026-10-13')).toBe('2026-10-13');
    expect(next('daily', '2026-01-01', '2026-10-13')).toBe('2026-10-13');
  });

  it('crosses the Israeli DST change without losing a day', () => {
    expect(next('daily', '2026-03-20', '2026-03-29')).toBe('2026-03-29');
    expect(next('weekly', '2026-10-18', '2026-10-26')).toBe('2026-11-01');
  });

  it('returns null without a date', () => {
    expect(nextOccurrence({ cycle: 'monthly' }, d('2026-10-13'))).toBeNull();
  });
});

describe('paid state', () => {
  it('a monthly charge earlier this month is paid', () => {
    const p = { cycle: 'monthly', nextDate: '2026-09-05' };
    expect(isPaidThisCycle(p, d('2026-10-13'))).toBe(true);
    expect(toISO(lastOccurrenceBefore(p, d('2026-10-13')))).toBe('2026-10-05');
  });

  it('a monthly charge later this month is not paid', () => {
    expect(isPaidThisCycle({ cycle: 'monthly', nextDate: '2026-09-20' }, d('2026-10-13'))).toBe(false);
  });

  it('a first charge still in the future has nothing before it', () => {
    const p = { cycle: 'monthly', nextDate: '2026-10-20' };
    expect(lastOccurrenceBefore(p, d('2026-10-13'))).toBeNull();
    expect(isPaidThisCycle(p, d('2026-10-13'))).toBe(false);
  });

  it('weekly and daily payments are never shown as paid', () => {
    expect(isPaidThisCycle({ cycle: 'weekly', nextDate: '2026-10-01' }, d('2026-10-13'))).toBe(false);
    expect(isPaidThisCycle({ cycle: 'daily', nextDate: '2026-10-01' }, d('2026-10-13'))).toBe(false);
  });
});

describe('occurrencesBetween', () => {
  it('lists every weekly charge in a month', () => {
    const got = occurrencesBetween({ cycle: 'weekly', nextDate: '2026-09-03' }, d('2026-10-01'), d('2026-10-31')).map(toISO);
    expect(got).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']);
  });

  it('includes this month\'s already-paid monthly charge', () => {
    const got = occurrencesBetween({ cycle: 'monthly', nextDate: '2026-08-05' }, d('2026-10-01'), d('2026-10-31')).map(toISO);
    expect(got).toEqual(['2026-10-05']);
  });

  it('never invents charges before the anchor', () => {
    expect(occurrencesBetween({ cycle: 'monthly', nextDate: '2026-12-01' }, d('2026-10-01'), d('2026-10-31'))).toEqual([]);
  });
});

describe('daysUntilNext', () => {
  it('counts whole days', () => {
    expect(daysUntilNext({ cycle: 'monthly', nextDate: '2026-09-14' }, d('2026-10-13'))).toBe(1);
    expect(daysUntilNext({ cycle: 'monthly', nextDate: '2026-09-13' }, d('2026-10-13'))).toBe(0);
  });
});

describe('pause', () => {
  const sub = { cycle: 'monthly', nextDate: '2026-01-05' };
  const between = (p, a, b) => occurrencesBetween(p, d(a), d(b)).map(toISO);

  it('keeps the charges before the pause and drops the ones after', () => {
    const p = { ...sub, pauses: pausedFrom(sub, d('2026-04-20')) };
    expect(p.pauses).toEqual([{ from: '2026-04-20' }]);
    expect(isPaused(p)).toBe(true);
    expect(between(p, '2026-01-01', '2026-12-31')).toEqual(['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05']);
    expect(nextOccurrence(p, d('2026-04-20'))).toBeNull();
    expect(daysUntilNext(p, d('2026-06-01'))).toBeNull();
    expect(toISO(lastOccurrenceBefore(p, d('2026-09-01')))).toBe('2026-04-05');
  });

  it('a charge due on the day of the pause is not counted', () => {
    const p = { ...sub, pauses: pausedFrom(sub, d('2026-04-05')) };
    expect(between(p, '2026-04-01', '2026-04-30')).toEqual([]);
    expect(isPaidThisCycle(p, d('2026-04-10'))).toBe(false);
  });

  it('resuming skips the paused months and charges again', () => {
    const paused = { ...sub, pauses: pausedFrom(sub, d('2026-04-20')) };
    const p = { ...sub, pauses: resumedFrom(paused, d('2026-07-01')) };
    expect(p.pauses).toEqual([{ from: '2026-04-20', to: '2026-07-01' }]);
    expect(isPaused(p)).toBe(false);
    expect(between(p, '2026-03-01', '2026-08-31')).toEqual(['2026-03-05', '2026-04-05', '2026-07-05', '2026-08-05']);
    expect(toISO(nextOccurrence(p, d('2026-04-21')))).toBe('2026-07-05');
    expect(toISO(lastOccurrenceBefore(p, d('2026-07-01')))).toBe('2026-04-05');
  });

  it('pausing and resuming on the same day leaves nothing behind', () => {
    const paused = { ...sub, pauses: pausedFrom(sub, d('2026-04-20')) };
    expect(resumedFrom(paused, d('2026-04-20'))).toEqual([]);
  });

  it('pausing again on the day it was resumed continues the same pause', () => {
    const resumed = { ...sub, pauses: [{ from: '2026-04-20', to: '2026-07-01' }] };
    expect(pausedFrom(resumed, d('2026-07-01'))).toEqual([{ from: '2026-04-20' }]);
    expect(pausedFrom(resumed, d('2026-08-01'))).toEqual([{ from: '2026-04-20', to: '2026-07-01' }, { from: '2026-08-01' }]);
  });

  it('skips long pauses of daily payments without stepping through them', () => {
    const p = { cycle: 'daily', nextDate: '2020-01-01', pauses: [{ from: '2020-01-03', to: '2026-01-01' }] };
    expect(between(p, '2020-01-01', '2026-01-02')).toEqual(['2020-01-01', '2020-01-02', '2026-01-01', '2026-01-02']);
  });

  it('pausedThrough tells whether a whole month was paused', () => {
    const p = { ...sub, pauses: [{ from: '2026-04-20' }] };
    expect(pausedThrough(p, d('2026-04-01'), d('2026-04-30'))).toBe(false);
    expect(pausedThrough(p, d('2026-05-01'), d('2026-05-31'))).toBe(true);
    const q = { ...sub, pauses: [{ from: '2026-04-20', to: '2026-06-10' }] };
    expect(pausedThrough(q, d('2026-05-01'), d('2026-05-31'))).toBe(true);
    expect(pausedThrough(q, d('2026-06-01'), d('2026-06-30'))).toBe(false);
  });
});

describe('Cloud Function copy', () => {
  it('functions/recurrence.mjs is identical to src/lib/recurrence.js', () => {
    const root = path.resolve(__dirname, '../..');
    const a = fs.readFileSync(path.join(root, 'src/lib/recurrence.js'), 'utf8');
    const b = fs.readFileSync(path.join(root, 'functions/recurrence.mjs'), 'utf8');
    expect(b).toBe(a);
  });
});
