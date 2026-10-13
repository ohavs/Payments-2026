import { describe, expect, it } from 'vitest';
import { planReminders } from './reminders.js';

const settings = { notif: true, notifTimings: ['day', 'same'], notifTime: '09:00' };
const sub = { id: 'a', serviceId: 'netflix', price: 54.9, currency: '₪', cycle: 'monthly', nextDate: '2026-01-15' };

describe('planReminders', () => {
  it('schedules the day before and the day of each charge, at the chosen hour', () => {
    const now = new Date(2026, 9, 13, 12, 0);
    const plan = planReminders([sub], settings, now);
    expect(plan[0].at).toEqual(new Date(2026, 9, 14, 9, 0));
    expect(plan[0].body).toContain('מחר');
    expect(plan[1].at).toEqual(new Date(2026, 9, 15, 9, 0));
    expect(plan[1].body).toContain('היום');
    expect(plan[0].title).toContain('Netflix');
    // Within 60 days: Oct, Nov, and Dec 14 is past the horizon
    expect(plan.length).toBe(4);
  });

  it('skips reminders whose time already passed today', () => {
    const now = new Date(2026, 9, 15, 10, 0);
    const plan = planReminders([sub], settings, now);
    expect(plan[0].at).toEqual(new Date(2026, 10, 14, 9, 0));
  });

  it('is empty when reminders are off', () => {
    expect(planReminders([sub], { ...settings, notif: false })).toEqual([]);
    expect(planReminders([sub], { ...settings, notifTimings: [] })).toEqual([]);
  });

  it('gives each reminder a stable, unique id', () => {
    const now = new Date(2026, 9, 13, 12, 0);
    const a = planReminders([sub], settings, now).map((r) => r.id);
    const b = planReminders([sub], settings, now).map((r) => r.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});
