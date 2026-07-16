// ---------------------------------------------------------
// Firebase imports
// ---------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
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

// ---------------------------------------------------------
// DOM ELEMENTS
// ---------------------------------------------------------
const incomeInput = document.getElementById('incomeInput');
const saveBudgetBtn = document.getElementById('saveBudgetBtn');
const plannedIncomeEl = document.getElementById('plannedIncome');
const totalSpentEl = document.getElementById('totalSpent');
const remainingAmountEl = document.getElementById('remainingAmount');
const remainingCard = document.getElementById('remainingCard');

const expenseName = document.getElementById('expenseName');
const expenseCategory = document.getElementById('expenseCategory');
const expenseAmount = document.getElementById('expenseAmount');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const expenseTableBody = document.getElementById('expenseTableBody');

const recName = document.getElementById('recName');
const recCategory = document.getElementById('recCategory');
const recAmount = document.getElementById('recAmount');
const addRecurringBtn = document.getElementById('addRecurringBtn');
const applyRecurringBtn = document.getElementById('applyRecurringBtn');
const recurringTableBody = document.getElementById('recurringTableBody');

const fullResetBtn = document.getElementById('fullResetBtn');

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function formatCurrency(num) {
  return '$' + (Number(num) || 0).toFixed(2);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------
// AUTO PAYCHECK INJECTION
// ---------------------------------------------------------
async function applyPaycheckIfToday() {
  const today = todayISO();

  if (PAYCHECK_DATES.includes(today)) {
    const monthRef = doc(db, `users/${USER_ID}/months/main`);
    const snap = await getDoc(monthRef);

    const currentIncome = snap.exists() ? (snap.data().income || 0) : 0;

    await setDoc(monthRef, {
      income: currentIncome + PAYCHECK_AMOUNT
    }, { merge: true });
  }
}

// ---------------------------------------------------------
// SAVE INCOME
// ---------------------------------------------------------
async function saveBudget() {
  const monthRef = doc(db, `users/${USER_ID}/months/main`);
  const income = Number(incomeInput.value) || 0;

  await setDoc(monthRef, { income }, { merge: true });
}

// ---------------------------------------------------------
// RECURRING EXPENSES
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

  if (!name || !amount) return alert("Enter name + amount");

  await addDoc(collection(db, `users/${USER_ID}/recurring`), {
    name, category, amount
  });

  recName.value = "";
  recAmount.value = "";

  renderRecurring();
}

async function deleteRecurring(id) {
  await deleteDoc(doc(db, `users/${USER_ID}/recurring/${id}`));
  renderRecurring();
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
// APPLY RECURRING
// ---------------------------------------------------------
async function applyRecurringToMonth() {
  const recurring = await loadRecurring();
  const today = todayISO();

  for (const rec of recurring) {
    await addDoc(collection(db, `users/${USER_ID}/months/main/expenses`), {
      name: rec.name,
      category: rec.category,
      amount: rec.amount,
      date: today
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

  if (!name || !amount) return alert("Enter name + amount");

  const today = todayISO();

  await addDoc(collection(db, `users/${USER_ID}/months/main/expenses`), {
    name, category, amount, date: today
  });

  expenseName.value
