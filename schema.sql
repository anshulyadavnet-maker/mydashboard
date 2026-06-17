-- Milk Hissab Database Schema for Cloudflare D1 (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS milk_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS milk_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO milk_categories (id, user_id, name) VALUES (1, NULL, 'Cow');
INSERT OR IGNORE INTO milk_categories (id, user_id, name) VALUES (2, NULL, 'Buffalo');
INSERT OR IGNORE INTO milk_categories (id, user_id, name) VALUES (3, NULL, 'Mixed');

CREATE TABLE IF NOT EXISTS milk_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milksupplier_id INTEGER NOT NULL REFERENCES milk_suppliers(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES milk_categories(id),
  rate REAL NOT NULL DEFAULT 0,
  autogen_quantity REAL DEFAULT 0,
  autogen_daily INTEGER DEFAULT 0,
  autogen_time TEXT DEFAULT '07:30',
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  start_date TEXT,
  end_date TEXT,
  active INTEGER DEFAULT 1,
  UNIQUE(user_id, milksupplier_id, category_id, autogen_time, year, month)
);

CREATE TABLE IF NOT EXISTS milk_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES milk_accounts(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  entry_type TEXT DEFAULT 'auto',
  UNIQUE(account_id, entry_date)
);

CREATE TABLE IF NOT EXISTS milk_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES milk_accounts(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notes and Tags
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  color TEXT DEFAULT '#ffffff',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS note_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE(note_id, tag)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  expense_date TEXT NOT NULL,
  color TEXT DEFAULT '#ffffff',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Passwords
CREATE TABLE IF NOT EXISTS passwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- Website/App
  service_id TEXT,           -- User ID
  email TEXT,
  password TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT DEFAULT '#ffffff',
  website_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_passwords_user ON passwords(user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user_date ON milk_accounts(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_entries_account ON milk_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_account ON milk_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON milk_suppliers(user_id);

-- Tool usage tracking table
CREATE TABLE IF NOT EXISTS tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  use_count INTEGER DEFAULT 0,
  last_used_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_user ON tool_usage(user_id);