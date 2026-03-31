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
// Firebase config (paste your real config here)
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

// ---------------------------------------------------------
// DOM ELEMENTS (same as your original script)
// ---------------------------------------------------------
const monthSelect = document.getElementById('monthSelect');
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
  
  await renderRecurring();   // ← THIS MAKES THE LIST UPDATE IMMEDIATELY
  
}

async function deleteRecurring(id) {
  await deleteDoc(doc(db, `users/${USER_ID}/recurring/${id}`));
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
// FIRESTORE: MONTH INCOME
// ---------------------------------------------------------
async function saveBudget() {
  const monthKey = getMonthKey();
  const monthRef = doc(db, `users/${USER_ID}/months/${monthKey}`);

  await setDoc(monthRef, {
    income: Number(incomeInput.value) || 0
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

  // Reset income
  await setDoc(doc(db, `users/${USER_ID}/months/${monthKey}`), {
    income: 0
  });

  // Delete all expenses
  const expCol = collection(db, `users/${USER_ID}/months/${monthKey}/expenses`);
  const snapshot = await getDocs(expCol);

  for (const d of snapshot.docs) {
    await deleteDoc(d.ref);
  }
}

// ---------------------------------------------------------
// RENDER MONTH (REAL-TIME)
// ---------------------------------------------------------
function subscribeToMonth() {
  const monthKey = getMonthKey();
  const monthRef = doc(db, `users/${USER_ID}/months/${monthKey}`);
  const expCol = collection(db, `users/${USER_ID}/months/${monthKey}/expenses`);

  // Income listener
  onSnapshot(monthRef, (snap) => {
    const data = snap.data() || { income: 0 };
    plannedIncomeEl.textContent = formatCurrency(data.income);
    incomeInput.value = data.income || "";
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
  });
}

// ---------------------------------------------------------
// INIT
// ---------------------------------------------------------
(function init() {
  const nowMonth = new Date().toISOString().slice(0, 7);
  monthSelect.value = nowMonth;

  monthSelect.addEventListener("change", () => {
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
