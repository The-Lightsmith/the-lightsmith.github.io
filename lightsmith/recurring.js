// recurring.js — recurring monthly expense entries

const STORAGE_KEY = 'ls_recurring_entries';
const LAST_MONTH_KEY = 'ls_last_recurring_month';

const DEFAULT_ENTRIES = [
  { id: 'gws',    desc: 'Google Workspace',   amount: 9.03,  cat: 'Software & Subscriptions', payment: 'Bluevine Checking 5066 (Business)', on: true },
  { id: 'claude', desc: 'Claude for website', amount: 20.00, cat: 'Software & Subscriptions', payment: 'Bluevine Checking 5066 (Business)', on: true },
  { id: 'gads',   desc: 'Google Ads',         amount: 10.00, cat: 'Advertising & Marketing', payment: 'Bluevine Checking 5066 (Business)', on: true },
];

export const ALL_CATEGORIES = [
  'Advertising & Marketing',
  'Gas & Fuel',
  'Insurance',
  'Other Expenses',
  'Payment Processing Fees',
  'Software & Subscriptions',
  'Supplies & Materials',
  'Tools & Equipment',
];

export const ALL_PAYMENTS = [
  'Bluevine Checking 5066 (Business)',
  'Venmo',
  'Cash',
  'Zelle',
  'Square',
  'Check',
];

// ── Persistence ────────────────────────────────────────────────────────────────

export function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [...DEFAULT_ENTRIES];
  } catch {
    return [...DEFAULT_ENTRIES];
  }
}

export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ── Last-run guard ─────────────────────────────────────────────────────────────

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getLastRunMonth() {
  return localStorage.getItem(LAST_MONTH_KEY) || '';
}

export function markMonthRun() {
  localStorage.setItem(LAST_MONTH_KEY, currentMonthKey());
}

export function monthLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Sheet row builder ──────────────────────────────────────────────────────────

export function toSheetRows(entries, date) {
  return entries
    .filter(e => e.on)
    .map(e => [
      date,
      e.desc,
      'Expense',
      e.amount,
      e.cat,
      e.payment,
      'Recurring monthly',
      '',
    ]);
}

// ── UI renderer ────────────────────────────────────────────────────────────────

export function renderEntries(entries, container, onChange) {
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-msg">No recurring entries. Add one below.</p>';
    return;
  }

  container.innerHTML = entries
    .map(
      (e, i) => `
    <div class="recurring-item ${e.on ? '' : 'off'}" data-index="${i}">
      <div class="recurring-info">
        <span class="recurring-desc">${escHtml(e.desc)}</span>
        <span class="recurring-meta">${e.cat} · $${e.amount.toFixed(2)}</span>
      </div>
      <label class="toggle" aria-label="Toggle ${escHtml(e.desc)}">
        <input type="checkbox" class="toggle-input" data-index="${i}" ${e.on ? 'checked' : ''}>
        <span class="toggle-track"></span>
      </label>
      <button class="icon-btn delete-btn" data-index="${i}" aria-label="Remove">✕</button>
    </div>`
    )
    .join('');

  container.querySelectorAll('.toggle-input').forEach(cb => {
    cb.addEventListener('change', e => {
      entries[+e.target.dataset.index].on = e.target.checked;
      const item = container.querySelector(`.recurring-item[data-index="${e.target.dataset.index}"]`);
      item.classList.toggle('off', !e.target.checked);
      saveEntries(entries);
      onChange(entries);
    });
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.currentTarget.dataset.index;
      entries.splice(idx, 1);
      saveEntries(entries);
      renderEntries(entries, container, onChange);
      onChange(entries);
    });
  });
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
