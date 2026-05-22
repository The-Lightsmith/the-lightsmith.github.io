// app.js — main app logic, tab switching, auth state, session tracking
import { CONFIG } from './config.js';
import {
  startOAuthFlow,
  isConnected, disconnect,
  appendRows, getYTDTotals,
} from './sheets.js';
import { parsePDF, buildReviewTable, toSheetRows as importToRows } from './importer.js';
import {
  loadEntries, saveEntries, renderEntries,
  toSheetRows as recurringToRows,
  currentMonthKey, getLastRunMonth, markMonthRun, monthLabel,
  ALL_CATEGORIES as RECURRING_CATS, ALL_PAYMENTS,
} from './recurring.js';

// ── Session state ──────────────────────────────────────────────────────────────

const session = { rows: [] };  // rows added this session

// ── Toast ──────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast hidden'; }, 2500);
}

// ── Auth UI ────────────────────────────────────────────────────────────────────

function updateAuthUI() {
  const connected = isConnected();
  const btn = document.getElementById('auth-btn');
  const banner = document.getElementById('not-connected-banner');

  if (connected) {
    btn.textContent = 'Disconnect';
    btn.classList.add('connected');
    banner.classList.add('hidden');
  } else {
    btn.textContent = 'Connect Sheets';
    btn.classList.remove('connected');
    banner.classList.remove('hidden');
  }

  // Hide/show submit buttons based on connection
  document.querySelectorAll('.requires-auth').forEach(el => {
    el.style.display = connected ? '' : 'none';
  });
  document.querySelectorAll('.no-auth-msg').forEach(el => {
    el.style.display = connected ? 'none' : '';
  });
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');

  if (tabId === 'dashboard') refreshDashboard();
}

// ── Today's date in MM/DD/YYYY ─────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// ── Tab 1: Job Logger ──────────────────────────────────────────────────────────

function initJobTab() {
  const form = document.getElementById('job-form');
  const paymentSel = document.getElementById('job-payment');
  const venmoFeeRow = document.getElementById('venmo-fee-row');
  const amountInput = document.getElementById('job-amount');
  const venmoFeePreview = document.getElementById('venmo-fee-preview');

  // Default date to today
  const dateInput = document.getElementById('job-date');
  dateInput.value = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for input[type=date]

  function updateVenmoFee() {
    const isVenmo = paymentSel.value === 'Venmo';
    venmoFeeRow.classList.toggle('hidden', !isVenmo);
    if (isVenmo) {
      const amt = parseFloat(amountInput.value) || 0;
      const fee = +(amt * 0.019 + 0.10).toFixed(2);
      venmoFeePreview.textContent = `Fee: $${fee.toFixed(2)}`;
    }
  }

  paymentSel.addEventListener('change', updateVenmoFee);
  amountInput.addEventListener('input', updateVenmoFee);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!isConnected()) { showToast('Connect Google Sheets first', 'error'); return; }

    const rawDate = dateInput.value; // YYYY-MM-DD
    const [yyyy, mm, dd] = rawDate.split('-');
    const date = `${mm}/${dd}/${yyyy}`;

    const service = document.getElementById('job-service').value;
    const vehicle = document.getElementById('job-vehicle').value.trim();
    const amount = parseFloat(document.getElementById('job-amount').value);
    const payment = paymentSel.value;
    const customer = document.getElementById('job-customer').value.trim();
    const notes = document.getElementById('job-notes').value.trim();
    const venmoFee = document.getElementById('venmo-fee-check').checked && payment === 'Venmo';

    const notesCell = [customer, notes].filter(Boolean).join(' | ');
    const description = vehicle ? `${service} – ${vehicle}` : service;

    const rows = [
      [date, description, 'Income', amount, 'Service Income', payment, notesCell, ''],
    ];

    if (venmoFee) {
      const fee = +(amount * 0.019 + 0.10).toFixed(2);
      rows.push([date, 'Venmo fee (1.9% + $0.10)', 'Expense', fee, 'Payment Processing Fees', 'Venmo', 're: job above', '']);
    }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await appendRows(rows);
      session.rows.push(...rows.map(r => ({ ...Object.fromEntries(['date','desc','type','amount','cat','payment','notes','reimb'].map((k,i) => [k, r[i]])) })));
      showToast('Job logged ✓');
      form.reset();
      dateInput.value = new Date().toISOString().split('T')[0];
      venmoFeeRow.classList.add('hidden');
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') { updateAuthUI(); showToast('Session expired — reconnect', 'error'); }
      else showToast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add to Sheet';
    }
  });
}

// ── Tab 2: Statement Importer ─────────────────────────────────────────────────

let parsedTransactions = [];

function initImportTab() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('pdf-input');
  const reviewArea = document.getElementById('review-area');
  const importBtn = document.getElementById('import-btn');
  const statusMsg = document.getElementById('import-status');

  // Drag & drop
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') processPDF(file);
    else showToast('Please drop a PDF file', 'error');
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processPDF(file);
  });

  importBtn.addEventListener('click', async () => {
    if (!isConnected()) { showToast('Connect Google Sheets first', 'error'); return; }

    const rows = importToRows(parsedTransactions);
    if (rows.length === 0) { showToast('Nothing to import', 'error'); return; }

    importBtn.disabled = true;
    importBtn.textContent = 'Importing…';

    try {
      await appendRows(rows);
      session.rows.push(...rows.map(r => ({ date: r[0], desc: r[1], type: r[2], amount: r[3], cat: r[4], payment: r[5] })));
      showToast(`${rows.length} row${rows.length !== 1 ? 's' : ''} imported ✓`);
      parsedTransactions = [];
      reviewArea.innerHTML = '';
      importBtn.classList.add('hidden');
      statusMsg.textContent = '';
      fileInput.value = '';
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') { updateAuthUI(); showToast('Session expired — reconnect', 'error'); }
      else showToast(`Error: ${err.message}`, 'error');
      importBtn.disabled = false;
      importBtn.textContent = `Import ${rows.length} rows →`;
    }
  });
}

async function processPDF(file) {
  const reviewArea = document.getElementById('review-area');
  const importBtn = document.getElementById('import-btn');
  const statusMsg = document.getElementById('import-status');

  reviewArea.innerHTML = '<p class="loading">Parsing PDF…</p>';
  importBtn.classList.add('hidden');
  statusMsg.textContent = '';

  try {
    parsedTransactions = await parsePDF(file);

    if (parsedTransactions.length === 0) {
      reviewArea.innerHTML = '<p class="empty-msg">No transactions found — make sure this is a Bluevine statement PDF.</p>';
      return;
    }

    buildReviewTable(parsedTransactions, reviewArea);
    const count = parsedTransactions.filter(t => !t.skip).length;
    importBtn.textContent = `Import ${count} row${count !== 1 ? 's' : ''} →`;
    importBtn.classList.remove('hidden');
    statusMsg.textContent = `Found ${parsedTransactions.length} transaction${parsedTransactions.length !== 1 ? 's' : ''}`;
  } catch (err) {
    reviewArea.innerHTML = `<p class="empty-msg error">Error parsing PDF: ${err.message}</p>`;
  }
}

// ── Tab 3: Recurring Entries ──────────────────────────────────────────────────

let recurringEntries = [];

function initRecurringTab() {
  recurringEntries = loadEntries();
  const listContainer = document.getElementById('recurring-list');
  const addBtn = document.getElementById('recurring-add-btn');
  const bigBtn = document.getElementById('recurring-big-btn');
  const addForm = document.getElementById('recurring-add-form');

  renderEntries(recurringEntries, listContainer, entries => {
    recurringEntries = entries;
    updateRecurringButton();
  });

  updateRecurringButton();

  // Toggle add form
  addBtn.addEventListener('click', () => {
    addForm.classList.toggle('hidden');
  });

  // Add form submit
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const desc = document.getElementById('new-desc').value.trim();
    const amount = parseFloat(document.getElementById('new-amount').value);
    const cat = document.getElementById('new-cat').value;
    const payment = document.getElementById('new-payment').value;

    if (!desc || isNaN(amount)) return;

    const entry = {
      id: `custom_${Date.now()}`,
      desc, amount, cat, payment, on: true,
    };

    recurringEntries.push(entry);
    saveEntries(recurringEntries);
    renderEntries(recurringEntries, listContainer, entries => {
      recurringEntries = entries;
      updateRecurringButton();
    });
    updateRecurringButton();
    addForm.reset();
    addForm.classList.add('hidden');
  });

  // Big button
  bigBtn.addEventListener('click', async () => {
    if (!isConnected()) { showToast('Connect Google Sheets first', 'error'); return; }

    const lastMonth = getLastRunMonth();
    const thisMonth = currentMonthKey();

    if (lastMonth === thisMonth) {
      const label = monthLabel();
      if (!confirm(`Already added entries for ${label} — add again?`)) return;
    }

    const rows = recurringToRows(recurringEntries, todayStr());
    if (rows.length === 0) { showToast('No entries are turned on', 'error'); return; }

    bigBtn.disabled = true;
    bigBtn.textContent = 'Adding…';

    try {
      await appendRows(rows);
      session.rows.push(...rows.map(r => ({ date: r[0], desc: r[1], type: r[2], amount: r[3], cat: r[4], payment: r[5] })));
      markMonthRun();
      showToast(`${rows.length} entries added for ${monthLabel()} ✓`);
      updateRecurringButton();
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') { updateAuthUI(); showToast('Session expired — reconnect', 'error'); }
      else showToast(`Error: ${err.message}`, 'error');
    } finally {
      bigBtn.disabled = false;
      updateRecurringButton();
    }
  });
}

function updateRecurringButton() {
  const bigBtn = document.getElementById('recurring-big-btn');
  const count = recurringEntries.filter(e => e.on).length;
  const label = monthLabel();
  const alreadyRan = getLastRunMonth() === currentMonthKey();

  bigBtn.textContent = alreadyRan
    ? `Add again for ${label} (already added) →`
    : `Add this month's entries (${count}) →`;
}

// ── Tab 4: Dashboard ──────────────────────────────────────────────────────────

async function refreshDashboard() {
  const sessionIncome = session.rows.filter(r => r.type === 'Income').reduce((s, r) => s + +r.amount, 0);
  const sessionExpenses = session.rows.filter(r => r.type === 'Expense').reduce((s, r) => s + +r.amount, 0);

  document.getElementById('session-income').textContent = `$${sessionIncome.toFixed(2)}`;
  document.getElementById('session-expenses').textContent = `$${sessionExpenses.toFixed(2)}`;
  document.getElementById('session-net').textContent = `$${(sessionIncome - sessionExpenses).toFixed(2)}`;

  const rowList = document.getElementById('session-rows');
  if (session.rows.length === 0) {
    rowList.innerHTML = '<p class="empty-msg">No rows added this session.</p>';
  } else {
    rowList.innerHTML = [...session.rows].reverse().map(r => `
      <div class="session-row ${r.type === 'Income' ? 'income' : 'expense'}">
        <div class="session-row-info">
          <span class="session-desc">${escHtml(r.desc)}</span>
          <span class="session-meta">${r.date} · ${r.cat}</span>
        </div>
        <span class="session-amount ${r.type === 'Income' ? 'green' : 'red'}">
          ${r.type === 'Income' ? '+' : '-'}$${(+r.amount).toFixed(2)}
        </span>
      </div>`).join('');
  }

  // YTD totals
  const ytdEl = document.getElementById('ytd-totals');
  if (!isConnected()) {
    ytdEl.innerHTML = '<p class="muted">Connect to Google Sheets to see year-to-date totals.</p>';
    return;
  }

  ytdEl.innerHTML = '<p class="loading">Loading year-to-date totals…</p>';
  try {
    const totals = await getYTDTotals();
    if (!totals) { ytdEl.innerHTML = '<p class="muted">Could not load YTD totals.</p>'; return; }
    const year = new Date().getFullYear();
    ytdEl.innerHTML = `
      <h3 class="section-label">${year} Year-to-Date</h3>
      <div class="ytd-grid">
        <div class="ytd-card">
          <span class="ytd-label">Income</span>
          <span class="ytd-value green">$${totals.income.toFixed(2)}</span>
        </div>
        <div class="ytd-card">
          <span class="ytd-label">Expenses</span>
          <span class="ytd-value red">$${totals.expenses.toFixed(2)}</span>
        </div>
        <div class="ytd-card">
          <span class="ytd-label">Net</span>
          <span class="ytd-value ${totals.net >= 0 ? 'green' : 'red'}">$${totals.net.toFixed(2)}</span>
        </div>
      </div>`;
  } catch {
    ytdEl.innerHTML = '<p class="muted">Could not load YTD totals.</p>';
  }
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function triggerConnect() {
  const btn = document.getElementById('auth-btn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  try {
    const { ok } = await startOAuthFlow();
    if (ok) {
      showToast('Connected to Google Sheets ✓');
    } else {
      showToast('Connection cancelled or failed', 'error');
    }
  } catch {
    showToast('Connection failed — try again', 'error');
  }
  updateAuthUI();
}

async function boot() {
  // Wire nav tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Auth button
  document.getElementById('auth-btn').addEventListener('click', async () => {
    if (isConnected()) {
      disconnect();
      updateAuthUI();
      showToast('Disconnected');
    } else {
      await triggerConnect();
    }
  });

  // Banner connect button
  document.getElementById('banner-connect-btn').addEventListener('click', () => triggerConnect());

  // Init tabs
  initJobTab();
  initImportTab();
  initRecurringTab();

  // Update auth UI
  updateAuthUI();
}

document.addEventListener('DOMContentLoaded', boot);
