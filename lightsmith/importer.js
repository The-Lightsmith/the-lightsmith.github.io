// importer.js — PDF parsing + vendor categorization for Bluevine statements

// ── Vendor rules (order matters — first match wins) ───────────────────────────

const VENDOR_RULES = [
  { test: /FACEBK|FACEBOOK/i,              clean: 'Facebook Ads',      cat: 'Advertising & Marketing' },
  { test: /GOOGLE\s?\*CLOUD|GOOGLE\*CLOUD/i, clean: 'Google Ads',      cat: 'Advertising & Marketing' },
  { test: /GOOGLE\s?\*Workspace/i,          clean: 'Google Workspace', cat: 'Software & Subscriptions' },
  { test: /GOOGLE\s?\*ADS|GOOGLEADS/i,      clean: 'Google Ads',       cat: 'Advertising & Marketing' },
  { test: /CLAUDE/i,                        clean: 'Claude AI',         cat: 'Software & Subscriptions' },
  { test: /WALMART/i,                       clean: 'Walmart',           cat: 'Supplies & Materials' },
  { test: /AUTOZONE|O'?REILLY|NAPA/i,       clean: null,                cat: 'Supplies & Materials' },
  { test: /AMAZON/i,                        clean: 'Amazon',            cat: 'Supplies & Materials' },
  { test: /SHELL|CHEVRON|EXXON|BP\s|KWIK|CASEY/i, clean: null,         cat: 'Gas & Fuel' },
  { test: /SPOTIFY|NETFLIX|APPLE\.COM\/BILL/i, clean: null,            cat: 'Software & Subscriptions' },
  { test: /ALLSTATE|GEICO|PROGRESSIVE|STATE\s?FARM/i, clean: null,     cat: 'Insurance' },
];

const DEFAULT_CAT = 'Other Expenses';
const DEFAULT_PAYMENT = 'Bluevine Checking 5066 (Business)';

export const ALL_CATEGORIES = [
  'Advertising & Marketing',
  'Gas & Fuel',
  'Insurance',
  'Other Expenses',
  'Payment Processing Fees',
  'Service Income',
  'Software & Subscriptions',
  'Supplies & Materials',
  'Tools & Equipment',
];

// ── Description cleanup ────────────────────────────────────────────────────────

function cleanDescription(raw) {
  // Check named rules first
  for (const rule of VENDOR_RULES) {
    if (rule.test.test(raw) && rule.clean) return rule.clean;
  }

  // Generic cleanup:
  // 1. Strip city/state suffix ", CITY, ST" or ", CITY ST"
  let cleaned = raw.replace(/,\s+[A-Z\s]+,?\s+[A-Z]{2}\s*$/, '').trim();
  // 2. Strip * transaction codes like "*XXXXXXXX"
  cleaned = cleaned.replace(/\*[A-Z0-9_]+/g, '').trim();
  // 3. Strip trailing punctuation/spaces
  cleaned = cleaned.replace(/[,\s]+$/, '').trim();
  // 4. Title case
  cleaned = cleaned.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return cleaned || raw;
}

function categorize(raw) {
  for (const rule of VENDOR_RULES) {
    if (rule.test.test(raw)) {
      return { cat: rule.cat, clean: rule.clean || cleanDescription(raw) };
    }
  }
  return { cat: DEFAULT_CAT, clean: cleanDescription(raw) };
}

// ── PDF parsing ────────────────────────────────────────────────────────────────

// Date format in PDF: MM/DD/YY → convert to MM/DD/YYYY
function expandYear(date) {
  return date.replace(/(\d{2}\/\d{2}\/)(\d{2})$/, (_, prefix, yy) => `${prefix}20${yy}`);
}

const TX_REGEX = /(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+\$(-?[\d,]+\.\d{2})/g;

export async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  const transactions = [];
  let match;
  TX_REGEX.lastIndex = 0;

  while ((match = TX_REGEX.exec(fullText)) !== null) {
    const [, rawDate, rawDesc, rawAmount] = match;

    // Only process expenses (negative amounts = debits from Bluevine checking)
    const amount = parseFloat(rawAmount.replace(/[$,]/g, ''));
    if (amount >= 0) continue; // skip credits/income lines

    const { cat, clean } = categorize(rawDesc);

    transactions.push({
      date: expandYear(rawDate),
      rawDesc,
      description: clean,
      amount: Math.abs(amount),
      category: cat,
      payment: DEFAULT_PAYMENT,
      skip: false,
    });
  }

  return transactions;
}

// ── Review table ───────────────────────────────────────────────────────────────

export function buildReviewTable(transactions, container) {
  if (transactions.length === 0) {
    container.innerHTML = '<p class="empty-msg">No transactions found — make sure this is a Bluevine statement PDF.</p>';
    return;
  }

  const catOptions = ALL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');

  const rows = transactions
    .map(
      (tx, i) => `
    <tr data-index="${i}" class="${tx.skip ? 'skipped' : ''}">
      <td class="mono">${tx.date}</td>
      <td>${escHtml(tx.description)}</td>
      <td class="mono amount">$${tx.amount.toFixed(2)}</td>
      <td>
        <select class="cat-select" data-index="${i}">
          ${ALL_CATEGORIES.map(c => `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </td>
      <td class="center">
        <input type="checkbox" class="skip-check" data-index="${i}" ${tx.skip ? 'checked' : ''} aria-label="Skip">
      </td>
    </tr>`
    )
    .join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="review-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Skip</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Wire up category selects
  container.querySelectorAll('.cat-select').forEach(sel => {
    sel.addEventListener('change', e => {
      transactions[+e.target.dataset.index].category = e.target.value;
    });
  });

  // Wire up skip checkboxes
  container.querySelectorAll('.skip-check').forEach(cb => {
    cb.addEventListener('change', e => {
      const idx = +e.target.dataset.index;
      transactions[idx].skip = e.target.checked;
      const row = container.querySelector(`tr[data-index="${idx}"]`);
      row.classList.toggle('skipped', e.target.checked);
      updateImportCount(transactions, container);
    });
  });

  updateImportCount(transactions, container);
}

function updateImportCount(transactions, container) {
  const btn = document.getElementById('import-btn');
  if (!btn) return;
  const count = transactions.filter(t => !t.skip).length;
  btn.textContent = `Import ${count} row${count !== 1 ? 's' : ''} →`;
  btn.disabled = count === 0;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Build sheet rows from transactions ─────────────────────────────────────────

export function toSheetRows(transactions) {
  return transactions
    .filter(tx => !tx.skip)
    .map(tx => [
      tx.date,
      tx.description,
      'Expense',
      tx.amount,
      tx.category,
      tx.payment,
      '',
      '',
    ]);
}
