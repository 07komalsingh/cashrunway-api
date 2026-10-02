'use strict';

/**
 * Sample data so the API is usable immediately, and so the demo video has
 * something meaningful to show.
 */
module.exports = {
  account: { openingBalance: 8200, startDate: '2026-01-05' },
  invoices: [
    { id: 'INV-1042', client: 'Harbour Dental', amount: 1100, dueDate: '2026-01-19', status: 'unpaid' },
    { id: 'INV-1043', client: 'Northside Cafe', amount: 2400, dueDate: '2026-02-16', status: 'unpaid' },
    { id: 'INV-1044', client: 'Platt Electrical', amount: 3200, dueDate: '2026-03-09', status: 'unpaid' },
    { id: 'INV-1039', client: 'Vale Studio', amount: 1800, dueDate: '2025-12-15', status: 'paid' },
  ],
  expenses: [
    { id: 'EXP-rent', description: 'Studio rent', amount: 650, dueDate: '2026-01-05', frequency: 'weekly' },
    { id: 'EXP-sub', description: 'Software subscriptions', amount: 180, dueDate: '2026-01-12', frequency: 'monthly' },
    { id: 'EXP-ins', description: 'Public liability insurance', amount: 940, dueDate: '2026-02-09', frequency: 'once' },
    { id: 'EXP-gear', description: 'Equipment purchase', amount: 4000, dueDate: '2026-02-09', frequency: 'once' },
  ],
};
