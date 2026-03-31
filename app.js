// app.js

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase config (paste yours here)
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

// Initialize Firebase + Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const expensesCol = collection(db, "expenses");

// DOM elements
const form = document.getElementById("expense-form");
const nameInput = document.getElementById("expense-name");
const amountInput = document.getElementById("expense-amount");
const dateInput = document.getElementById("expense-date");
const recurringInput = document.getElementById("expense-recurring");
const listEl = document.getElementById("expense-list");
const totalEl = document.getElementById("total-amount");

// Add expense
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const date = dateInput.value;
  const isRecurring = recurringInput.checked;

  if (!name || isNaN(amount) || !date) return;

  await addDoc(expensesCol, {
    name,
    amount,
    date,
    isRecurring,
    createdAt: serverTimestamp()
  });

  form.reset();
});

// Real-time sync
onSnapshot(expensesCol, (snapshot) => {
  const expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  listEl.innerHTML = "";
  let total = 0;

  expenses.forEach(exp => {
    total += Number(exp.amount) || 0;

    const li = document.createElement("li");
    li.textContent = `${exp.name} - $${Number(exp.amount).toFixed(2)} on ${exp.date}` +
      (exp.isRecurring ? " (recurring)" : "");

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteExpense(exp.id));

    li.appendChild(delBtn);
    listEl.appendChild(li);
  });

  totalEl.textContent = total.toFixed(2);
});

// Delete expense
async function deleteExpense(id) {
  await deleteDoc(doc(db, "expenses", id));
}
