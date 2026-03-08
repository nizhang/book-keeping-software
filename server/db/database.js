const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/bookkeeping.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);

    // Migrations: add columns that may not exist in older databases
    try { db.exec('ALTER TABLE journal_entries ADD COLUMN class_id INTEGER REFERENCES classes(id)'); } catch {}
    // Index on class_id (after migration so column is guaranteed to exist)
    try { db.exec('CREATE INDEX IF NOT EXISTS idx_journal_entries_class ON journal_entries(class_id)'); } catch {}

    // Add transactions.type column (for opening_balance vs import)
    try { db.exec(`ALTER TABLE transactions ADD COLUMN type TEXT DEFAULT 'import'`); } catch {}
    // Add transactions.class_id — default class assigned at import time, pre-populates split modal
    try { db.exec(`ALTER TABLE transactions ADD COLUMN class_id INTEGER REFERENCES classes(id)`); } catch {}

    // Seed any missing system accounts added after initial setup
    const seedMissingAccounts = db.prepare(
      'INSERT OR IGNORE INTO accounts (code, name, type, normal_balance, is_system) VALUES (@code, @name, @type, @normal_balance, 1)'
    );
    const ensureAccounts = db.transaction(() => {
      // Previously added accounts
      seedMissingAccounts.run({ code: '5160', name: 'Interest Expense',              type: 'EXPENSE',   normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '2110', name: 'Mortgage Payable',              type: 'LIABILITY', normal_balance: 'CREDIT' });
      // Real estate chart of accounts
      seedMissingAccounts.run({ code: '1200', name: 'Rental Property',               type: 'ASSET',     normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '1210', name: 'Property - Land',               type: 'ASSET',     normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '1220', name: 'Property - Building',           type: 'ASSET',     normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '1230', name: 'Accum. Depreciation - Bldg',   type: 'ASSET',     normal_balance: 'CREDIT' });
      seedMissingAccounts.run({ code: '2050', name: 'Security Deposits Payable',     type: 'LIABILITY', normal_balance: 'CREDIT' });
      seedMissingAccounts.run({ code: '3040', name: 'Opening Balance Equity',        type: 'EQUITY',    normal_balance: 'CREDIT' });
      seedMissingAccounts.run({ code: '4050', name: 'Rental Income',                 type: 'REVENUE',   normal_balance: 'CREDIT' });
      seedMissingAccounts.run({ code: '4060', name: 'Late Fee Income',               type: 'REVENUE',   normal_balance: 'CREDIT' });
      seedMissingAccounts.run({ code: '4070', name: 'Parking & Misc Income',         type: 'REVENUE',   normal_balance: 'CREDIT' });
      seedMissingAccounts.run({ code: '5200', name: 'Repairs & Maintenance',         type: 'EXPENSE',   normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '5210', name: 'Property Management Fees',      type: 'EXPENSE',   normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '5220', name: 'Property Taxes',                type: 'EXPENSE',   normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '5230', name: 'Landscaping',                   type: 'EXPENSE',   normal_balance: 'DEBIT'  });
      seedMissingAccounts.run({ code: '5240', name: 'Pest Control',                  type: 'EXPENSE',   normal_balance: 'DEBIT'  });
    });
    ensureAccounts();
  }
  return db;
}

module.exports = { getDb };
