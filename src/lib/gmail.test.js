import { describe, expect, it } from 'vitest';
import { detectRecurring, findAmounts, htmlToText, merchantOf, parseMessage, parseReceipt, receiptQuery } from './gmail.js';

const b64 = (s) => Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

function message({ id = 'm1', from, subject, html, plain, time = Date.UTC(2026, 9, 1) }) {
  const parts = [];
  if (plain) parts.push({ mimeType: 'text/plain', body: { data: b64(plain) } });
  if (html) parts.push({ mimeType: 'text/html', body: { data: b64(html) } });
  return {
    id, internalDate: String(time),
    payload: { mimeType: 'multipart/alternative', headers: [{ name: 'From', value: from }, { name: 'Subject', value: subject }], parts },
  };
}

describe('parseMessage + parseReceipt', () => {
  it('reads a Hebrew HTML receipt and picks the total', () => {
    const m = parseMessage(message({
      from: '"וולט" <info@wolt.com>', subject: 'הקבלה שלך מוולט',
      html: '<table><tr><td>פיצה</td><td>₪52.00</td></tr><tr><td>משלוח</td><td>₪9.90</td></tr><tr><td>סה"כ לתשלום</td><td>&#8362;61.90</td></tr></table>',
    }));
    expect(m.domain).toBe('wolt.com');
    const r = parseReceipt(m);
    expect(r.amount).toBe(61.9);
    expect(r.currency).toBe('₪');
    expect(r.merchant).toBe('וולט');
    expect(r.id).toBe('gmail:m1');
  });

  it('reads an English plain-text receipt with dollars', () => {
    const r = parseReceipt(parseMessage(message({
      from: 'OpenAI <noreply@tm.openai.com>', subject: 'Your receipt from OpenAI #1234',
      plain: 'ChatGPT Plus Subscription\nSubtotal $20.00\nTax $0.00\nAmount paid $20.00',
    })));
    expect(r.amount).toBe(20);
    expect(r.currency).toBe('$');
    expect(r.serviceId).toBe('chatgpt');
    expect(r.merchant).toBe('OpenAI');
  });

  it('amount after the number, with ש"ח', () => {
    const a = findAmounts('סכום החיוב: 1,249.90 ש"ח');
    expect(a[0]).toMatchObject({ value: 1249.9, currency: '₪', total: true });
  });

  it('ignores refunds and mail without an amount', () => {
    expect(parseReceipt(parseMessage(message({ from: 'x@shop.co.il', subject: 'זיכוי על הזמנה', plain: 'זיכוי ₪40' })))).toBeNull();
    expect(parseReceipt(parseMessage(message({ from: 'x@shop.co.il', subject: 'אישור הזמנה', plain: 'ההזמנה בדרך' })))).toBeNull();
  });
});

describe('merchantOf', () => {
  it('falls back to the domain when the sender name is generic', () => {
    expect(merchantOf({ fromName: 'noreply', domain: 'mail.superpharm.co.il' })).toBe('Superpharm');
    expect(merchantOf({ fromName: '', domain: 'netflix.com' })).toBe('Netflix');
  });
});

describe('detectRecurring', () => {
  const day = 86400000;
  const base = Date.UTC(2026, 6, 10);
  it('finds a monthly charge from the same sender', () => {
    const rs = [0, 31, 61].map((d, i) => ({ id: `g${i}`, amount: 39.9, currency: '₪', merchant: 'Gym', domain: 'gym.co.il', serviceId: null, time: base + d * day }));
    const [sub] = detectRecurring(rs);
    expect(sub).toMatchObject({ cycle: 'monthly', amount: 39.9, count: 3, nextDate: '2026-10-09' });
  });
  it('a known service is a subscription after one receipt', () => {
    const [sub] = detectRecurring([{ id: 'g', amount: 54.9, currency: '₪', merchant: 'Netflix', domain: 'netflix.com', serviceId: 'netflix', time: base }]);
    expect(sub.serviceId).toBe('netflix');
  });
  it('one-off purchases are not subscriptions', () => {
    const rs = [{ id: 'a', amount: 120, currency: '₪', merchant: 'Shop', domain: 'shop.com', serviceId: null, time: base },
      { id: 'b', amount: 45, currency: '₪', merchant: 'Shop', domain: 'shop.com', serviceId: null, time: base + 3 * day }];
    expect(detectRecurring(rs)).toEqual([]);
  });
});

describe('helpers', () => {
  it('htmlToText drops styles and tags', () => {
    expect(htmlToText('<style>p{}</style><p>שלום&nbsp;עולם</p>').trim()).toBe('שלום עולם');
  });
  it('query looks back the requested number of days', () => {
    expect(receiptQuery(30)).toMatch(/^newer_than:30d /);
  });
});
