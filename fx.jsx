// Currency conversion — fetch FX rates from a free no-key API once per day,
// cache in localStorage, expose a React hook + pure converter for stats math.

const FX_CACHE_KEY = 'fx-rates-v1';
const FX_API = 'https://open.er-api.com/v6/latest/ILS';
const FX_TTL_MS = 24 * 60 * 60 * 1000;

const SYMBOL_TO_CODE = { '₪': 'ILS', '$': 'USD', '€': 'EUR', '£': 'GBP' };
function symbolToCode(s) { return SYMBOL_TO_CODE[s] || s || 'ILS'; }

async function fetchRates() {
  try {
    const cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY) || 'null');
    if (cached && cached.rates && Date.now() - cached.fetchedAt < FX_TTL_MS) {
      return { rates: cached.rates, fetchedAt: cached.fetchedAt, fromCache: true };
    }
  } catch (e) {}
  try {
    const res = await fetch(FX_API);
    if (!res.ok) throw new Error('rate fetch failed');
    const json = await res.json();
    if (json.result !== 'success' || !json.rates) throw new Error('bad response');
    const out = { rates: json.rates, fetchedAt: Date.now() };
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify(out));
    return { ...out, fromCache: false };
  } catch (e) {
    // Last-resort fallback so the UI still shows reasonable numbers offline.
    // Approximate rates per 1 ILS (Nov 2025-ish).
    return {
      rates: { ILS: 1, USD: 0.27, EUR: 0.25, GBP: 0.21 },
      fetchedAt: 0, fromCache: true, fallback: true,
    };
  }
}

// Convert `amount` from `from` symbol/code to `to` symbol/code using ILS-anchored rates.
// `rates` is the JSON returned by open.er-api.com — rates[CODE] is "how many CODE = 1 ILS".
function convertCurrency(amount, from, to, rates) {
  if (!rates) return amount;
  const f = symbolToCode(from);
  const t = symbolToCode(to);
  if (f === t) return amount;
  const fromRate = rates[f];
  const toRate = rates[t];
  if (!fromRate || !toRate) return amount; // unknown — leave as-is
  const ils = Number(amount) / fromRate;
  return ils * toRate;
}

function useExchangeRates() {
  const [state, setState] = React.useState(null);
  React.useEffect(() => { fetchRates().then(setState); }, []);
  return state; // { rates, fetchedAt, fromCache, fallback }
}

Object.assign(window, { fetchRates, convertCurrency, useExchangeRates, symbolToCode });
