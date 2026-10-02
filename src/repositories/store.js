'use strict';

/**
 * Data access layer.
 *
 * Uses MySQL when DB_HOST is set (as it is under docker-compose), and falls
 * back to an in-memory store otherwise. The fallback means the API and its
 * tests run anywhere without a database, which keeps the pipeline reliable.
 */

const seed = require('./seedData');

let pool = null;
let memory = null;

async function init() {
  if (process.env.DB_HOST) {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER || 'cashrunway',
      password: process.env.DB_PASSWORD || 'cashrunway',
      database: process.env.DB_NAME || 'cashrunway',
      waitForConnections: true,
      connectionLimit: 10,
    });
    await pool.query('SELECT 1');
    return { mode: 'mysql' };
  }
  memory = JSON.parse(JSON.stringify(seed));
  return { mode: 'memory' };
}

function ensureMemory() {
  if (!memory) memory = JSON.parse(JSON.stringify(seed));
  return memory;
}

async function listInvoices() {
  if (pool) {
    const [rows] = await pool.query('SELECT * FROM invoices');
    return rows;
  }
  return ensureMemory().invoices;
}

async function addInvoice(invoice) {
  if (pool) {
    await pool.query(
      'INSERT INTO invoices (id, client, amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [invoice.id, invoice.client, invoice.amount, invoice.dueDate, invoice.status || 'unpaid']
    );
    return invoice;
  }
  ensureMemory().invoices.push(invoice);
  return invoice;
}

async function listExpenses() {
  if (pool) {
    const [rows] = await pool.query('SELECT * FROM expenses');
    return rows;
  }
  return ensureMemory().expenses;
}

async function addExpense(expense) {
  if (pool) {
    await pool.query(
      'INSERT INTO expenses (id, description, amount, due_date, frequency) VALUES (?, ?, ?, ?, ?)',
      [expense.id, expense.description, expense.amount, expense.dueDate, expense.frequency || 'once']
    );
    return expense;
  }
  ensureMemory().expenses.push(expense);
  return expense;
}

async function getAccount() {
  if (pool) {
    const [rows] = await pool.query('SELECT * FROM account LIMIT 1');
    return rows[0] || { opening_balance: 0 };
  }
  return ensureMemory().account;
}

function reset() {
  memory = JSON.parse(JSON.stringify(seed));
}

async function close() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = { init, listInvoices, addInvoice, listExpenses, addExpense, getAccount, reset, close };
