// Receipts from Gmail: read-only access, on demand ("סרוק"), from the Google
// account the user is signed in with. Messages are read in the app, turned
// into suggestions, and nothing from the mailbox is stored.
import { registerPlugin } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import firebase from './firebase.js';
import { isNative } from './platform.js';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Sender domain → catalog service, to offer a subscription with the right logo.
const DOMAIN_SERVICE = {
  'netflix.com': 'netflix', 'spotify.com': 'spotify', 'youtube.com': 'ytpremium',
  'disneyplus.com': 'disney', 'openai.com': 'chatgpt', 'anthropic.com': 'claude',
  'figma.com': 'figma', 'adobe.com': 'adobe', 'github.com': 'github', 'notion.so': 'notion',
  'linear.app': 'linear', 'partner.co.il': 'partner', 'cellcom.co.il': 'cellcom',
  'pelephone.co.il': 'pelephone', 'hotmobile.co.il': 'hotmobile', 'golantelecom.co.il': 'golan',
  'bezeq.co.il': 'bezeq', 'hot.net.il': 'hot', 'yes.co.il': 'yes', 'iec.co.il': 'electric',
};

const SUBJECTS = [
  'קבלה', 'חשבונית', '"אישור תשלום"', '"אישור הזמנה"', '"תודה על הרכישה"', '"תודה על ההזמנה"',
  '"פירוט חיוב"', '"חשבון חודשי"', 'receipt', 'invoice', '"payment received"', '"payment confirmation"',
  '"order confirmation"', '"your order"', '"your payment"', '"thanks for your purchase"',
];
export function receiptQuery(days = 90) {
  const senders = Object.keys(DOMAIN_SERVICE).join(' OR ');
  return `newer_than:${days}d -category:promotions -category:social (subject:(${SUBJECTS.join(' OR ')}) OR from:(${senders}))`;
}

// ---------- Access ----------
let cached = null; // { token, until }
const GmailToken = registerPlugin('GmailToken');

// Android, once access was granted: a token with no UI at all (null when
// the grant is missing or Google wants it confirmed again).
export async function silentGmailToken() {
  if (!isNative) return null;
  try {
    const { token } = await GmailToken.silentToken();
    if (token) cached = { token, until: Date.now() + 45 * 60 * 1000 };
    return token || null;
  } catch (e) { return null; }
}

export async function getGmailToken() {
  if (cached && cached.until > Date.now()) return cached.token;
  let token = null;
  if (import.meta.env.VITE_USE_EMULATORS) {
    // Local/e2e runs: emulator accounts have no Google token; tests mock the API.
    token = 'emulator-token';
  } else if (isNative && (token = await silentGmailToken())) {
    // Already granted: no account picker.
  } else if (isNative) {
    // The legacy Google Sign-In flow returns an access token every time
    // (the Credential Manager flow omits it once access was granted before).
    const res = await FirebaseAuthentication.signInWithGoogle({ scopes: [GMAIL_SCOPE], useCredentialManager: false });
    token = res.credential?.accessToken || null;
  } else {
    const user = firebase.auth().currentUser;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(GMAIL_SCOPE);
    if (user?.email) provider.setCustomParameters({ login_hint: user.email });
    const res = await user.reauthenticateWithPopup(provider);
    token = res.credential?.accessToken || null;
  }
  if (!token) throw Object.assign(new Error('no token'), { code: 'gmail/no-token' });
  cached = { token, until: Date.now() + 45 * 60 * 1000 };
  return token;
}

async function api(token, path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || res.statusText;
    let code = 'gmail/error';
    if (res.status === 401) { cached = null; code = 'gmail/unauthorized'; }
    else if (res.status === 403 && /has not been used|is disabled|not enabled/i.test(msg)) code = 'gmail/api-disabled';
    else if (res.status === 403) code = 'gmail/forbidden';
    throw Object.assign(new Error(msg), { code, status: res.status });
  }
  return res.json();
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      try { out[i] = await fn(list[i]); } catch (e) { if (e.code === 'gmail/unauthorized') throw e; out[i] = null; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

// Fetch and parse recent receipts. Returns { receipts, recurring }.
export async function scanGmail({ days = 90, max = 60, token } = {}) {
  const t = token || await getGmailToken();
  const q = encodeURIComponent(receiptQuery(days));
  const list = await api(t, `/messages?q=${q}&maxResults=${max}`);
  const ids = (list.messages || []).map((m) => m.id);
  const messages = await mapLimit(ids, 6, (id) => api(t, `/messages/${id}?format=full`));
  const receipts = messages.filter(Boolean).map(parseMessage).map(parseReceipt).filter(Boolean);
  return { receipts, recurring: detectRecurring(receipts) };
}

// ---------- Parsing (pure) ----------
function decodeBase64Url(data) {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function htmlToText(html) {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8362;|&#x20aa;/gi, '₪')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
}

function collectParts(part, out) {
  if (!part) return;
  if (part.parts) part.parts.forEach((p) => collectParts(p, out));
  else if (part.body?.data && /^text\/(plain|html)/.test(part.mimeType || '')) {
    out.push({ type: part.mimeType, text: decodeBase64Url(part.body.data) });
  }
}

export function parseMessage(msg) {
  const headers = Object.fromEntries((msg.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
  const from = headers.from || '';
  const nameMatch = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  const email = (nameMatch ? nameMatch[2] : from).trim().toLowerCase();
  const domain = email.split('@')[1] || '';
  const parts = [];
  collectParts(msg.payload, parts);
  const plain = parts.find((p) => p.type.startsWith('text/plain'));
  const html = parts.find((p) => p.type.startsWith('text/html'));
  const text = plain ? plain.text : html ? htmlToText(html.text) : (msg.snippet || '');
  return {
    id: msg.id,
    fromName: nameMatch ? nameMatch[1].trim() : '',
    email, domain,
    subject: headers.subject || '',
    time: Number(msg.internalDate) || Date.parse(headers.date) || Date.now(),
    text: text.slice(0, 20000),
  };
}

const NUM = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
const CUR = '(₪|ש"ח|ש״ח|ILS|NIS|\\$|USD|€|EUR|£|GBP)';
const AMOUNT_RE = new RegExp(`${CUR}\\s?${NUM}|${NUM}\\s?${CUR}`, 'g');
const TOTAL_RE = /סה["״]?כ|סך הכל|סך הכול|לתשלום|סכום החיוב|סכום העסקה|שולם|total|amount paid|amount charged|amount due|you paid|charged/i;
const REFUND_RE = /זיכוי|החזר כספי|refund/i;

function symbol(raw) {
  const r = raw.toUpperCase();
  if (r === '$' || r === 'USD') return '$';
  if (r === '€' || r === 'EUR') return '€';
  if (r === '£' || r === 'GBP') return '£';
  return '₪';
}

// Every amount in the text, with whether a "total" label sits just before it.
export function findAmounts(text) {
  const t = text.replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/ /g, ' ');
  const out = [];
  for (const m of t.matchAll(AMOUNT_RE)) {
    const raw = m[2] || m[3];
    const value = parseFloat(raw.replace(/,/g, ''));
    if (!(value > 0) || value > 200000) continue;
    const before = t.slice(Math.max(0, m.index - 50), m.index);
    out.push({ value, currency: symbol(m[1] || m[4]), total: TOTAL_RE.test(before), index: m.index });
  }
  return out;
}

const GENERIC_SENDER = /^(no-?reply|noreply|receipts?|billing|invoices?|payments?|orders?|info|support|service|team|account|קבלות|חשבוניות)$/i;

export function merchantOf({ fromName, domain }) {
  const name = (fromName || '').replace(/\s+(via|from|team|receipts?|billing|payments?)\b.*$/i, '').trim();
  if (name && !GENERIC_SENDER.test(name) && !/@/.test(name)) return name.slice(0, 40);
  const host = domain.split('.').filter((p) => !['com', 'co', 'il', 'net', 'org', 'io', 'app', 'so', 'mail', 'email', 'e', 'em', 'info', 'www'].includes(p));
  const label = host[host.length - 1] || domain;
  return label ? label[0].toUpperCase() + label.slice(1) : 'קבלה';
}

export function serviceForDomain(domain) {
  const d = String(domain || '').toLowerCase();
  const key = Object.keys(DOMAIN_SERVICE).find((k) => d === k || d.endsWith(`.${k}`));
  return key ? DOMAIN_SERVICE[key] : null;
}

// One message → a suggestion, or null when no amount can be found.
export function parseReceipt(m) {
  if (!m) return null;
  const hay = `${m.subject}\n${m.text}`;
  if (REFUND_RE.test(m.subject)) return null;
  const amounts = findAmounts(hay);
  if (!amounts.length) return null;
  const totals = amounts.filter((a) => a.total);
  const pick = (totals.length ? totals : amounts).reduce((a, b) => (b.value > a.value ? b : a));
  return {
    id: `gmail:${m.id}`,
    amount: pick.value,
    currency: pick.currency,
    merchant: merchantOf(m),
    domain: m.domain,
    serviceId: serviceForDomain(m.domain),
    subject: m.subject,
    time: m.time,
    source: 'gmail',
  };
}

const DAY = 86400000;
const isoDate = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Receipts that look like a subscription: a known service, or the same
// sender charging a similar amount about a month (or a year) apart.
export function detectRecurring(receipts) {
  const groups = new Map();
  receipts.forEach((r) => {
    const key = r.serviceId || r.domain || r.merchant;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  const out = [];
  groups.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.time - b.time);
    const last = sorted[sorted.length - 1];
    let cycle = null;
    if (sorted.length >= 2) {
      const gaps = sorted.slice(1).map((r, i) => (r.time - sorted[i].time) / DAY);
      const similar = sorted.every((r) => Math.abs(r.amount - last.amount) <= Math.max(1, last.amount * 0.1));
      if (similar && gaps.every((g) => g >= 25 && g <= 35)) cycle = 'monthly';
      else if (similar && gaps.every((g) => g >= 350 && g <= 380)) cycle = 'yearly';
    }
    if (!cycle && last.serviceId) cycle = 'monthly';
    if (!cycle) return;
    const next = new Date(last.time);
    if (cycle === 'monthly') next.setMonth(next.getMonth() + 1); else next.setFullYear(next.getFullYear() + 1);
    out.push({
      key: `sub:${last.serviceId || last.domain || last.merchant}`,
      merchant: last.merchant, serviceId: last.serviceId, domain: last.domain,
      amount: last.amount, currency: last.currency, cycle, count: sorted.length,
      lastTime: last.time, nextDate: isoDate(next.getTime()),
      receiptIds: sorted.map((r) => r.id),
    });
  });
  return out.sort((a, b) => b.lastTime - a.lastTime);
}
