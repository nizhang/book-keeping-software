const { getDb } = require('../db/database');

/**
 * @param {string} startDate
 * @param {string} endDate
 * @param {number|null} classId  — when provided, only journal entries tagged with this class are included
 */
function getIncomeStatement(startDate, endDate, classId = null) {
  const db = getDb();

  // When filtering by class, only include entries explicitly tagged with that class.
  // Bank-side entries (no class_id) are excluded — we only want the category entries.
  const classFilter = classId ? 'AND je.class_id = @classId' : '';
  const params = { startDate, endDate, ...(classId ? { classId } : {}) };

  const revenueRows = db.prepare(`
    SELECT
      a.id as account_id, a.code, a.name,
      SUM(CASE WHEN je.entry_type = 'CREDIT' THEN je.amount ELSE -je.amount END) as total
    FROM journal_entries je
    JOIN accounts a ON je.account_id = a.id
    JOIN transactions t ON je.transaction_id = t.id
    WHERE a.type = 'REVENUE'
      AND t.date >= @startDate AND t.date <= @endDate
      ${classFilter}
    GROUP BY a.id
    HAVING total != 0
    ORDER BY a.code
  `).all(params);

  const expenseRows = db.prepare(`
    SELECT
      a.id as account_id, a.code, a.name,
      SUM(CASE WHEN je.entry_type = 'DEBIT' THEN je.amount ELSE -je.amount END) as total
    FROM journal_entries je
    JOIN accounts a ON je.account_id = a.id
    JOIN transactions t ON je.transaction_id = t.id
    WHERE a.type = 'EXPENSE'
      AND t.date >= @startDate AND t.date <= @endDate
      ${classFilter}
    GROUP BY a.id
    HAVING total != 0
    ORDER BY a.code
  `).all(params);

  const totalRevenue  = revenueRows.reduce((s, r) => s + r.total, 0);
  const totalExpenses = expenseRows.reduce((s, r) => s + r.total, 0);

  return {
    period: { start: startDate, end: endDate },
    classId: classId || null,
    revenue: revenueRows,
    totalRevenue,
    expenses: expenseRows,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

/**
 * @param {string} asOfDate
 * @param {number|null} classId  — when provided, only journal entries tagged with this class are included
 */
function getBalanceSheet(asOfDate, classId = null) {
  const db = getDb();

  const classFilter = classId ? 'AND je.class_id = @classId' : '';
  const params = { asOfDate, ...(classId ? { classId } : {}) };

  // Balance for an account = sum of entries up to asOfDate
  // For DEBIT-normal accounts:  balance = total DEBITs - total CREDITs
  // For CREDIT-normal accounts: balance = total CREDITs - total DEBITs
  const accountBalances = db.prepare(`
    SELECT
      a.id as account_id, a.code, a.name, a.type, a.normal_balance,
      SUM(CASE WHEN je.entry_type = 'DEBIT'  THEN je.amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN je.entry_type = 'CREDIT' THEN je.amount ELSE 0 END) as total_credit
    FROM accounts a
    JOIN journal_entries je ON je.account_id = a.id
    JOIN transactions t ON je.transaction_id = t.id
    WHERE a.type IN ('ASSET','LIABILITY','EQUITY')
      AND t.date <= @asOfDate
      ${classFilter}
    GROUP BY a.id
    HAVING (total_debit + total_credit) != 0
    ORDER BY a.code
  `).all(params);

  const computeBalance = (row) => {
    if (row.normal_balance === 'DEBIT') {
      return row.total_debit - row.total_credit;
    } else {
      const creditBalance = row.total_credit - row.total_debit;
      // Contra-assets (ASSET type with CREDIT normal balance, e.g. Accumulated Depreciation)
      // reduce total assets — return a negative value so the section total is correct.
      if (row.type === 'ASSET') return -creditBalance;
      return creditBalance;
    }
  };

  const assets      = accountBalances.filter(r => r.type === 'ASSET');
  const liabilities = accountBalances.filter(r => r.type === 'LIABILITY');
  const equity      = accountBalances.filter(r => r.type === 'EQUITY');

  // Net income through asOfDate — also filtered by class when applicable
  const netIncomeRow = db.prepare(`
    SELECT
      SUM(CASE
        WHEN a.type = 'REVENUE' AND je.entry_type = 'CREDIT' THEN je.amount
        WHEN a.type = 'REVENUE' AND je.entry_type = 'DEBIT'  THEN -je.amount
        WHEN a.type = 'EXPENSE' AND je.entry_type = 'DEBIT'  THEN -je.amount
        WHEN a.type = 'EXPENSE' AND je.entry_type = 'CREDIT' THEN je.amount
        ELSE 0
      END) as net_income
    FROM journal_entries je
    JOIN accounts a ON je.account_id = a.id
    JOIN transactions t ON je.transaction_id = t.id
    WHERE a.type IN ('REVENUE','EXPENSE')
      AND t.date <= @asOfDate
      ${classFilter}
  `).get(params);

  const retainedEarnings = netIncomeRow ? (netIncomeRow.net_income || 0) : 0;

  const mapBalance = (rows) => rows.map(r => ({ ...r, balance: computeBalance(r) }));

  const assetItems      = mapBalance(assets);
  const liabilityItems  = mapBalance(liabilities);
  const equityItems     = mapBalance(equity);

  const totalAssets      = assetItems.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilityItems.reduce((s, r) => s + r.balance, 0);

  // Derive total equity from the accounting equation: Assets = Liabilities + Equity.
  // This guarantees the balance sheet always balances regardless of equity account entries.
  const totalEquity = totalAssets - totalLiabilities;

  // Build equity line items from journal entries (informational breakdown)
  const equityFromAccounts = equityItems.reduce((s, r) => s + r.balance, 0);
  const equityDisplayItems = [
    ...equityItems,
    ...(retainedEarnings !== 0
      ? [{ account_id: null, code: 'NI', name: 'Net Income (Current Period)', type: 'EQUITY', balance: retainedEarnings }]
      : []),
  ];

  // If the sum of recorded equity items doesn't equal the derived total, add a
  // reconciling line so users know to check / set up opening balances.
  const unrecorded = totalEquity - equityFromAccounts - retainedEarnings;
  if (Math.abs(unrecorded) > 0.01) {
    equityDisplayItems.push({
      account_id: null,
      code: '—',
      name: 'Unrecorded Equity (set up Opening Balances)',
      type: 'EQUITY',
      balance: unrecorded,
      isReconciling: true,
    });
  }

  // Balanced when all equity is accounted for (works for both full and class-filtered views
  // provided every journal entry is tagged with a class).
  const isBalanced = Math.abs(unrecorded) <= 0.01;

  return {
    asOfDate,
    classId: classId || null,
    assets:      { items: assetItems,        total: totalAssets },
    liabilities: { items: liabilityItems,    total: totalLiabilities },
    equity:      { items: equityDisplayItems, total: totalEquity },
    isBalanced,
  };
}

module.exports = { getIncomeStatement, getBalanceSheet };
