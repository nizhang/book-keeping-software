const SEED_ACCOUNTS = [
  // ASSETS
  { code: '1000', name: 'Assets',                   type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1010', name: 'Cash & Bank',               type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1020', name: 'Accounts Receivable',       type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1030', name: 'Inventory',                 type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1040', name: 'Prepaid Expenses',          type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1100', name: 'Fixed Assets',              type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1110', name: 'Equipment',                 type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1120', name: 'Accumulated Depreciation',  type: 'ASSET',     normal_balance: 'CREDIT' },
  // LIABILITIES
  { code: '2000', name: 'Liabilities',               type: 'LIABILITY', normal_balance: 'CREDIT' },
  { code: '2010', name: 'Accounts Payable',          type: 'LIABILITY', normal_balance: 'CREDIT' },
  { code: '2020', name: 'Credit Cards',              type: 'LIABILITY', normal_balance: 'CREDIT' },
  { code: '2030', name: 'Short-Term Loans',          type: 'LIABILITY', normal_balance: 'CREDIT' },
  { code: '2040', name: 'Accrued Liabilities',       type: 'LIABILITY', normal_balance: 'CREDIT' },
  { code: '2100', name: 'Long-Term Loans',           type: 'LIABILITY', normal_balance: 'CREDIT' },
  // EQUITY
  { code: '3000', name: 'Equity',                    type: 'EQUITY',    normal_balance: 'CREDIT' },
  { code: '3010', name: "Owner's Equity",            type: 'EQUITY',    normal_balance: 'CREDIT' },
  { code: '3020', name: 'Retained Earnings',         type: 'EQUITY',    normal_balance: 'CREDIT' },
  { code: '3030', name: "Owner's Draw",              type: 'EQUITY',    normal_balance: 'DEBIT'  },
  // REVENUE
  { code: '4000', name: 'Revenue',                   type: 'REVENUE',   normal_balance: 'CREDIT' },
  { code: '4010', name: 'Sales Revenue',             type: 'REVENUE',   normal_balance: 'CREDIT' },
  { code: '4020', name: 'Service Revenue',           type: 'REVENUE',   normal_balance: 'CREDIT' },
  { code: '4030', name: 'Other Income',              type: 'REVENUE',   normal_balance: 'CREDIT' },
  { code: '4040', name: 'Interest Income',           type: 'REVENUE',   normal_balance: 'CREDIT' },
  // EXPENSES
  { code: '5000', name: 'Expenses',                  type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5010', name: 'Cost of Goods Sold',        type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5020', name: 'Payroll & Wages',           type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5030', name: 'Rent',                      type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5040', name: 'Utilities',                 type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5050', name: 'Office Supplies',           type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5060', name: 'Travel & Entertainment',    type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5070', name: 'Advertising & Marketing',   type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5080', name: 'Insurance',                 type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5090', name: 'Professional Fees',         type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5100', name: 'Depreciation',              type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5110', name: 'Bank Fees & Charges',       type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5120', name: 'Subscriptions & Software',  type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5130', name: 'Meals',                     type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5140', name: 'Taxes & Licenses',          type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5150', name: 'Miscellaneous',             type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5160', name: 'Interest Expense',              type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  // Mortgage / loan specific
  { code: '2110', name: 'Mortgage Payable',              type: 'LIABILITY', normal_balance: 'CREDIT' },
  // Real estate — multi-family / rental property
  { code: '1200', name: 'Rental Property',               type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1210', name: 'Property - Land',               type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1220', name: 'Property - Building',           type: 'ASSET',     normal_balance: 'DEBIT'  },
  { code: '1230', name: 'Accum. Depreciation - Bldg',   type: 'ASSET',     normal_balance: 'CREDIT' },
  { code: '2050', name: 'Security Deposits Payable',     type: 'LIABILITY', normal_balance: 'CREDIT' },
  { code: '3040', name: 'Opening Balance Equity',        type: 'EQUITY',    normal_balance: 'CREDIT' },
  { code: '4050', name: 'Rental Income',                 type: 'REVENUE',   normal_balance: 'CREDIT' },
  { code: '4060', name: 'Late Fee Income',               type: 'REVENUE',   normal_balance: 'CREDIT' },
  { code: '4070', name: 'Parking & Misc Income',         type: 'REVENUE',   normal_balance: 'CREDIT' },
  { code: '5200', name: 'Repairs & Maintenance',         type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5210', name: 'Property Management Fees',      type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5220', name: 'Property Taxes',                type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5230', name: 'Landscaping',                   type: 'EXPENSE',   normal_balance: 'DEBIT'  },
  { code: '5240', name: 'Pest Control',                  type: 'EXPENSE',   normal_balance: 'DEBIT'  },
];

function seedIfEmpty(db) {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM accounts').get();
  if (c > 0) return;

  const insert = db.prepare(`
    INSERT INTO accounts (code, name, type, normal_balance, is_system)
    VALUES (@code, @name, @type, @normal_balance, 1)
  `);

  const seedMany = db.transaction((accounts) => {
    for (const acct of accounts) insert.run(acct);
  });

  seedMany(SEED_ACCOUNTS);
  console.log(`Chart of accounts seeded with ${SEED_ACCOUNTS.length} accounts.`);
}

module.exports = { seedIfEmpty };
