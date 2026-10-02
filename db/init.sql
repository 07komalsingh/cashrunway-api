CREATE TABLE IF NOT EXISTS account (
  id INT PRIMARY KEY AUTO_INCREMENT,
  opening_balance DECIMAL(12,2) NOT NULL,
  start_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(32) PRIMARY KEY,
  client VARCHAR(128) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid'
);

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(32) PRIMARY KEY,
  description VARCHAR(128),
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  frequency ENUM('once','weekly','fortnightly','monthly','quarterly') NOT NULL DEFAULT 'once'
);

INSERT IGNORE INTO account (id, opening_balance, start_date) VALUES (1, 8200.00, '2026-01-05');

INSERT IGNORE INTO invoices (id, client, amount, due_date, status) VALUES
  ('INV-1042', 'Harbour Dental',   1100.00, '2026-01-19', 'unpaid'),
  ('INV-1043', 'Northside Cafe',   2400.00, '2026-02-16', 'unpaid'),
  ('INV-1044', 'Platt Electrical', 3200.00, '2026-03-09', 'unpaid'),
  ('INV-1039', 'Vale Studio',      1800.00, '2025-12-15', 'paid');

INSERT IGNORE INTO expenses (id, description, amount, due_date, frequency) VALUES
  ('EXP-rent', 'Studio rent',                650.00, '2026-01-05', 'weekly'),
  ('EXP-sub',  'Software subscriptions',     180.00, '2026-01-12', 'monthly'),
  ('EXP-ins',  'Public liability insurance', 940.00, '2026-02-09', 'once'),
  ('EXP-gear', 'Equipment purchase',        4000.00, '2026-02-09', 'once');
