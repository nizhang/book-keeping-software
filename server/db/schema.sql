PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  normal_balance  TEXT NOT NULL CHECK(normal_balance IN ('DEBIT','CREDIT')),
  parent_id       INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_system       INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  filename        TEXT NOT NULL,
  file_type       TEXT NOT NULL,
  row_count       INTEGER NOT NULL DEFAULT 0,
  imported_count  INTEGER NOT NULL DEFAULT 0,
  skipped_count   INTEGER NOT NULL DEFAULT 0,
  imported_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  import_batch_id   INTEGER REFERENCES import_batches(id) ON DELETE SET NULL,
  date              TEXT NOT NULL,
  description       TEXT NOT NULL,
  amount            REAL NOT NULL,
  raw_amount        TEXT,
  currency          TEXT NOT NULL DEFAULT 'USD',
  reference         TEXT,
  fit_id            TEXT,
  source_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_categorized    INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_fitid
  ON transactions(source_account_id, fit_id)
  WHERE fit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_categorized ON transactions(is_categorized);

CREATE TABLE IF NOT EXISTS journal_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id  INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id      INTEGER NOT NULL REFERENCES accounts(id),
  entry_type      TEXT NOT NULL CHECK(entry_type IN ('DEBIT','CREDIT')),
  amount          REAL NOT NULL CHECK(amount > 0),
  memo            TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction ON journal_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_account ON journal_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_account_type ON journal_entries(account_id, entry_type);

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
