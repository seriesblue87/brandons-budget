// ---------------------------------------------------------
// Firebase imports
// ---------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
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
const USER_ID = "default"; // no login needed

// Biweekly paycheck: $1937.04 every other Wednesday starting 2026-07-22
const PAYCHECK_AMOUNT = 1937.04;
const FIRST_PAYDAY = new Date("2026-07-22");

// ---------------------------------------------------------
// DOM ELEMENTS
// ---------------------------------------------------------
const monthSelect = document.getElementById('monthSelect');
const incomeInput = document.getElementById('incomeInput');
const savingsGoalInput = document.getElementById('savingsGoalInput');
const saveBudgetBtn = document.getElementById('saveBudgetBtn');
const plannedIncomeEl = document.getElementById('plannedIncome');
const totalSpentEl = document.getElementById('totalSpent');
const remainingAmountEl = document.getElementById('remainingAmount');
const remainingCard = document.getElementById('remainingCard');
const savingsProgressEl = document.getElementById('savingsProgress');
const savingsStatusTextEl = document.getElementById('savingsStatusText');
const paycheckSummarySmall = document.getElementById('paycheckSummarySmall');
const paycheckTableBody = document.getElementById('paycheckTableBody');

const expenseName = document.getElementById('expenseName');
const expenseCategory = document.getElementById('expenseCategory');
const expenseAmount = document.getElementById('expenseAmount');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const expenseTableBody = document.getElementById('expenseTableBody');
const clearMonthBtn = document.getElementById('clearMonthBtn');

const recName = document.getElementById('recName');
const recCategory = document.getElementById('recCategory');
const recAmount = document.getElementById('recAmount');
const addRecurringBtn = document.getElementById('addRecurringBtn');
const applyRecurringBtn = document.getElementById('applyRecurringBtn');
const recurringTableBody = document.getElementById('recurringTableBody');

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function getMonthKey() {
  return monthSelect.value || new Date().toISOString().slice(0, 7);
}

function formatCurrency(num) {
  return '$' + (Number(num) || 0).toFixed(2);
}

function formatDateISO(date) {
  return date.toISOString().slice(0, 10);
}

function getYearMonthFromDate(date) {
  return date.toISOString().slice(0, 7);
}

// Generate all paydays for a given month (yyyy-mm)
function getPaydaysForMonth(monthKey) {
  const [yearStr, monthStr] = monthKey.split("-");
  const targetYear = Number(yearStr);
  const targetMonth = Number(monthStr); // 1-12

  const paydays = [];
  let d = new Date(FIRST_PAYDAY);

  // Loop forward until we pass the target month/year by a bit
  while (getYearMonthFromDate(d) <= `${targetYear}-${String(targetMonth).padStart(2, "0")}` || d.getFullYear() <= targetYear + 1) {
    const ym = getYearMonthFromDate(d);
    const [y, m] = ym.split("-");
    const yNum = Number(y);
    const mNum = Number(m);

    if (yNum === targetYear && mNum === targetMonth) {
      paydays.push(new Date(d));
    }

    // Move to next paycheck (every 14 days)
    d.setDate(d.getDate() + 14);

    // Stop if we've gone far beyond the target year
    if (yNum > targetYear + 1) break;
  }

  return paydays;
}

// Check if today is a payday
function isTodayPayday() {
  const today = new Date();
  const todayStr = formatDateISO(today);
  const paydaysForMonth = getPaydaysForMonth(getMonthKey());
  return paydaysForMonth.some(pd => formatDateISO(pd) === todayStr);
}

// ---------------------------------------------------------
// FIRESTORE: RECURRING EXPENSES
// ---------------------------------------------------------
async function loadRecurring() {
  const colRef = collection(db, `users/${USER_ID}/recurring`);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function addRecurring() {
  const name = recName.value.trim();
  const category = recCategory.value;
  const amount = Number(recAmount.value);

  if (!name || !amount) {
    alert("Please enter a name and amount.");
    return;
  }

  await addDoc(collection(db, `users/${USER_ID}/recurring`), {
    name,
    category,
    amount
  });

  recName.value = "";
  recAmount.value = "";
  
  await renderRecurring();
}

async function deleteRecurring(id) {
  await deleteDoc(doc(db, `users/${USER_ID}/recurring/${id}`));
  await renderRecurring();
}

async function renderRecurring() {
  const recurring = await loadRecurring();
  recurringTableBody.innerHTML = "";

  recurring.forEach(rec => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${rec.name}</td>
      <td>${rec.category}</td>
      <td class="right">${formatCurrency(rec.amount)}</td>
      <td><button class="btn-danger" style="font-size:0.8rem">Delete</button></td>
    `;

    tr.querySelector("button").onclick = () => deleteRecurring(rec.id);
    recurringTableBody.appendChild(tr);
  });
}

// ---------------------------------------------------------
// FIRESTORE: MONTH INCOME + SAVINGS GOAL
// ---------------------------------------------------------
async function ensureMonthIncomeFromPaychecks(monthKey) {
  const monthRef = doc(db, `users/${USER_ID}/months/${monthKey}`);
  const snap = await getDoc(monthRef);

  const paydays = getPaydaysForMonth(monthKey);
  const autoIncome = paydays.length * PAYCHECK_AMOUNT;

  // Only auto-set if no income yet (or zero)
  if (!snap.exists() || !snap.data().income) {
    await setDoc(monthRef, {
      income: autoIncome
    }, { merge: true });
  }
}

async function saveBudget() {
  const monthKey = getMonthKey();
  const monthRef = doc(db, `users/${USER_ID}/months/${monthKey}`);

  const income = Number(incomeInput.value) || 0;
  const savingsGoal = Number(savingsGoalInput.value) || 0;

  await setDoc(monthRef, {
    income,
    savingsGoal
  }, { merge: true });
}

// ---------------------------------------------------------
// FIRESTORE: EXPENSES
// ---------------------------------------------------------
async function addExpense() {
  const name = expenseName.value.trim();
  const category = expenseCategory.value;
  const amount = Number(expenseAmount.value);

  if (!name || !amount) {
    alert("Please enter a name and amount.");
    return;
  }

  const monthKey = getMonthKey();
  const today = new Date().toISOString().slice(0, 10);

  await addDoc(collection(db, `users/${USER_ID}/months/${monthKey}/expenses`), {
    name,
    category,
    amount,
    date: today
  });

  expenseName.value = "";
  expenseAmount.value = "";
}

async function deleteExpense(id) {
  const monthKey = getMonthKey();
  await deleteDoc(doc(db, `users/${USER_ID}/months/${monthKey}/expenses/${id}`));
}

// ---------------------------------------------------------
// APPLY RECURRING TO MONTH
// ---------------------------------------------------------
async function applyRecurringToMonth() {
  const monthKey = getMonthKey();
  const today = new Date().toISOString().slice(0, 10);

  const recurring = await loadRecurring();

  for (const rec of recurring) {
    await addDoc(collection(db, `users/${USER_ID}/months/${monthKey}/expenses`), {
      name: rec.name,
      category: rec.category,
      amount: rec.amount,
      date: today
    });
  }
}

// ---------------------------------------------------------
// CLEAR MONTH
// ---------------------------------------------------------
async function clearMonth() {
  if (!confirm("Clear all data for this month?")) return;

  const monthKey = getMonthKey();

  // Reset income & savings goal
  await setDoc(doc(db, `users/${USER_ID}/months/${monthKey}`), {
    income: 0,
    savingsGoal: 0
  });

  // Delete all expenses
  const expCol = collection(db, `users/${USER_ID}/months/${monthKey}/expenses`);
  const snapshot = await getDocs(expCol);

  for (const d of snapshot.docs) {
    await deleteDoc(d.ref);
  }
}

// ---------------------------------------------------------
// RENDER PAYCHECKS FOR MONTH
// ---------------------------------------------------------
function renderPaychecksForMonth(monthKey) {
  const paydays = getPaydaysForMonth(monthKey);
  paycheckTableBody.innerHTML = "";

  paydays.forEach(pd => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateISO(pd)}</td>
      <td class="right">${formatCurrency(PAYCHECK_AMOUNT)}</td>
    `;
    paycheckTableBody.appendChild(tr);
  });

  const total = paydays.length * PAYCHECK_AMOUNT;
  paycheckSummarySmall.textContent = paydays.length
    ? `${paydays.length} paycheck${paydays.length > 1 ? "s" : ""} · ${formatCurrency(total)} this month`
    : "No paychecks in this month based on current schedule.";
}

// ---------------------------------------------------------
// RENDER MONTH (REAL-TIME)
// ---------------------------------------------------------
function subscribeToMonth() {
  const monthKey = getMonthKey();
  const monthRef = doc(db, `users/${USER_ID}/months/${monthKey}`);
  const expCol = collection(db, `users/${USER_ID}/months/${monthKey}/expenses`);

  renderPaychecksForMonth(monthKey);

  // Income + savings listener
  onSnapshot(monthRef, (snap) => {
    const data = snap.data() || { income: 0, savingsGoal: 0 };
    plannedIncomeEl.textContent = formatCurrency(data.income || 0);
    incomeInput.value = data.income || "";
    savingsGoalInput.value = data.savingsGoal || "";

    // Update savings progress based on current expenses (we'll recompute below)
    // This will be finalized in the expenses listener once total is known.
  });

  // Expenses listener
  onSnapshot(expCol, (snapshot) => {
    expenseTableBody.innerHTML = "";
    let total = 0;

    snapshot.forEach(docSnap => {
      const exp = { id: docSnap.id, ...docSnap.data() };
      total += Number(exp.amount) || 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${exp.date}</td>
        <td>${exp.name}</td>
        <td><span class="category-pill">${exp.category}</span></td>
        <td class="right">${formatCurrency(exp.amount)}</td>
        <td><button class="btn-danger" style="font-size:0.8rem">Delete</button></td>
      `;

      tr.querySelector("button").onclick = () => deleteExpense(exp.id);
      expenseTableBody.appendChild(tr);
    });

    totalSpentEl.textContent = formatCurrency(total);

    const income = Number(incomeInput.value) || 0;
    const remaining = income - total;

    remainingAmountEl.textContent = formatCurrency(remaining);

    if (remaining >= 0) {
      remainingCard.classList.add("good");
      remainingCard.classList.remove("bad");
    } else {
      remainingCard.classList.add("bad");
      remainingCard.classList.remove("good");
    }

    // Savings goal progress
    const savingsGoal = Number(savingsGoalInput.value) || 0;
    const savedSoFar = Math.max(income - total, 0); // treat remaining as potential savings
    savingsProgressEl.textContent = `${formatCurrency(savedSoFar)} / ${formatCurrency(savingsGoal)}`;

    if (!savingsGoal) {
      savingsStatusTextEl.textContent = "Set a savings goal to track how much you’re keeping.";
    } else if (savedSoFar >= savingsGoal) {
      savingsStatusTextEl.textContent = "Nice — you’ve hit your savings goal for this month.";
    } else {
      const remainingToGoal = savingsGoal - savedSoFar;
      savingsStatusTextEl.textContent = `You need ${formatCurrency(remainingToGoal)} more to reach your savings goal.`;
    }
  });
}

// ---------------------------------------------------------
// INIT
// ---------------------------------------------------------
(async function init() {
  const nowMonth = new Date().toISOString().slice(0, 7);
  monthSelect.value = nowMonth;

  // Ensure income is auto-set from paychecks for the initial month
  await ensureMonthIncomeFromPaychecks(getMonthKey());

  // If today is a payday, make sure the month reflects all paychecks
  // (this is already handled by ensureMonthIncomeFromPaychecks via count of paydays)

  monthSelect.addEventListener("change", async () => {
    await ensureMonthIncomeFromPaychecks(getMonthKey());
    subscribeToMonth();
  });

  saveBudgetBtn.addEventListener("click", saveBudget);
  addExpenseBtn.addEventListener("click", addExpense);
  clearMonthBtn.addEventListener("click", clearMonth);

  addRecurringBtn.addEventListener("click", addRecurring);
  applyRecurringBtn.addEventListener("click", applyRecurringToMonth);

  subscribeToMonth();
  renderRecurring();
})();
