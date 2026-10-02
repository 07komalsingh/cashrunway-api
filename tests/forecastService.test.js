'use strict';

const {
  buildForecast,
  recommendActions,
  weekIndex,
  expandRecurringExpense,
  addWeeks,
} = require('../src/services/forecastService');

const START = '2026-01-05';

describe('weekIndex', () => {
  test('returns 0 for a date in the first week', () => {
    expect(weekIndex(START, '2026-01-07')).toBe(0);
  });

  test('returns 1 for a date in the second week', () => {
    expect(weekIndex(START, '2026-01-13')).toBe(1);
  });

  test('returns a negative index for a date before the start', () => {
    expect(weekIndex(START, '2025-12-20')).toBeLessThan(0);
  });

  test('throws when given an invalid date', () => {
    expect(() => weekIndex(START, 'not-a-date')).toThrow(TypeError);
  });
});

describe('expandRecurringExpense', () => {
  test('expands a weekly expense across every week of the horizon', () => {
    const out = expandRecurringExpense(
      { amount: 100, dueDate: START, frequency: 'weekly' }, START, 13
    );
    expect(out).toHaveLength(13);
  });

  test('expands a monthly expense roughly every four weeks', () => {
    const out = expandRecurringExpense(
      { amount: 100, dueDate: START, frequency: 'monthly' }, START, 13
    );
    expect(out.map((o) => o.week)).toEqual([0, 4, 8, 12]);
  });

  test('includes a one-off expense exactly once', () => {
    const out = expandRecurringExpense(
      { amount: 500, dueDate: '2026-02-09', frequency: 'once' }, START, 13
    );
    expect(out).toHaveLength(1);
  });

  test('excludes a one-off expense that falls outside the horizon', () => {
    const out = expandRecurringExpense(
      { amount: 500, dueDate: '2027-01-01', frequency: 'once' }, START, 13
    );
    expect(out).toHaveLength(0);
  });
});

describe('buildForecast', () => {
  const base = {
    openingBalance: 5000,
    startDate: START,
    invoices: [{ id: 'INV-1', amount: 2000, dueDate: '2026-02-02', status: 'unpaid' }],
    expenses: [{ id: 'E1', amount: 900, dueDate: START, frequency: 'weekly' }],
  };

  test('returns one row per week of the horizon', () => {
    expect(buildForecast(base).weeks).toHaveLength(13);
  });

  test('honours a custom horizon', () => {
    expect(buildForecast({ ...base, horizonWeeks: 6 }).weeks).toHaveLength(6);
  });

  test('identifies the week the balance first goes negative', () => {
    const result = buildForecast(base);
    expect(result.breakWeek).toBe(8);
  });

  test('reports no break week when income covers outgoings', () => {
    const result = buildForecast({ ...base, openingBalance: 100000 });
    expect(result.breakWeek).toBeNull();
  });

  test('ignores invoices that have already been paid', () => {
    const withPaid = buildForecast({
      ...base,
      invoices: [{ id: 'INV-1', amount: 2000, dueDate: '2026-02-02', status: 'paid' }],
    });
    const withoutPaid = buildForecast({ ...base, invoices: [] });
    expect(withPaid.closingBalance).toBe(withoutPaid.closingBalance);
  });

  test('credits invoice income to the correct week', () => {
    const result = buildForecast({ ...base, expenses: [] });
    expect(result.weeks[4].moneyIn).toBe(2000);
  });

  test('rejects a non-numeric opening balance', () => {
    expect(() => buildForecast({ ...base, openingBalance: 'lots' })).toThrow(TypeError);
  });

  test('rejects a horizon outside the supported range', () => {
    expect(() => buildForecast({ ...base, horizonWeeks: 0 })).toThrow(RangeError);
    expect(() => buildForecast({ ...base, horizonWeeks: 60 })).toThrow(RangeError);
  });
});

describe('recommendActions', () => {
  const tight = {
    openingBalance: 3000,
    startDate: START,
    invoices: [
      { id: 'INV-1042', amount: 4000, dueDate: '2026-03-16', status: 'unpaid' },
    ],
    expenses: [
      { id: 'EXP-rent', description: 'Rent', amount: 500, dueDate: START, frequency: 'weekly' },
      { id: 'EXP-gear', description: 'Equipment', amount: 2500, dueDate: '2026-02-02', frequency: 'once' },
    ],
  };

  test('returns at most two actions', () => {
    expect(recommendActions(tight).actions.length).toBeLessThanOrEqual(2);
  });

  test('every recommended action gains at least one week', () => {
    for (const action of recommendActions(tight).actions) {
      expect(action.weeksGained).toBeGreaterThan(0);
    }
  });

  test('orders actions by the weeks they gain, highest first', () => {
    const { actions } = recommendActions(tight);
    if (actions.length === 2) {
      expect(actions[0].weeksGained).toBeGreaterThanOrEqual(actions[1].weeksGained);
    }
  });

  test('recommends nothing when there is no shortfall', () => {
    const result = recommendActions({ ...tight, openingBalance: 500000 });
    expect(result.breakWeek).toBeNull();
    expect(result.actions).toEqual([]);
  });
});

describe('addWeeks', () => {
  test('moves a date forward by whole weeks', () => {
    expect(addWeeks('2026-01-05', 2)).toBe('2026-01-19');
  });
});
