// ---------------------------------------------------------
// Firebase imports
// ---------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  doc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---------------------------------------------------------
// Firebase config
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCnM9sStBexhjE4-z906mNZq5nu3L_rYuQ",
  authDomain: "brandons-budget.firebaseapp.com",
  databaseURL: "https://brandons-budget-default-rtdb.firebaseio.com",
  projectId: "brandons-budget",
  storageBucket: "brandons-budget.firebasestorage.app",
  messagingSenderId: "135609004884",
  appId: "1:135609004884:web:ec9ff9cb3ce75c02d38ec1",
  measurementId: "G-ZTL2FHJTKW"
};

// ---------------------------------------------------------
// Init Firebase + Firestore
// ---------------------------------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------
const USER_ID = "default";

// Hardcoded biweekly paycheck schedule
const PAYCHECK_AMOUNT = 1937.04;

const PAYCHECK_DATES = [
  "2026-07-22",
  "2026-08-05",
  "2026-08-19",
  "2026-09-02",
  "2026-09-16",
  "2026-09-30",
  "2026-10-14",
  "2026-10-28",
  "2026-11-11",
  "2026-11-25",
  "2026-12-09",
  "2026-12-23"
];

const HEALTH_RING_CIRCUMFERENCE = 2 * Math.PI * 46; // r=46 in the SVG

const MONTH_LABELS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// ---------------------------------------------------------
// DOM ELEMENTS
// ---------------------------------------------------------
const incomeName = document.getElementById('incomeName');
const incomeAmount = document.getElementById('incomeAmount');
const incomeDate = document.getElementById('incomeDate');
const addIncomeBtn = document.getElementById('addIncomeBtn');
const incomeTableBody = document.getElementById('incomeTableBody');

const plannedIncomeEl = document.getElementById('plannedIncome');
const totalSpentEl = document.getElementById('totalSpent');
const remainingAmountEl = document.getElementById('remainingAmount');

const expenseName = document.getElementById('expenseName');
const expenseCategory = document.getElementById('expenseCategory');
const expenseAmount = document.getElementById('expenseAmount');
const expenseDate = document.getElementById('expenseDate');
const expenseRecurringCheckbox = document.getElementById('expenseRecurringCheckbox');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const expenseTableBody = document.getElementById('expenseTableBody');

const fullResetBtn = document.getElementById('fullResetBtn');

const healthRing = document.getElementById('healthRing');
const healthPct = document.getElementById('healthPct');
const healthSub = document.getElementById('healthSub');
const categoryBreakdown = document.getElementById('categoryBreakdown');
const nextPayDays = document.getElementById('nextPayDays');
const nextPayDate = document.getElementById('nextPayDate');
const paycheckAmountChip = document.getElementById('paycheckAmountChip');

const monthInput = document.getElementById('monthInput');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const todayMonthBtn = document.getElementById('todayMonthBtn');

// ---------------------------------------------------------
// STATE
// ---------------------------------------------------------
let currentIncomeEntries = [];
let currentExpenses = [];
let selectedMonth = todayISO().slice(0, 7); // "YYYY-MM"
let unsubIncome = null;
let unsubExpenses = null;

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function formatCurrency(num) {
  return '$' + (Number(num) || 0).toFixed(2);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function categoryClass(category) {
  return String(category || '').replace(/\s+/g, ' ').trim().replace(/ /g, '.');
}

function monthIncomePath(monthKey) {
  return `users/${USER_ID}/months/${monthKey}/income`;
}

function monthExpensesPath(monthKey) {
  return `users/${USER_ID}/months/${monthKey}/expenses`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

// Storage/sorting stays ISO (YYYY-MM-DD) everywhere; this is purely for display,
// using a month name so it reads unambiguously (no MM-DD-YYYY vs DD-MM-YYYY confusion).
function formatDisplayDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTH_LABELS[month - 1].slice(0, 3)} ${day}, ${year}`;
}

function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------
// AUTO PAYCHECK INJECTION
// ---------------------------------------------------------
// Always credits the paycheck to the month that actually contains today,
// regardless of which month the user currently has open in the selector.
// Skips adding it twice if it's already been added today.
async function applyPaycheckIfToday() {
  const today = todayISO();
  if (!PAYCHECK_DATES.includes(today)) return;

  const todaysMonthKey = today.slice(0, 7);
  const incomeColRef = collection(db, monthIncomePath(todaysMonthKey));
  const snap = await getDocs(incomeColRef);
  const alreadyAdded = snap.docs.some(d => d.data().name === 'Paycheck' && d.data().date === today);
  if (alreadyAdded) return;

  await addDoc(incomeColRef, { name: 'Paycheck', amount: PAYCHECK_AMOUNT, date: today });
}

// ---------------------------------------------------------
// INCOME
// ---------------------------------------------------------
async function addIncome() {
  const name = incomeName.value.trim();
  const amount = Number(incomeAmount.value);
  const date = incomeDate.value || todayISO();

  if (!name || !amount) return alert("Enter source + amount");

  await addDoc(collection(db, monthIncomePath(selectedMonth)), { name, amount, date });

  incomeName.value = "";
  incomeAmount.value = "";
  incomeDate.value = todayISO();
}

async function deleteIncome(id) {
  await deleteDoc(doc(db, `${monthIncomePath(selectedMonth)}/${id}`));
}

function renderIncomeTable(incomeEntries) {
  incomeTableBody.innerHTML = "";

  if (incomeEntries.length === 0) {
    incomeTableBody.innerHTML = `<tr class="empty-row"><td colspan="4">No income logged yet</td></tr>`;
    return;
  }

  const sorted = [...incomeEntries].sort((a, b) => (a.date < b.date ? 1 : -1));

  sorted.forEach(inc => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDisplayDate(inc.date)}</td>
      <td>${inc.name}</td>
      <td class="right">${formatCurrency(inc.amount)}</td>
      <td class="row-actions"><button class="btn-danger">Delete</button></td>
    `;
    tr.querySelector("button").onclick = () => deleteIncome(inc.id);
    incomeTableBody.appendChild(tr);
  });
}

// ---------------------------------------------------------
// RECURRING TEMPLATES (shared across all months, no separate table shown —
// just a behind-the-scenes list used to seed future months)
// ---------------------------------------------------------
async function loadRecurringTemplates() {
  const colRef = collection(db, `users/${USER_ID}/recurring`);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Adds a template only if one with the same name doesn't already exist.
async function ensureRecurringTemplate(name, category, amount) {
  const existing = await loadRecurringTemplates();
  const match = existing.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (match) return;

  await addDoc(collection(db, `users/${USER_ID}/recurring`), { name, category, amount });
}

// Removes any recurring template matching this name, so it won't be applied
// to future months. Does not touch expenses already logged.
async function removeRecurringTemplate(name) {
  const existing = await loadRecurringTemplates();
  const matches = existing.filter(r => r.name.toLowerCase() === name.toLowerCase());
  await Promise.all(matches.map(m => deleteDoc(doc(db, `users/${USER_ID}/recurring/${m.id}`))));
}

// Pulls in any recurring templates not already logged in the given month.
// Called automatically whenever a month is opened (see switchMonth), so
// recurring items just show up without the user having to click anything.
async function ensureRecurringAppliedToMonth(monthKey, expensesAtOpen) {
  const templates = await loadRecurringTemplates();
  if (templates.length === 0) return;

  const existingNames = new Set(expensesAtOpen.map(e => e.name.toLowerCase()));
  const dateForEntry = monthKey === todayISO().slice(0, 7)
    ? todayISO()
    : `${monthKey}-01`;

  for (const rec of templates) {
    if (existingNames.has(rec.name.toLowerCase())) continue;
    await addDoc(collection(db, monthExpensesPath(monthKey)), {
      name: rec.name,
      category: rec.category,
      amount: rec.amount,
      date: dateForEntry,
      recurring: true
    });
  }
}

// ---------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------
async function addExpense() {
  const name = expenseName.value.trim();
  const category = expenseCategory.value;
  const amount = Number(expenseAmount.value);
  const date = expenseDate.value || todayISO();
  const recurring = expenseRecurringCheckbox.checked;

  if (!name || !amount) return alert("Enter name + amount");

  await addDoc(collection(db, monthExpensesPath(selectedMonth)), {
    name, category, amount, date, recurring
  });

  if (recurring) {
    await ensureRecurringTemplate(name, category, amount);
  }

  expenseName.value = "";
  expenseAmount.value = "";
  expenseDate.value = todayISO();
  expenseRecurringCheckbox.checked = false;
}

async function deleteExpense(id) {
  await deleteDoc(doc(db, `${monthExpensesPath(selectedMonth)}/${id}`));
}

async function stopRecurring(name) {
  if (!confirm(`Stop treating "${name}" as recurring? It will no longer be added to future months automatically.`)) return;
  await removeRecurringTemplate(name);
}

function renderExpenseTable(expenses) {
  expenseTableBody.innerHTML = "";

  if (expenses.length === 0) {
    expenseTableBody.innerHTML = `<tr class="empty-row"><td colspan="5">No expenses logged yet</td></tr>`;
    return;
  }

  // most recent first
  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));

  sorted.forEach(exp => {
    const tr = document.createElement("tr");
    const recurringBadge = exp.recurring ? `<span class="pill-recurring">Recurring</span>` : '';
    tr.innerHTML = `
      <td>${formatDisplayDate(exp.date)}</td>
      <td>${exp.name}</td>
      <td><span class="pill ${categoryClass(exp.category)}">${exp.category}</span>${recurringBadge}</td>
      <td class="right">${formatCurrency(exp.amount)}</td>
      <td class="row-actions"></td>
    `;
    const actionsCell = tr.querySelector('.row-actions');

    if (exp.recurring) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'btn-ghost';
      stopBtn.textContent = 'Stop Recurring';
      stopBtn.style.marginRight = '0.4rem';
      stopBtn.onclick = () => stopRecurring(exp.name);
      actionsCell.appendChild(stopBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteExpense(exp.id);
    actionsCell.appendChild(deleteBtn);

    expenseTableBody.appendChild(tr);
  });
}

// ---------------------------------------------------------
// SIDEBAR WIDGETS
// ---------------------------------------------------------
function renderSummary(incomeEntries, expenses) {
  const totalIncome = incomeEntries.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = totalIncome - totalSpent;

  plannedIncomeEl.textContent = formatCurrency(totalIncome);
  totalSpentEl.textContent = formatCurrency(totalSpent);
  remainingAmountEl.textContent = formatCurrency(remaining);
  remainingAmountEl.classList.toggle('negative', remaining < 0);

  // health ring
  const pct = totalIncome > 0 ? Math.min(100, Math.max(0, (totalSpent / totalIncome) * 100)) : 0;
  const offset = HEALTH_RING_CIRCUMFERENCE - (pct / 100) * HEALTH_RING_CIRCUMFERENCE;
  healthRing.setAttribute('stroke-dasharray', HEALTH_RING_CIRCUMFERENCE.toFixed(1));
  healthRing.setAttribute('stroke-dashoffset', offset.toFixed(1));
  healthRing.style.stroke = pct >= 90 ? 'var(--red)' : 'url(#iridGrad)';
  healthPct.textContent = `${pct.toFixed(0)}%`;
  healthSub.textContent = `${formatCurrency(Math.max(0, remaining))} remaining`;

  // category breakdown
  renderCategoryBreakdown(expenses, totalSpent);
}

function renderCategoryBreakdown(expenses, totalSpent) {
  if (expenses.length === 0 || totalSpent === 0) {
    categoryBreakdown.innerHTML = `<div class="cat-empty">No expenses logged yet</div>`;
    return;
  }

  const totals = {};
  expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + (Number(e.amount) || 0);
  });

  const rows = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const pct = (amount / totalSpent) * 100;
      return `
        <div class="cat-bar-row">
          <div class="cat-bar-top">
            <span>${category}</span>
            <span>${formatCurrency(amount)}</span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>
      `;
    })
    .join('');

  categoryBreakdown.innerHTML = rows;
}

function renderNextPaycheck() {
  const today = new Date(todayISO() + 'T00:00:00Z');
  const upcoming = PAYCHECK_DATES
    .map(d => new Date(d + 'T00:00:00Z'))
    .filter(d => d >= today)
    .sort((a, b) => a - b)[0];

  if (!upcoming) {
    nextPayDays.textContent = '—';
    nextPayDate.textContent = 'None scheduled';
    return;
  }

  const diffDays = Math.round((upcoming - today) / (1000 * 60 * 60 * 24));
  nextPayDays.textContent = diffDays === 0 ? 'Today' : `${diffDays}`;
  nextPayDate.textContent = formatDisplayDate(upcoming.toISOString().slice(0, 10));
}

// ---------------------------------------------------------
// MONTH SWITCHING
// ---------------------------------------------------------
function switchMonth(monthKey) {
  selectedMonth = monthKey;
  monthInput.value = monthKey;

  // tear down listeners on the previous month before attaching new ones
  if (unsubIncome) unsubIncome();
  if (unsubExpenses) unsubExpenses();

  currentIncomeEntries = [];
  currentExpenses = [];
  let recurringChecked = false;

  const incomeRef = collection(db, monthIncomePath(monthKey));
  unsubIncome = onSnapshot(incomeRef, (snap) => {
    currentIncomeEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderIncomeTable(currentIncomeEntries);
    renderSummary(currentIncomeEntries, currentExpenses);
  });

  const expensesRef = collection(db, monthExpensesPath(monthKey));
  unsubExpenses = onSnapshot(expensesRef, (snap) => {
    currentExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderExpenseTable(currentExpenses);
    renderSummary(currentIncomeEntries, currentExpenses);

    // Only run the recurring auto-fill once per month-open, using the first
    // snapshot as the "what's already here" baseline. Later snapshots just
    // reflect our own additions coming back through the listener.
    if (!recurringChecked) {
      recurringChecked = true;
      ensureRecurringAppliedToMonth(monthKey, currentExpenses);
    }
  });
}

// ---------------------------------------------------------
// RESET (scoped to whichever month is currently selected; recurring templates are shared, so they're left alone)
// ---------------------------------------------------------
async function fullReset() {
  if (!confirm(`This will erase income and logged expenses for ${formatMonthLabel(selectedMonth)}. Continue?`)) return;

  const income = await getDocs(collection(db, monthIncomePath(selectedMonth)));
  await Promise.all(income.docs.map(d => deleteDoc(d.ref)));

  const expenses = await getDocs(collection(db, monthExpensesPath(selectedMonth)));
  await Promise.all(expenses.docs.map(d => deleteDoc(d.ref)));
}

// ---------------------------------------------------------
// EVENT LISTENERS
// ---------------------------------------------------------
addIncomeBtn.addEventListener('click', addIncome);
addExpenseBtn.addEventListener('click', addExpense);
fullResetBtn.addEventListener('click', fullReset);

prevMonthBtn.addEventListener('click', () => switchMonth(shiftMonth(selectedMonth, -1)));
nextMonthBtn.addEventListener('click', () => switchMonth(shiftMonth(selectedMonth, 1)));
todayMonthBtn.addEventListener('click', () => switchMonth(todayISO().slice(0, 7)));
monthInput.addEventListener('change', () => {
  if (monthInput.value) switchMonth(monthInput.value);
});

// ---------------------------------------------------------
// INIT
// ---------------------------------------------------------
paycheckAmountChip.textContent = formatCurrency(PAYCHECK_AMOUNT);
expenseDate.value = todayISO();
incomeDate.value = todayISO();
renderNextPaycheck();
applyPaycheckIfToday().then(() => {
  switchMonth(selectedMonth);
});
