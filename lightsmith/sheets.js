// sheets.js — Google Sheets via Apps Script proxy
// Writes: no-cors POST (server processes it; browser can't read response — that's fine)
// Reads:  GET with action param (CORS works cleanly for GET)
import { CONFIG } from './config.js';

export async function appendRows(rows) {
  // no-cors: browser can't verify the response but the script still runs and writes the data
  await fetch(CONFIG.SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ action: 'append', rows }),
  });
}

export async function getYTDTotals() {
  try {
    const res = await fetch(`${CONFIG.SCRIPT_URL}?action=ytd`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? { income: data.income, expenses: data.expenses, net: data.net } : null;
  } catch {
    return null;
  }
}

export function isConnected() {
  return !!CONFIG.SCRIPT_URL && CONFIG.SCRIPT_URL !== 'PASTE_SCRIPT_URL_HERE';
}
export function disconnect() {}
