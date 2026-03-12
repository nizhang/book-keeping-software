const { getDb } = require('../db/database');

/**
 * Categorize a transaction using a splits array.
 * splits: [{ categoryAccountId, amount, classId?, memo? }]
 * The sum of split amounts must equal Math.abs(txn.amount) within $0.01.
 */
function categorizeTransaction(transactionId, splits) {
  if (!Array.isArray(splits) || splits.length === 0) {
    throw Object.assign(new Error('splits array is required and must not be empty'), { status: 400 });
  }

  const db = getDb();
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!txn) throw Object.assign(new Error('Transaction not found'), { status: 404 });
  if (!txn.source_account_id) throw Object.assign(new Error('Transaction has no source account'), { status: 400 });

  // Bank entry direction: DEBIT for money in, CREDIT for money out
  const bankEntryType = txn.amount >= 0 ? 'DEBIT' : 'CREDIT';

  // Validate splits and determine per-split entry type.
  // P&L accounts use their natural side (EXPENSE→DEBIT, REVENUE→CREDIT).
  // Balance-sheet accounts (ASSET/LIABILITY/EQUITY) follow the transaction direction.
  // This allows mixed income+expense splits on a single transaction (e.g. net
  // property-manager deposit = rent collected minus expenses paid).
  const splitWithTypes = [];
  for (const split of splits) {
    if (!split.categoryAccountId) throw Object.assign(new Error('Each split must have a categoryAccountId'), { status: 400 });
    if (typeof split.amount !== 'number' || split.amount <= 0) throw Object.assign(new Error('Each split amount must be a positive number'), { status: 400 });

    const acct = db.prepare('SELECT * FROM accounts WHERE id = ?').get(split.categoryAccountId);
    if (!acct) throw Object.assign(new Error(`Account ${split.categoryAccountId} not found`), { status: 404 });

    let entryType;
    if (acct.type === 'EXPENSE') entryType = 'DEBIT';
    else if (acct.type === 'REVENUE') entryType = 'CREDIT';
    else entryType = txn.amount >= 0 ? 'CREDIT' : 'DEBIT'; // balance sheet: follow txn direction

    splitWithTypes.push({ ...split, entryType });
  }

  // Signed validation: CREDIT = positive contribution, DEBIT = negative.
  // Net must equal the transaction amount.
  const signedTotal = splitWithTypes.reduce((s, sp) =>
    s + (sp.entryType === 'CREDIT' ? sp.amount : -sp.amount), 0);

  if (Math.abs(signedTotal - txn.amount) > 0.01) {
    throw Object.assign(new Error(
      `Net split total (${signedTotal.toFixed(2)}) must equal transaction amount (${txn.amount.toFixed(2)})`
    ), { status: 400 });
  }

  const doIt = db.transaction(() => {
    db.prepare('DELETE FROM journal_entries WHERE transaction_id = ?').run(transactionId);

    // Bank entries: one per distinct class_id, net cash impact for that class.
    // CREDIT splits (revenue) increase the bank; DEBIT splits (expense) decrease it.
    // If a class has more expenses than income, the bank entry flips to CREDIT.
    const bankByClass = new Map();
    for (const sp of splitWithTypes) {
      const key = sp.classId || null;
      const contribution = sp.entryType !== bankEntryType ? sp.amount : -sp.amount;
      bankByClass.set(key, (bankByClass.get(key) || 0) + contribution);
    }
    const insertBank = db.prepare(`
      INSERT INTO journal_entries (transaction_id, account_id, entry_type, amount, memo, class_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const [classId, netAmt] of bankByClass) {
      if (Math.abs(netAmt) < 0.001) continue;
      const entryType = netAmt >= 0 ? bankEntryType : (bankEntryType === 'DEBIT' ? 'CREDIT' : 'DEBIT');
      insertBank.run(transactionId, txn.source_account_id, entryType, Math.abs(netAmt), null, classId);
    }

    // Category entries with per-split entry types
    const insertSplit = db.prepare(`
      INSERT INTO journal_entries (transaction_id, account_id, entry_type, amount, memo, class_id)
      VALUES (@txId, @accountId, @entryType, @amount, @memo, @classId)
    `);
    for (const split of splitWithTypes) {
      insertSplit.run({
        txId: transactionId,
        accountId: split.categoryAccountId,
        entryType: split.entryType,
        amount: split.amount,
        memo: split.memo || null,
        classId: split.classId || null,
      });
    }

    db.prepare(`UPDATE transactions SET is_categorized = 1, updated_at = datetime('now') WHERE id = ?`)
      .run(transactionId);
  });

  doIt();
  return { success: true, transactionId, splitCount: splits.length, amount: txn.amount };
}

function uncategorizeTransaction(transactionId) {
  const db = getDb();
  const doIt = db.transaction(() => {
    db.prepare('DELETE FROM journal_entries WHERE transaction_id = ?').run(transactionId);
    db.prepare(`UPDATE transactions SET is_categorized = 0, updated_at = datetime('now') WHERE id = ?`).run(transactionId);
  });
  doIt();
  return { success: true };
}

/**
 * Bulk categorize — single account only (no splits for bulk).
 * Wraps each into a single-item splits array internally.
 */
function bulkCategorize(transactionIds, categoryAccountId, memo) {
  const db = getDb();
  const results = { success: 0, failed: [] };
  for (const id of transactionIds) {
    try {
      const txn = db.prepare('SELECT amount FROM transactions WHERE id = ?').get(id);
      if (!txn) throw new Error('Transaction not found');
      categorizeTransaction(id, [{ categoryAccountId, amount: Math.abs(txn.amount), memo }]);
      results.success++;
    } catch (e) {
      results.failed.push({ id, error: e.message });
    }
  }
  return results;
}

/**
 * Save (upsert) opening balances.
 * lines: [{ accountId, amount, classId? }]
 *
 * For each line, two journal entries are created:
 *   ASSET   (normal_balance=DEBIT)  → DEBIT account, CREDIT Opening Balance Equity (3040)
 *   LIABILITY/EQUITY (normal_balance=CREDIT) → CREDIT account, DEBIT Opening Balance Equity (3040)
 *
 * Any existing opening_balance transaction is deleted first (upsert pattern).
 */
function saveOpeningBalances(asOfDate, lines) {
  if (!asOfDate) throw Object.assign(new Error('asOfDate is required'), { status: 400 });
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Object.assign(new Error('lines array must be non-empty'), { status: 400 });
  }

  const db = getDb();

  const obEquityAccount = db.prepare(`SELECT id FROM accounts WHERE code = '3040'`).get();
  if (!obEquityAccount) {
    throw Object.assign(new Error('Opening Balance Equity account (code 3040) not found — run migrations first'), { status: 500 });
  }

  const doIt = db.transaction(() => {
    // Delete any existing opening balance transaction(s) + their journal entries (CASCADE)
    db.prepare(`DELETE FROM transactions WHERE type = 'opening_balance'`).run();

    // Create one new opening_balance transaction
    const txnResult = db.prepare(`
      INSERT INTO transactions
        (date, description, amount, type, is_categorized, source_account_id, fit_id, import_batch_id)
      VALUES
        (@date, 'Opening Balances', 0, 'opening_balance', 1, NULL, NULL, NULL)
    `).run({ date: asOfDate });
    const txnId = txnResult.lastInsertRowid;

    const insertEntry = db.prepare(`
      INSERT INTO journal_entries (transaction_id, account_id, entry_type, amount, memo, class_id)
      VALUES (@txnId, @accountId, @entryType, @amount, 'Opening Balance', @classId)
    `);

    for (const line of lines) {
      if (!line.accountId) throw Object.assign(new Error('Each line must have an accountId'), { status: 400 });
      if (typeof line.amount !== 'number' || line.amount === 0) {
        throw Object.assign(new Error('Each line amount must be non-zero'), { status: 400 });
      }

      const acct = db.prepare('SELECT * FROM accounts WHERE id = ?').get(line.accountId);
      if (!acct) throw Object.assign(new Error(`Account ${line.accountId} not found`), { status: 404 });

      const absAmount  = Math.abs(line.amount);
      const isNegative = line.amount < 0;

      // ASSET (DEBIT normal): DEBIT the asset account, CREDIT OBE
      // LIABILITY/EQUITY (CREDIT normal): CREDIT the account, DEBIT OBE
      // If amount is negative (e.g. equity deficit), flip both sides
      const isDebitNormal = acct.normal_balance === 'DEBIT';
      let acctEntryType   = isDebitNormal ? 'DEBIT'  : 'CREDIT';
      let obeEntryType    = isDebitNormal ? 'CREDIT' : 'DEBIT';
      if (isNegative) {
        acctEntryType = acctEntryType === 'DEBIT' ? 'CREDIT' : 'DEBIT';
        obeEntryType  = obeEntryType  === 'DEBIT' ? 'CREDIT' : 'DEBIT';
      }

      // Account entry
      insertEntry.run({
        txnId:     txnId,
        accountId: line.accountId,
        entryType: acctEntryType,
        amount:    absAmount,
        classId:   line.classId || null,
      });

      // Opening Balance Equity offset entry
      insertEntry.run({
        txnId:     txnId,
        accountId: obEquityAccount.id,
        entryType: obeEntryType,
        amount:    absAmount,
        classId:   line.classId || null,
      });
    }

    return txnId;
  });

  const txnId = doIt();
  return { success: true, transactionId: txnId, lineCount: lines.length };
}

module.exports = { categorizeTransaction, uncategorizeTransaction, bulkCategorize, saveOpeningBalances };
