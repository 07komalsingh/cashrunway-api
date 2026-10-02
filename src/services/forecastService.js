'use strict';

/**
 * Cash-flow forecasting logic.
 *
 * Everything in this module is pure: data in, data out, with no database or
 * network access. That makes it fast and reliable to test, which is what the
 * Test stage of the pipeline depends on.
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function weekIndex(startDate, date) {
  const start = new Date(startDate);
  const target = new Date(date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime())) {
    throw new TypeError('weekIndex requires two valid dates');
  }
  return Math.floor((target - start) / MS_PER_WEEK);
}

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function expandRecurringExpense(expense, startDate, horizonWeeks) {
  const { amount, dueDate, frequency } = expense;
  const occurrences = [];
  const stepWeeks = { weekly: 1, fortnightly: 2, monthly: 4, quarterly: 13 }[frequency];

  if (!stepWeeks) {
    const idx = weekIndex(startDate, dueDate);
    if (idx >= 0 && idx < horizonWeeks) {
      occurrences.push({ week: idx, amount });
    }
    return occurrences;
  }

  let idx = weekIndex(startDate, dueDate);
  while (idx < 0) idx += stepWeeks;
  for (; idx < horizonWeeks; idx += stepWeeks) {
    occurrences.push({ week: idx, amount });
  }
  return occurrences;
}

function buildForecast({ openingBalance, invoices = [], expenses = [], startDate, horizonWeeks = 13 }) {
  if (typeof openingBalance !== 'number' || Number.isNaN(openingBalance)) {
    throw new TypeError('openingBalance must be a number');
  }
  if (horizonWeeks < 1 || horizonWeeks > 52) {
    throw new RangeError('horizonWeeks must be between 1 and 52');
  }

  const start = startDate || new Date().toISOString().slice(0, 10);
  const weeks = Array.from({ length: horizonWeeks }, (_, i) => ({
    week: i + 1,
    moneyIn: 0,
    moneyOut: 0,
    closingBalance: 0,
  }));

  for (const invoice of invoices) {
    if (invoice.status === 'paid') continue;
    const idx = weekIndex(start, invoice.expectedDate || invoice.dueDate);
    if (idx >= 0 && idx < horizonWeeks) {
      weeks[idx].moneyIn += Number(invoice.amount) || 0;
    }
  }

  for (const expense of expenses) {
    for (const occurrence of expandRecurringExpense(expense, start, horizonWeeks)) {
      weeks[occurrence.week].moneyOut += Number(occurrence.amount) || 0;
    }
  }

  let running = openingBalance;
  let breakWeek = null;
  for (const week of weeks) {
    running = running + week.moneyIn - week.moneyOut;
    week.closingBalance = Math.round(running * 100) / 100;
    if (breakWeek === null && week.closingBalance < 0) {
      breakWeek = week.week;
    }
  }

  return { weeks, breakWeek, closingBalance: weeks[weeks.length - 1].closingBalance };
}

function weeksGained(baseBreak, newBreak, horizon) {
  if (newBreak === null) return horizon - baseBreak + 1;
  return newBreak - baseBreak;
}

function recommendActions(forecastInput) {
  const base = buildForecast(forecastInput);
  if (base.breakWeek === null) {
    return { breakWeek: null, actions: [], message: 'No shortfall projected in this horizon.' };
  }

  const horizon = forecastInput.horizonWeeks || 13;
  const candidates = [];

  for (const invoice of forecastInput.invoices || []) {
    if (invoice.status === 'paid') continue;
    const chased = (forecastInput.invoices || []).map((i) =>
      i.id === invoice.id ? { ...i, expectedDate: forecastInput.startDate } : i
    );
    const result = buildForecast({ ...forecastInput, invoices: chased });
    const gain = weeksGained(base.breakWeek, result.breakWeek, horizon);
    if (gain > 0) {
      candidates.push({
        type: 'chase_invoice',
        reference: invoice.id,
        description: `Chase invoice ${invoice.id} ($${invoice.amount})`,
        weeksGained: gain,
      });
    }
  }

  for (const expense of forecastInput.expenses || []) {
    if (expense.frequency && expense.frequency !== 'once') continue;
    const deferred = (forecastInput.expenses || []).map((e) =>
      e.id === expense.id ? { ...e, dueDate: addWeeks(e.dueDate, 4) } : e
    );
    const result = buildForecast({ ...forecastInput, expenses: deferred });
    const gain = weeksGained(base.breakWeek, result.breakWeek, horizon);
    if (gain > 0) {
      candidates.push({
        type: 'defer_expense',
        reference: expense.id,
        description: `Defer ${expense.description || expense.id} ($${expense.amount}) by 4 weeks`,
        weeksGained: gain,
      });
    }
  }

  candidates.sort((a, b) => b.weeksGained - a.weeksGained);
  return { breakWeek: base.breakWeek, actions: candidates.slice(0, 2) };
}

module.exports = { buildForecast, recommendActions, weekIndex, expandRecurringExpense, addWeeks };
