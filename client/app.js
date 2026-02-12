// --- Simple state & helpers ---
const $ = (id) => document.getElementById(id);

const state = {
  apiBase: localStorage.getItem('API_BASE') || 'http://localhost:4000',
  accounts: [],
  accountMap: {}
};

function saveSettings() {
  state.apiBase = $('apiBase').value.trim();
  localStorage.setItem('API_BASE', state.apiBase);
}

function fmtMoney(n, currency = 'USD') {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  return n.toLocaleString(undefined, { style: 'currency', currency });
}
function startOfMonth(y, m) { return new Date(Date.UTC(y, m - 1, 1)); }
function endOfMonth(y, m) { return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); }

function setMsg(id, text, kind = 'info') {
  const el = $(id);
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('danger', kind === 'error');
  el.classList.toggle('success', kind === 'success');
}

async function withPending(btn, fn) {
  const original = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Working…';
  try { return await fn(); }
  finally { btn.disabled = false; btn.innerText = original; }
}

// --- API wrapper (JWT via HttpOnly cookie, friendly errors) ---
export async function api(path, { method = 'GET', body } = {}) {
  const url = `${state.apiBase}${path}`;

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'   // ⭐ send cookies with every request
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg =
      (data && data.error)
        ? data.error
        : (typeof data === 'string' && data ? data : `${res.status} ${res.statusText}`);
    throw new Error(msg);
  }

  return data;
}

// --- Tabs ---
const tabsNav = $('tabs');

if (tabsNav) {
  tabsNav.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;

    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const target = e.target.dataset.tab;
    document.querySelectorAll('.tab').forEach(sec => sec.classList.add('hidden'));
    $(target).classList.remove('hidden');

    if (target === 'accounts') loadAccounts();
    if (target === 'transactions') { 
      setDefaultTxFilters(); 
      loadAccountsForTx(); 
      loadTransactions(); 
    }
    if (target === 'budgets') { 
      setDefaultPeriodFields(); 
      loadBudgetUI(); 
    }

    if (target === 'summary') {
      const now = new Date();
      $('sumYear').value = now.getFullYear();
      $('sumMonth').value = now.getMonth() + 1;
      runSummary();

      $('prevMonth').onclick = () => {
        let year = Number($('sumYear').value);
        let month = Number($('sumMonth').value);

        month -= 1;
        if (month < 1) {
          month = 12;
          year -= 1;
        }

        $('sumYear').value = year;
        $('sumMonth').value = month;

        runSummary();
      };

      $('nextMonth').onclick = () => {
        let year = Number($('sumYear').value);
        let month = Number($('sumMonth').value);

        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }

        $('sumYear').value = year;
        $('sumMonth').value = month;

        runSummary();
      };
    }
  });
}
// --- Settings UI ---
function hydrateSettings() {
  const apiBaseInput = $('apiBase');
  if (apiBaseInput) {
    apiBaseInput.value = state.apiBase;
  }

  const saveBtn = $('saveSettings');
  if (saveBtn) {
    saveBtn.onclick = () => {
      saveSettings();
      setMsg('settingsMsg', 'Saved.', 'success');
      setTimeout(() => setMsg('settingsMsg', ''), 1500);
    };
  }
}

// --- Ping button (only if present) ---
const pingBtn = $('ping');
if (pingBtn) {
  pingBtn.onclick = async () => {
    setMsg('pingResult', 'Testing…');
    try {
      const data = await api('/health');
      setMsg('pingResult', `Connected: ${JSON.stringify(data)}`, 'success');
    } catch (err) {
      setMsg('pingResult', err.message, 'error');
    }
  };
}

// --- Optional presets (only if present) ---
const useLocal = $('useLocal');
if (useLocal) {
  useLocal.onclick = () => {
    $('apiBase').value = 'http://localhost:4000';
    $('saveSettings').click();
  };
}

const useProd = $('useProd');
if (useProd) {
  useProd.onclick = () => {
    $('apiBase').value = 'https://your-api.onrender.com';
    $('saveSettings').click();
  };
}

// --- Accounts ---
async function loadAccounts() {
  try {
    setMsg('accountMsg', 'Loading…');
    const items = await api('/accounts');
    state.accounts = items;
    state.accountMap = Object.fromEntries(items.map(a => [a._id, a]));
    const rows = $('accountRows');
    rows.innerHTML = items.length
      ? items.map(a => `
        <tr>
          <td>${a.name}</td>
          <td><span class="pill">${a.type}</span></td>
          <td>${a.currency}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="3" class="muted">No accounts yet.</td></tr>`;
    setMsg('accountMsg', '');
  } catch (err) {
    setMsg('accountMsg', err.message, 'error');
  }
}

const addAccountBtn = $('addAccount');
if (addAccountBtn) {
  addAccountBtn.onclick = () =>
    withPending(addAccountBtn, async () => {
      setMsg('accountMsg', '');
      try {
        const name = $('accName').value.trim();
        const type = $('accType').value;
        const currency = $('accCurrency').value.trim() || 'USD';
        if (!name) throw new Error('Name is required');

        await api('/accounts', { method: 'POST', body: { name, type, currency } });
        setMsg('accountMsg', 'Account created.', 'success');
        $('accName').value = '';
        $('accName').focus();
        await loadAccounts();
        await loadAccountsForTx();
      } catch (err) {
        setMsg('accountMsg', err.message, 'error');
      }
    });
}

// --- Transactions ---
async function loadAccountsForTx() {
  if (!state.accounts.length) await loadAccounts();
  const sel = $('txAccount');
  if (sel) {
    sel.innerHTML = state.accounts
      .map(a => `<option value="${a._id}">${a.name} (${a.type})</option>`)
      .join('');
  }
}

function setDefaultTransactionDate() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const el = $('txDate');
  if (el && !el.value) el.value = `${yyyy}-${mm}-${dd}`;
}

function setDefaultTxFilters() {
  const now = new Date();
  const fy = $('fltYear');
  const fm = $('fltMonth');
  if (fy) fy.value = now.getUTCFullYear();
  if (fm) fm.value = now.getUTCMonth() + 1;

  const fc = $('fltCategory');
  if (fc && !fc.value) fc.value = '';

  setDefaultTransactionDate();
}

// --- Add Transaction ---
const addTxBtn = $('addTx');
if (addTxBtn) {
  addTxBtn.onclick = () =>
    withPending(addTxBtn, async () => {
      setMsg('txMsg', '');
      try {
        const accountId = $('txAccount').value;
        const date = $('txDate').value;
        const amount = Number($('txAmount').value);
        const category = $('txCategory').value.trim();
        const note = $('txNote').value.trim();

        if (!accountId || !date || !category || Number.isNaN(amount)) {
          throw new Error('Account, date, amount, and category are required.');
        }
        if (amount === 0) throw new Error('Amount cannot be 0.');

        await api('/transactions', {
          method: 'POST',
          body: { accountId, date, amount, category, note }
        });

        setMsg('txMsg', 'Added.', 'success');
        $('txDate').value = '';
        $('txAmount').value = '';
        $('txCategory').value = '';
        $('txNote').value = '';
        $('txCategory').focus();

        await loadTransactions();
      } catch (err) {
        setMsg('txMsg', err.message, 'error');
      }
    });
}

// --- Apply Filters ---
const applyFiltersBtn = $('applyFilters');
if (applyFiltersBtn) {
  applyFiltersBtn.onclick = () =>
    withPending(applyFiltersBtn, loadTransactions);
}

// --- Refresh Transactions ---
const refreshTxBtn = $('refreshTx');
if (refreshTxBtn) {
  refreshTxBtn.onclick = () =>
    withPending(refreshTxBtn, loadTransactions);
}

// --- Load Transactions ---
async function loadTransactions() {
  try {
    const limit = Number(($('txLimit') || {}).value || 100);

    const y = Number(($('fltYear') || {}).value || 0);
    const m = Number(($('fltMonth') || {}).value || 0);
    const cat = (($('fltCategory') || {}).value || '').trim();

    let query = `?limit=${limit}`;
    if (y && m) {
      const from = startOfMonth(y, m).toISOString();
      const to = endOfMonth(y, m).toISOString();
      query += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }
    if (cat) query += `&category=${encodeURIComponent(cat)}`;

    setMsg('txMsg', 'Loading…');
    const items = await api(`/transactions${query}`);

    const rows = $('txRows');
    if (rows) {
      rows.innerHTML = items.length
        ? items.map(t => `
          <tr>
            <td>${new Date(t.date).toLocaleDateString()}</td>
            <td>${state.accountMap[t.accountId]?.name || '—'}</td>
            <td class="right ${t.amount < 0 ? 'danger' : 'success'}">${fmtMoney(t.amount)}</td>
            <td>${t.category}</td>
            <td>${t.note || ''}</td>
            <td class="right"><button class="small" data-del="${t._id}">Delete</button></td>
          </tr>
        `).join('')
        : `<tr><td colspan="6" class="muted">No transactions found.</td></tr>`;

      // confirm-before-delete
      rows.querySelectorAll('button[data-del]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Delete this transaction?')) return;
          try {
            await api(`/transactions/${btn.dataset.del}`, { method: 'DELETE' });
            await loadTransactions();
          } catch (err) {
            setMsg('txMsg', err.message, 'error');
          }
        };
      });
    }

    setMsg('txMsg', '');
  } catch (err) {
    setMsg('txMsg', err.message, 'error');
  }
}

// --- Budgets ---
function setDefaultPeriodFields() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if ($('bdgYear')) $('bdgYear').value = year;
  if ($('bdgMonth')) $('bdgMonth').value = month;
  if ($('sumYear')) $('sumYear').value = year;
  if ($('sumMonth')) $('sumMonth').value = month;
}

// --- Load Budget button ---
const loadBudgetBtn = $('loadBudget');
if (loadBudgetBtn) {
  loadBudgetBtn.onclick = () =>
    withPending(loadBudgetBtn, loadBudgetUI);
}

// --- Save Budget button ---
const saveBudgetBtn = $('saveBudget');
if (saveBudgetBtn) {
  saveBudgetBtn.onclick = () =>
    withPending(saveBudgetBtn, saveBudget);
}

async function loadBudgetUI() {
  try {
    const y = Number($('bdgYear').value);
    const m = Number($('bdgMonth').value);
    setMsg('bdgMsg', 'Loading…');
    const doc = await api(`/budgets/${y}/${m}`);
    const lines = (doc.limits || []).map(l => `${l.category},${l.limit}`).join('\n');
    $('bdgLines').value = lines;
    renderBudgetRows(doc.limits || []);
    setMsg('bdgMsg', '');
  } catch (err) {
    $('bdgLines').value = '';
    $('bdgRows').innerHTML = `<tr><td colspan="2" class="muted">No budget set for this month.</td></tr>`;
    if (String(err.message).includes('No budget')) {
      setMsg('bdgMsg', 'No budget for this month yet.', 'info');
    } else {
      setMsg('bdgMsg', err.message, 'error');
    }
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
    setMsg('bdgMsg', 'Saved.', 'success');
    setTimeout(() => setMsg('bdgMsg', ''), 1500);
  } catch (err) {
    setMsg('bdgMsg', err.message, 'error');
  }
}

// --- Summary (Dashboard + Detailed Breakdown in one tab) ---
$('runSummary').onclick = runSummary;

async function runSummary() {
  try {
    const y = Number($('sumYear').value);
    const m = Number($('sumMonth').value);
    // Compute last month
let lastY = y;
let lastM = m - 1;
if (lastM === 0) {
  lastM = 12;
  lastY--;
}

    const from = startOfMonth(y, m).toISOString();
    const to = endOfMonth(y, m).toISOString();

    setMsg('sumMsg', 'Loading…');

    // Pull transactions for the month
    const tx = await api(`/transactions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=2000`);
    // Pull transactions for last month
    const lastFrom = startOfMonth(lastY, lastM).toISOString();
    const lastTo = endOfMonth(lastY, lastM).toISOString();

const lastTx = await api(`/transactions?from=${encodeURIComponent(lastFrom)}&to=${encodeURIComponent(lastTo)}&limit=2000`);

    // Totals + category grouping
    let totalExpenses = 0;
    let totalIncome = 0;
    const byCategory = {};

    tx.forEach(t => {
      if (t.amount < 0) {
        totalExpenses += t.amount; // negative
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
      } else {
        totalIncome += t.amount; // positive
      }
    });

    const net = totalIncome + totalExpenses;

    // Render Month Snapshot
    $('sumTotalExpenses').textContent = fmtMoney(totalExpenses);
    $('sumTotalIncome').textContent = fmtMoney(totalIncome);
    $('sumNet').textContent = fmtMoney(net);
    $('sumNet').classList.toggle('danger', net < 0);
    $('sumNet').classList.toggle('success', net >= 0);

    // Top Categories LAST MONTH
    const lastByCategory = {};
    lastTx.forEach(t => {
      if (t.amount < 0) {
        lastByCategory[t.category] = (lastByCategory[t.category] || 0) + t.amount;
      }
    });

    const lastTop = Object.keys(lastByCategory)
      .map(cat => ({ cat, spent: lastByCategory[cat] }))
      .sort((a, b) => a.spent - b.spent)
      .slice(0, 5);
$('sumTopCats').innerHTML = lastTop.length
  ? lastTop.map(c => `<tr><td>${c.cat}</td><td class="right danger">${fmtMoney(c.spent)}</td></tr>`).join('')
  : `<tr><td colspan="2" class="muted">No expenses last month.</td></tr>`;


// Budget comparison (optional)
let budgetDoc = null;
try { budgetDoc = await api(`/budgets/${y}/${m}`); } catch {}
const limits = Object.fromEntries((budgetDoc?.limits || []).map(l => [l.category, l.limit]));

const categories = Object.keys(byCategory).sort((a, b) => byCategory[a] - byCategory[b]);

$('sumRows').innerHTML = categories.length
  ? categories.map(cat => {
      const spent = byCategory[cat]; // negative
      const limit = limits[cat] ?? null;
      const variance = limit != null ? limit + spent : null;

      let pct = 0;
      if (limit != null && limit > 0) {
        pct = Math.min(100, Math.max(0, (Math.abs(spent) / limit) * 100));
      }

      let barColor = '#4caf50';
      if (pct >= 70 && pct < 100) barColor = '#f0ad4e';
      if (pct >= 100) barColor = '#d9534f';

      return `
        <tr>
          <td>${cat}</td>
          <td class="right danger">${fmtMoney(spent)}</td>
          <td class="right">${limit != null ? fmtMoney(limit) : ''}</td>
          <td class="right ${variance != null && variance < 0 ? 'danger' : 'success'}">
            ${variance != null ? fmtMoney(variance) : ''}

            ${limit != null ? `
              <div class="bar-wrap">
                <div class="bar-fill" style="width:${pct}%; background:${barColor};"></div>
              </div>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('')
  : `<tr><td colspan="4" class="muted">No expenses this month.</td></tr>`;

setMsg('sumMsg', '');

} catch (err) {
  setMsg('sumMsg', err.message, 'error');
}

} // <-- closes runSummary()
