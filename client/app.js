// --- Simple state & helpers ---
const $ = (id) => document.getElementById(id);
const state = {
  apiBase: localStorage.getItem('API_BASE') || 'http://localhost:4000',
  demoUser: localStorage.getItem('DEMO_USER') || '64f000000000000000000001',
  accounts: [],
  accountMap: {}
};

function saveSettings() {
  state.apiBase = $('apiBase').value.trim();
  state.demoUser = $('demoUser').value.trim();
  localStorage.setItem('API_BASE', state.apiBase);
  localStorage.setItem('DEMO_USER', state.demoUser);
}

function fmtMoney(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
function startOfMonth(y, m) { return new Date(Date.UTC(y, m - 1, 1)); }
function endOfMonth(y, m) { return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); }

// --- API wrapper with demo auth header ---
async function api(path, { method = 'GET', body } = {}) {
  const url = `${state.apiBase}${path}`;
  const opts = {
    method,
    headers: { 'x-demo-user': state.demoUser }
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText} – ${txt}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// --- Tabs ---
const tabsNav = $('tabs');
tabsNav.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');

  const target = e.target.dataset.tab;
  document.querySelectorAll('.tab').forEach(sec => sec.classList.add('hidden'));
  $(target).classList.remove('hidden');

  if (target === 'accounts') loadAccounts();
  if (target === 'transactions') { loadAccountsForTx(); loadTransactions(); }
  if (target === 'budgets') { setDefaultPeriodFields(); loadBudgetUI(); }
  if (target === 'summary') { setDefaultPeriodFields(); }
});

// --- Settings UI ---
function hydrateSettings() {
  $('apiBase').value = state.apiBase;
  $('demoUser').value = state.demoUser;
  $('saveSettings').onclick = () => {
    saveSettings();
    $('settingsMsg').innerText = 'Saved.';
    setTimeout(() => ($('settingsMsg').innerText = ''), 1500);
  };
  $('ping').onclick = async () => {
    try {
      const data = await api('/health');
      $('pingResult').innerText = `Connected: ${JSON.stringify(data)}`;
    } catch (err) {
      $('pingResult').innerText = `Failed: ${err.message}`;
    }
  };
}

// --- Accounts ---
async function loadAccounts() {
  try {
    const items = await api('/accounts');
    state.accounts = items;
    state.accountMap = Object.fromEntries(items.map(a => [a._id, a]));
    const rows = $('accountRows');
    rows.innerHTML = items.map(a => `
      <tr>
        <td>${a.name}</td>
        <td><span class="pill">${a.type}</span></td>
        <td>${a.currency}</td>
      </tr>
    `).join('') || `<tr><td colspan="3" class="muted">No accounts yet.</td></tr>`;
  } catch (err) {
    $('accountMsg').innerText = err.message;
  }
}

$('addAccount').onclick = async () => {
  try {
    const name = $('accName').value.trim();
    const type = $('accType').value;
    const currency = $('accCurrency').value.trim() || 'USD';
    if (!name) throw new Error('Name is required');
    const item = await api('/accounts', { method: 'POST', body: { name, type, currency } });
    $('accountMsg').innerText = 'Account created.';
    $('accName').value = '';
    await loadAccounts();
    await loadAccountsForTx();
  } catch (err) {
    $('accountMsg').innerText = err.message;
  }
};

// --- Transactions ---
async function loadAccountsForTx() {
  if (!state.accounts.length) await loadAccounts();
  const sel = $('txAccount');
  sel.innerHTML = state.accounts.map(a => `<option value="${a._id}">${a.name} (${a.type})</option>`).join('');
}

$('addTx').onclick = async () => {
  try {
    const accountId = $('txAccount').value;
    const date = $('txDate').value;
    const amount = Number($('txAmount').value);
    const category = $('txCategory').value.trim();
    const note = $('txNote').value.trim();
    if (!accountId || !date || !category || Number.isNaN(amount)) {
      throw new Error('Account, date, amount, and category are required.');
    }
    await api('/transactions', { method: 'POST', body: { accountId, date, amount, category, note } });
    $('txMsg').innerText = 'Added.';
    $('txDate').value = ''; $('txAmount').value = ''; $('txCategory').value = ''; $('txNote').value = '';
    await loadTransactions();
  } catch (err) {
    $('txMsg').innerText = err.message;
  }
};

$('refreshTx').onclick = loadTransactions;

async function loadTransactions() {
  try {
    const limit = Number($('txLimit').value || 100);
    const items = await api(`/transactions?limit=${limit}`);
    const rows = $('txRows');
    rows.innerHTML = items.map(t => `
      <tr>
        <td>${new Date(t.date).toLocaleDateString()}</td>
        <td>${state.accountMap[t.accountId]?.name || '—'}</td>
        <td class="right ${t.amount < 0 ? 'danger' : 'success'}">${fmtMoney(t.amount)}</td>
        <td>${t.category}</td>
        <td>${t.note || ''}</td>
        <td class="right"><button class="small" data-del="${t._id}">Delete</button></td>
      </tr>
    `).join('') || `<tr><td colspan="6" class="muted">No transactions yet.</td></tr>`;

    // wire delete buttons
    rows.querySelectorAll('button[data-del]').forEach(btn => {
      btn.onclick = async () => {
        try {
          await api(`/transactions/${btn.dataset.del}`, { method: 'DELETE' });
          await loadTransactions();
        } catch (err) {
          alert(err.message);
        }
      };
    });
  } catch (err) {
    $('txMsg').innerText = err.message;
  }
}

// --- Budgets ---
function setDefaultPeriodFields() {
  const now = new Date();
  $('bdgYear').value = $('sumYear').value = now.getUTCFullYear();
  $('bdgMonth').value = $('sumMonth').value = now.getUTCMonth() + 1;
}

$('loadBudget').onclick = loadBudgetUI;
$('saveBudget').onclick = saveBudget;

async function loadBudgetUI() {
  try {
    const y = Number($('bdgYear').value);
    const m = Number($('bdgMonth').value);
    const doc = await api(`/budgets/${y}/${m}`);
    const lines = (doc.limits || []).map(l => `${l.category},${l.limit}`).join('\n');
    $('bdgLines').value = lines;
    renderBudgetRows(doc.limits || []);
    $('bdgMsg').innerText = '';
  } catch (err) {
    // 404 is fine (no budget yet)
    $('bdgLines').value = '';
    $('bdgRows').innerHTML = `<tr><td colspan="2" class="muted">No budget set for this month.</td></tr>`;
    $('bdgMsg').innerText = err.message.includes('404') ? 'No budget for this month yet.' : err.message;
  }
}

function parseBudgetLines() {
  return $('bdgLines').value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [category, limit] = line.split(',').map(s => s.trim());
      return { category, limit: Number(limit) };
    })
    .filter(x => x.category && !Number.isNaN(x.limit));
}

function renderBudgetRows(limits) {
  $('bdgRows').innerHTML = (limits && limits.length)
    ? limits.map(l => `<tr><td>${l.category}</td><td class="right">${fmtMoney(l.limit)}</td></tr>`).join('')
    : `<tr><td colspan="2" class="muted">No categories yet.</td></tr>`;
}

async function saveBudget() {
  try {
    const y = Number($('bdgYear').value);
    const m = Number($('bdgMonth').value);
    const limits = parseBudgetLines();
    const doc = await api(`/budgets/${y}/${m}`, { method: 'PUT', body: { limits } });
    renderBudgetRows(doc.limits || []);
    $('bdgMsg').innerText = 'Saved.';
    setTimeout(() => ($('bdgMsg').innerText = ''), 1500);
  } catch (err) {
    $('bdgMsg').innerText = err.message;
  }
}

// --- Summary (client-side aggregation) ---
$('runSummary').onclick = runSummary;

async function runSummary() {
  try {
    const y = Number($('sumYear').value);
    const m = Number($('sumMonth').value);
    const from = startOfMonth(y, m).toISOString();
    const to = endOfMonth(y, m).toISOString();

    // Pull transactions for the month
    const tx = await api(`/transactions?from=${from}&to=${to}&limit=1000`);
    // Pull budget (optional)
    let budgetDoc = null;
    try { budgetDoc = await api(`/budgets/${y}/${m}`); } catch { /* no budget */ }

    // Group expenses (amount < 0) by category
    const totals = {};
    tx.forEach(t => {
      if (t.amount < 0) {
        totals[t.category] = (totals[t.category] || 0) + t.amount; // negative numbers
      }
    });

    // Build rows with optional budget comparison
    const limits = Object.fromEntries((budgetDoc?.limits || []).map(l => [l.category, l.limit]));
    const categories = Object.keys(totals).sort((a, b) => totals[a] - totals[b]); // most negative first
    const rows = $('sumRows');
    rows.innerHTML = categories.map(cat => {
      const spent = totals[cat]; // negative
      const limit = limits[cat] ?? null;
      const variance = limit != null ? limit + spent : null; // spent is negative
      return `
        <tr>
          <td>${cat}</td>
          <td class="right danger">${fmtMoney(spent)}</td>
          <td class="right">${limit != null ? fmtMoney(limit) : ''}</td>
          <td class="right ${variance != null && variance < 0 ? 'danger' : 'success'}">
            ${variance != null ? fmtMoney(variance) : ''}
          </td>
        </tr>`;
    }).join('') || `<tr><td colspan="4" class="muted">No expenses this month.</td></tr>`;
  } catch (err) {
    alert(err.message);
  }
}

// --- Boot ---
function boot() {
  hydrateSettings();
  setDefaultPeriodFields();
  // Default to Settings first; you can switch tabs after saving
}
document.addEventListener('DOMContentLoaded', boot);