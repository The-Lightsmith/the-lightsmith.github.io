// sheets.js — Google Sheets OAuth PKCE + API read/write
import { CONFIG } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_KEY = 'ls_gsheet_token';

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => chars[b % chars.length]).join('');
}

async function sha256(plain) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── OAuth flow ─────────────────────────────────────────────────────────────────

export async function startOAuthFlow() {
  const verifier = generateVerifier();
  const challenge = base64url(await sha256(verifier));
  sessionStorage.setItem('ls_pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CONFIG.OAUTH_CLIENT_ID,
    redirect_uri: CONFIG.REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (error || !code) return false;

  const verifier = sessionStorage.getItem('ls_pkce_verifier');
  if (!verifier) return false;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CONFIG.OAUTH_CLIENT_ID,
        redirect_uri: CONFIG.REDIRECT_URI,
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
      }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({
        access_token: data.access_token,
        expires_at: Date.now() + data.expires_in * 1000,
      })
    );
  } catch {
    return false;
  } finally {
    sessionStorage.removeItem('ls_pkce_verifier');
    window.history.replaceState({}, '', window.location.pathname);
  }

  return true;
}

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
  localStorage.removeItem(TOKEN_KEY);
}

// ── Sheets API ─────────────────────────────────────────────────────────────────

export async function appendRows(rows) {
  const token = getToken();
  if (!token) throw new Error('NOT_AUTH');

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
