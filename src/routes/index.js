'use strict';

const express = require('express');
const store = require('../repositories/store');
const { buildForecast, recommendActions } = require('../services/forecastService');
const { forecastsBuilt, shortfallsDetected } = require('../middleware/metrics');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get('/invoices', asyncHandler(async (req, res) => {
  res.json(await store.listInvoices());
}));

router.post('/invoices', asyncHandler(async (req, res) => {
  const { id, client, amount, dueDate } = req.body || {};
  if (!id || !client || typeof amount !== 'number' || !dueDate) {
    return res.status(400).json({ error: 'id, client, numeric amount and dueDate are required' });
  }
  const created = await store.addInvoice({ id, client, amount, dueDate, status: 'unpaid' });
  res.status(201).json(created);
}));

router.get('/expenses', asyncHandler(async (req, res) => {
  res.json(await store.listExpenses());
}));

router.post('/expenses', asyncHandler(async (req, res) => {
  const { id, description, amount, dueDate, frequency } = req.body || {};
  if (!id || typeof amount !== 'number' || !dueDate) {
    return res.status(400).json({ error: 'id, numeric amount and dueDate are required' });
  }
  const created = await store.addExpense({ id, description, amount, dueDate, frequency: frequency || 'once' });
  res.status(201).json(created);
}));

async function forecastInput(horizonWeeks) {
  const account = await store.getAccount();
  return {
    openingBalance: Number(account.openingBalance ?? account.opening_balance ?? 0),
    startDate: account.startDate || account.start_date,
    invoices: await store.listInvoices(),
    expenses: await store.listExpenses(),
    horizonWeeks,
  };
}

router.get('/forecast', asyncHandler(async (req, res) => {
  const horizon = Number(req.query.weeks) || 13;
  const result = buildForecast(await forecastInput(horizon));
  forecastsBuilt.inc();
  if (result.breakWeek !== null) shortfallsDetected.inc();
  res.json(result);
}));

router.get('/recommendations', asyncHandler(async (req, res) => {
  const horizon = Number(req.query.weeks) || 13;
  res.json(recommendActions(await forecastInput(horizon)));
}));

module.exports = router;
