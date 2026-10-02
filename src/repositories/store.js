'use strict';

/**
 * Data access layer.
 *
 * Uses MySQL when DB_HOST is set (as it is under docker-compose), and falls
 * back to an in-memory store otherwise. The fallback means the API and its
 * tests run anywhere without a database, which keeps the pipeline reliable.
 *
 * MySQL returns snake_case columns and DECIMAL values as strings, so every
 * query result is normalised to the same camelCase shape the in-memory store
 * uses. Without this the forecasting service receives undefined dates.
 */

const seed = require('./seedData');

let pool = null;
let memory = null;

function toDateString(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normaliseInvoice(row) {
  return {
    id: row.id,
    client: row.client,
    amount: Number(row.amount),
    dueDate: toDateString(row.due_date ?? row.dueDate),
    status: row.status,
  };
}

function normaliseExpense(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    dueDate: toDateString(row.due_date ?? row.dueDate),
    frequency: row.frequency,
  };
}

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
    return rows.map(normaliseInvoice);
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
    return rows.map(normaliseExpense);
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
    const row = rows[0];
    if (!row) return { openingBalance: 0, startDate: new Date().toISOString().slice(0, 10) };
    return {
      openingBalance: Number(row.opening_balance ?? row.openingBalance ?? 0),
      startDate: toDateString(row.start_date ?? row.startDate),
    };
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