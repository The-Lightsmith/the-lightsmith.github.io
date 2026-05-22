// sheets.js — Google Sheets via Apps Script proxy (no OAuth needed)
import { CONFIG } from './config.js';

async function call(action, extra = {}) {
  const res = await fetch(CONFIG.SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) throw new Error(`Script error ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Script returned error');
  return data;
}

export async function appendRows(rows) {
  await call('append', { rows });
}

export async function getYTDTotals() {
  try {
    const data = await call('ytd');
    return { income: data.income, expenses: data.expenses, net: data.net };
  } catch {
    return null;
  }
}

// Kept so nothing else breaks — no-ops now that there's no auth
export function isConnected() { return !!CONFIG.SCRIPT_URL && CONFIG.SCRIPT_URL !== 'PASTE_SCRIPT_URL_HERE'; }
export function disconnect() {}
