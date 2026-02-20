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

function formatDateForInput(d) {
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

// --- API helper (JWT via HttpOnly cookie, friendly errors) ---
window.api = async function api(path, { method = 'GET', body } = {}) {
  const url = `http://localhost:4000${path}`;

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
  try { data = text ? JSON.parse(text) : null; }
  catch { data = text; }

  // ⭐ Global auth failure handler
  if (data?.error === 'Invalid or expired token') {
    console.warn('Token expired — redirecting to login');
    window.location.href = '/login.html';
    return;
  }

  // ⭐ Friendly error handling
  if (!res.ok) {
    const msg =
      (data && data.error)
        ? data.error
        : (typeof data === 'string' && data ? data : `${res.status} ${res.statusText}`);
    throw new Error(msg);
  }

  return data;   // ⭐ You were also missing this return
}

// --- NEW: Load budget categories ---
async function loadBudgetCategories(year, month) {
  const categories = await api(`/budgets/${year}/${month}/categories`);

  const select = $('txnCategory');
  select.innerHTML = '';

  if (!categories.length) {
    select.innerHTML = `<option value="">No budget categories</option>`;
    return;
  }

  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
}

// --- Tabs ---
const tabsNav = $('tabs');

if (tabsNav) {
  tabsNav.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;

    // Switch active tab button
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    // Show selected tab content
    const target = e.target.dataset.tab;
    document.querySelectorAll('.tab').forEach(sec => sec.classList.add('hidden'));
    $(target)?.classList.remove('hidden');

    // Tab-specific loaders
    if (target === 'accounts') loadAccounts();

    if (target === 'transactions') {
      setDefaultTxFilters();
      loadAccountsForTx();

      const y = Number(($('fltYear') || {}).value || 0);
      const m = Number(($('fltMonth') || {}).value || 0);

      loadBudgetCategories(y, m);
      loadTransactions();
    }   // <-- this closes the transactions block

    // ⭐ THIS is the missing brace you needed
    // It closes the event listener BEFORE the budgets block starts

    if (target === 'budgets') {
      setDefaultPeriodFields();
      loadBudgetUI();
    }

    if (target === 'summary') {
      const now = new Date();
      const sumYear = $('sumYear');
      const sumMonth = $('sumMonth');

      if (sumYear) sumYear.value = now.getFullYear();
      if (sumMonth) sumMonth.value = now.getMonth() + 1;

      runSummary();

      // --- Next Month ---
      const nextBtn = $('nextMonth');
      if (nextBtn) {
        nextBtn.onclick = () => {
          let year = Number(sumYear.value);
          let month = Number(sumMonth.value);

          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }

          sumYear.value = year;
          sumMonth.value = month;

          runSummary();
        };
      }
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
        const category = $('txnCategory').value.trim();
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
        $('txnCategory').value = '';
        $('txNote').value = '';
        $('txnCategory').focus();

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
    withPending(applyFiltersBtn, async () => {
      const y = Number(($('fltYear') || {}).value || 0);
      const m = Number(($('fltMonth') || {}).value || 0);

      await loadBudgetCategories(y, m);
      await loadTransactions();
    });
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
          <tr data-id="${t._id}">
            <td>${new Date(t.date).toLocaleDateString()}</td>
            <td>${state.accountMap[t.accountId]?.name || '—'}</td>
            <td class="right ${t.amount < 0 ? 'danger' : 'success'}">${fmtMoney(t.amount)}</td>
            <td>${t.category}</td>
            <td>${t.note || ''}</td>
            <td class="right">
              <button class="small" data-edit="${t._id}">Edit</button>
              <button class="small" data-del="${t._id}">Delete</button>
            </td>
          </tr>
        `).join('')
        : `<tr><td colspan="6" class="muted">No transactions found.</td></tr>`;

      // ⭐ 1. Wire up EDIT buttons
      rows.querySelectorAll('button[data-edit]').forEach(btn => {
        btn.onclick = () => startEditTransaction(btn.dataset.edit);
      });

      // ⭐ 2. Wire up DELETE buttons (confirm-before-delete)
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

      setMsg('txMsg', '');
    } // ← THIS WAS MISSING
  } catch (err) {
    setMsg('txMsg', err.message, 'error');
  }
}

function startEditTransaction(id) {
  const row = document.querySelector(`#txRows tr[data-id="${id}"]`);
  if (!row) return;

  const cells = row.children;

  const original = {
    date: cells[0].textContent,
    account: cells[1].textContent,
    amount: cells[2].textContent.replace(/[$,]/g, ''),
    category: cells[3].textContent,
    note: cells[4].textContent
  };

  row.innerHTML = `
    <td><input type="date" id="editDate" value="${formatDateForInput(original.date)}"></td>

    <td>
      <select id="editAccount">
        ${state.accounts.map(a => `
          <option value="${a._id}" ${a.name === original.account ? 'selected' : ''}>
            ${a.name} (${a.type})
          </option>
        `).join('')}
      </select>
    </td>

    <td><input type="number" step="0.01" id="editAmount" value="${original.amount}"></td>
    <td><input id="editCategory" value="${original.category}"></td>
    <td><input id="editNote" value="${original.note}"></td>

    <td class="right">
      <button class="small" id="saveTx">Save</button>
      <button class="small" id="cancelTx">Cancel</button>
    </td>
  `;

  // SAVE
  $('saveTx').onclick = async () => {
    try {
      const body = {
        date: $('editDate').value,
        accountId: $('editAccount').value,
        amount: Number($('editAmount').value),
        category: $('editCategory').value.trim(),
        note: $('editNote').value.trim()
      };

      if (!body.date || !body.category || Number.isNaN(body.amount)) {
        throw new Error('Date, amount, and category are required.');
      }
      
      console.log("PATCH body:", body);


      await api(`/transactions/${id}`, {
        method: 'PATCH',
        body
      });

      await loadTransactions();
    } catch (err) {
      setMsg('txMsg', err.message, 'error');
    }
  };

  // CANCEL
  $('cancelTx').onclick = () => loadTransactions();
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

// --- Add Budget Line button ---
const addBudgetBtn = $('addBudgetLine');
if (addBudgetBtn) {
  addBudgetBtn.onclick = () =>
    withPending(addBudgetBtn, addBudgetLine);
}

//Sort Dropdown
const sortSelect = $('bdgSort');
if (sortSelect) {
  sortSelect.onchange = async () => {
    const y = Number($('bdgYear').value);
    const m = Number($('bdgMonth').value);

    try {
      const doc = await api(`/budgets/${y}/${m}`);
      renderBudgetRows(doc.limits || []);
    } catch {
      // ignore if no budget yet
    }
  };
}

// --- Auto-load when year or month changes ---
const bdgYear = $('bdgYear');
const bdgMonth = $('bdgMonth');

if (bdgYear) {
  bdgYear.onchange = () => loadBudgetUI();
}

if (bdgMonth) {
  bdgMonth.onchange = () => loadBudgetUI();
}

const bdgIncome = $('bdgIncome');
if (bdgIncome) {
  bdgIncome.oninput = updateRemainingBudget;
}



// --- Load Budget UI ---
async function loadBudgetUI() {
  try {
    const y = Number($('bdgYear').value);
    const m = Number($('bdgMonth').value);

    setMsg('bdgMsg', 'Loading…');

    const doc = await api(`/budgets/${y}/${m}`);
    renderBudgetRows(doc.limits || []);

    setMsg('bdgMsg', '');
  } catch (err) {
    $('bdgRows').innerHTML =
      `<tr><td colspan="3" class="muted">No budget set for this month.</td></tr>`;

    if (String(err.message).includes('No budget')) {
      setMsg('bdgMsg', 'No budget for this month yet.', 'info');
    } else {
      setMsg('bdgMsg', err.message, 'error');
    }
  }
}

// --- Add a single budget line ---
async function addBudgetLine() {
  try {
    const y = Number($('bdgYear').value);
    const m = Number($('bdgMonth').value);

    const category = $('bdgCategory').value.trim();
    const limit = Number($('bdgLimit').value);
    const isRecurring = $('bdgRecurring').checked;

    if (!category || Number.isNaN(limit)) {
      setMsg('bdgMsg', 'Category and limit are required.', 'error');
      return;
    }

    // ⭐ If recurring, save to recurring collection instead
    if (isRecurring) {
      await api('/budgets/recurring', {
        method: 'POST',
        body: { category, amount: limit }
      });

      $('bdgCategory').value = '';
      $('bdgLimit').value = '';
      $('bdgRecurring').checked = false;

      setMsg('bdgMsg', 'Recurring line added.', 'success');
      setTimeout(() => setMsg('bdgMsg', ''), 1500);

      loadBudgetUI(); // refresh table
      return;
    }

    // ⭐ Otherwise, save a normal monthly budget line
    let doc;
    try {
      doc = await api(`/budgets/${y}/${m}`);
    } catch {
      doc = { limits: [] };
    }

    const newLimits = [...(doc.limits || []), { category, limit }];

    const updated = await api(`/budgets/${y}/${m}`, {
      method: 'PUT',
      body: { limits: newLimits }
    });

    renderBudgetRows(updated.limits);

    $('bdgCategory').value = '';
    $('bdgLimit').value = '';
    $('bdgRecurring').checked = false;

    setMsg('bdgMsg', 'Added.', 'success');
    setTimeout(() => setMsg('bdgMsg', ''), 1500);

  } catch (err) {
    setMsg('bdgMsg', err.message, 'error');
  }
}


// --- Sorting Helper ---
function sortLimits(limits) {
  const mode = $('bdgSort')?.value || 'recent';
  const arr = [...limits];

  switch (mode) {
    case 'alpha':
      return arr.sort((a, b) => a.category.localeCompare(b.category));
    case 'largest':
      return arr.sort((a, b) => b.limit - a.limit);
    case 'smallest':
      return arr.sort((a, b) => a.limit - b.limit);
    case 'recent':
    default:
      return arr;
  }
}

function renderBudgetRows(limits) {
  const rows = $('bdgRows');

  if (!limits || !limits.length) {
    rows.innerHTML =
      `<tr><td colspan="3" class="muted">No categories yet.</td></tr>`;
    return;
  }

  const sorted = sortLimits(limits);

  rows.innerHTML = sorted
    .map((l, i) => {
      const badge = l.type === 'recurring'
        ? `<span class="badge recurring"></span>`
        : l.type === 'planned'
        ? `<span class="badge planned">P</span>`
        : '';

      return `
        <tr data-index="${i}" data-type="${l.type || 'normal'}" data-category="${l.category}">
          <td>${badge} ${l.category}</td>
          <td class="right">${fmtMoney(l.limit)}</td>
          <td class="right">
            <button class="small" data-edit="${i}">Edit</button>
            <button class="small danger" data-del="${i}">Delete</button>
          </td>
        </tr>
      `;
    })
    .join('');

  // DELETE HANDLERS
  rows.querySelectorAll('button[data-del]').forEach(btn => {
    btn.onclick = async () => {
      const index = Number(btn.dataset.del);
      const row = btn.closest('tr');
      const type = row.dataset.type;
      const category = row.dataset.category;

      const y = Number($('bdgYear').value);
      const m = Number($('bdgMonth').value);

      // 1. Delete recurring
      if (type === 'recurring') {
        await api('/budgets/recurring/delete', {
          method: 'POST',
          body: { category }
        });
        loadBudgetUI();
        return;
      }

      // 2. Delete planned
      if (type === 'planned') {
        await api('/budgets/planned/delete', {
          method: 'POST',
          body: { category }
        });
        loadBudgetUI();
        return;
      }

      // 3. Delete normal monthly budget line
      const doc = await api(`/budgets/${y}/${m}`);
      const newLimits = doc.limits.filter((_, i) => i !== index);

      const updated = await api(`/budgets/${y}/${m}`, {
        method: 'PUT',
        body: { limits: newLimits }
      });

      renderBudgetRows(updated.limits);
    };
  });

  // EDIT HANDLERS
  rows.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.onclick = () => enterEditMode(Number(btn.dataset.edit));
  });


updateRemainingBudget();}


// --- Remaining Budget Calculator ---
function updateRemainingBudget() {
  const income = Number($('bdgIncome').value) || 0;

  let totalBudget = 0;
  document.querySelectorAll('#bdgRows tr').forEach(row => {
    const amountCell = row.querySelector('td:nth-child(2)');
    if (amountCell) {
      const raw = amountCell.textContent.replace(/[^0-9.-]/g, '');
      totalBudget += Number(raw) || 0;
    }
  });

  const remaining = income - totalBudget;
  $('bdgRemaining').textContent = fmtMoney(remaining);
}



// --- Inline Editing ---
async function enterEditMode(index) {
  const y = Number($('bdgYear').value);
  const m = Number($('bdgMonth').value);

  // Always fetch the latest version
  const doc = await api(`/budgets/${y}/${m}`);
  const limits = doc.limits || [];

  const row = $('bdgRows').querySelector(`tr[data-index="${index}"]`);
  const item = limits[index];
  const isRecurring = item.type === 'recurring';
  const isPlanned = item.type === 'planned';

  if (isRecurring || isPlanned) {
  setMsg('bdgMsg', 'Recurring and planned items cannot be edited here.', 'error');
  return;
}


  row.innerHTML = `
    <td><input id="editCat" value="${item.category}" /></td>
    <td class="right"><input id="editLimit" type="number" value="${item.limit}" /></td>
    <td class="right">
      <button class="small" id="saveEdit">Save</button>
      <button class="small" id="cancelEdit">Cancel</button>
    </td>
  `;

  $('saveEdit').onclick = () => saveEdit(index);
  $('cancelEdit').onclick = () => renderBudgetRows(limits);
}



// --- Save Edit + Validation ---
async function saveEdit(index) {
  const y = Number($('bdgYear').value);
  const m = Number($('bdgMonth').value);

  // Always fetch the latest version
  const doc = await api(`/budgets/${y}/${m}`);
  const limits = doc.limits || [];

  const category = $('editCat').value.trim();
  const limit = Number($('editLimit').value);

  // VALIDATION
  if (!category) return setMsg('bdgMsg', 'Category cannot be empty.', 'error');
  if (Number.isNaN(limit)) return setMsg('bdgMsg', 'Limit must be a number.', 'error');
  if (limit < 0) return setMsg('bdgMsg', 'Limit must be zero or greater.', 'error');

  // Only monthly items
  const monthlyOnly = limits.filter(l => !l.type);

  // Find the correct monthly index based on the merged index
  const target = limits[index];
  const monthlyIndex = monthlyOnly.findIndex(l => l.category === target.category);

  if (monthlyIndex === -1) {
    setMsg('bdgMsg', 'Cannot edit recurring or planned items here.', 'error');
    return;
  }

  // Prevent duplicates EXCEPT the row being edited
  const duplicate = monthlyOnly.some((l, i) =>
    i !== monthlyIndex && l.category.toLowerCase() === category.toLowerCase()
  );
  if (duplicate) {
    return setMsg('bdgMsg', 'That category already exists.', 'error');
  }

  // Apply edit to the correct monthly row
  const newLimits = monthlyOnly.map((l, i) =>
    i === monthlyIndex ? { category, limit } : l
  );

  const updated = await api(`/budgets/${y}/${m}`, {
    method: 'PUT',
    body: { limits: newLimits }
  });

  setMsg('bdgMsg', 'Updated.', 'success');
  setTimeout(() => setMsg('bdgMsg', ''), 1500);

  renderBudgetRows(updated.limits);
}


// --- Summary (Dashboard + Detailed Breakdown in one tab) ---

const runSummaryBtn = $('runSummary');
if (runSummaryBtn) {
  runSummaryBtn.onclick = runSummary;
}

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
