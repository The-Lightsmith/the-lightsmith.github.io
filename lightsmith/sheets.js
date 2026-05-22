// sheets.js — Google Sheets via GIS Token Client + Sheets REST API
import { CONFIG } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_KEY = 'ls_gsheet_token';

// ── GIS Token Client ──────────────────────────────────────────────────────────

let _tokenClient = null;
let _resolveAuth = null;

function initTokenClient() {
  if (_tokenClient) return _tokenClient;
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.OAUTH_CLIENT_ID,
    scope: SCOPES,
    callback(response) {
      if (!_resolveAuth) return;
      if (response.error) {
        _resolveAuth({ ok: false, error: response.error });
      } else {
        localStorage.setItem(TOKEN_KEY, JSON.stringify({
          access_token: response.access_token,
          expires_at: Date.now() + (response.expires_in * 1000),
        }));
        _resolveAuth({ ok: true });
      }
      _resolveAuth = null;
    },
  });
  return _tokenClient;
}

export function startOAuthFlow() {
  return new Promise(resolve => {
    _resolveAuth = resolve;
    initTokenClient().requestAccessToken();
  });
}

// ── Token management ───────────────────────────────────────────────────────────

export function getToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const tok = JSON.parse(raw);
    if (Date.now() > tok.expires_at - 60_000) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return tok.access_token;
  } catch {
    return null;
  }
}

export function isConnected() {
  return getToken() !== null;
}

export function disconnect() {
  const token = getToken();
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
  localStorage.removeItem(TOKEN_KEY);
}

// ── Sheets API ─────────────────────────────────────────────────────────────────

export async function appendRows(rows) {
  const token = getToken();
  if (!token) throw new Error('AUTH_EXPIRED');

  const range = encodeURIComponent(`${CONFIG.SHEET_NAME}!A:H`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: rows }),
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error('AUTH_EXPIRED');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Sheets API error ${res.status}`);
  }

  return res.json();
}

export async function getYTDTotals() {
  const token = getToken();
  if (!token) return null;

  const range = encodeURIComponent(`${CONFIG.SHEET_NAME}!A:D`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${range}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const rows = data.values || [];
  const fullYear = new Date().getFullYear().toString();

  let income = 0;
  let expenses = 0;

  for (const row of rows.slice(1)) {
    const [date, , type, amount] = row;
    if (!date || !type || !amount) continue;

    const m = String(date).match(/\d{2}\/\d{2}\/(\d{2,4})/);
    if (!m) continue;
    const rowYear = m[1].length === 2 ? '20' + m[1] : m[1];
    if (rowYear !== fullYear) continue;

    const amt = parseFloat(String(amount).replace(/[,$]/g, ''));
    if (isNaN(amt)) continue;

    if (type === 'Income') income += amt;
    else if (type === 'Expense') expenses += amt;
  }

  return { income, expenses, net: income - expenses };
}
