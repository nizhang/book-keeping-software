const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { categorizeTransaction, uncategorizeTransaction, bulkCategorize } = require('../services/accountingService');

// GET /api/transactions
router.get('/', (req, res) => {
  const db = getDb();
  const {
    page = 1, limit = 50,
    startDate, endDate,
    accountId, categorized,
    search,
    sortBy = 'date', sortDir = 'desc',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [`(t.type IS NULL OR t.type != 'opening_balance')`];
  const params = {};

  if (startDate) { conditions.push('t.date >= @startDate'); params.startDate = startDate; }
  if (endDate)   { conditions.push('t.date <= @endDate');   params.endDate   = endDate;   }
  if (accountId) { conditions.push('t.source_account_id = @accountId'); params.accountId = accountId; }
  if (categorized === 'true')  conditions.push('t.is_categorized = 1');
  if (categorized === 'false') conditions.push('t.is_categorized = 0');
  if (search)    { conditions.push("t.description LIKE @search"); params.search = `%${search}%`; }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const validSortCols = { date: 't.date', description: 't.description', amount: 't.amount' };
  const orderCol = validSortCols[sortBy] || 't.date';
  const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM transactions t ${where}`).get(params);

  const rows = db.prepare(`
    SELECT t.*,
      a.name as source_account_name,
      (SELECT json_group_array(json_object(
        'id', je.id, 'account_id', je.account_id, 'entry_type', je.entry_type, 'amount', je.amount,
        'account_name', acc.name, 'account_code', acc.code,
        'class_id', je.class_id, 'class_name', cls.name
      )) FROM journal_entries je
        JOIN accounts acc ON je.account_id = acc.id
        LEFT JOIN classes cls ON je.class_id = cls.id
        WHERE je.transaction_id = t.id) as journal_entries
    FROM transactions t
    LEFT JOIN accounts a ON t.source_account_id = a.id
    ${where}
    ORDER BY ${orderCol} ${orderDir}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: parseInt(limit), offset });

  // Parse journal_entries JSON string
  const data = rows.map(r => ({
    ...r,
    journal_entries: r.journal_entries ? JSON.parse(r.journal_entries) : [],
  }));

  res.json({ data, total: countRow.total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/transactions/:id
router.get('/:id', (req, res, next) => {
  const db = getDb();
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!txn) return next(Object.assign(new Error('Transaction not found'), { status: 404 }));

  const entries = db.prepare(`
    SELECT je.*, a.name as account_name, a.code as account_code, a.type as account_type,
           cls.name as class_name
    FROM journal_entries je
    JOIN accounts a ON je.account_id = a.id
    LEFT JOIN classes cls ON je.class_id = cls.id
    WHERE je.transaction_id = ?
  `).all(req.params.id);

  res.json({ ...txn, journal_entries: entries });
});

// PUT /api/transactions/:id
router.put('/:id', (req, res, next) => {
  const db = getDb();
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!txn) return next(Object.assign(new Error('Transaction not found'), { status: 404 }));

  const { notes, description, date } = req.body;
  db.prepare(`
    UPDATE transactions SET
      notes = COALESCE(@notes, notes),
      description = COALESCE(@description, description),
      date = COALESCE(@date, date),
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ id: req.params.id, notes: notes || null, description: description || null, date: date || null });

  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id));
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res, next) => {
  const db = getDb();
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!txn) return next(Object.assign(new Error('Transaction not found'), { status: 404 }));
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PATCH /api/transactions/:id/flip-amount
// Negates the transaction amount and clears any existing categorization.
// Use this to mark an imported transaction that shows as positive but is actually money going OUT.
router.patch('/:id/flip-amount', (req, res, next) => {
  try {
    const db = getDb();
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!txn) return next(Object.assign(new Error('Transaction not found'), { status: 404 }));
    db.transaction(() => {
      db.prepare('DELETE FROM journal_entries WHERE transaction_id = ?').run(txn.id);
      db.prepare(`UPDATE transactions SET amount = ?, is_categorized = 0, updated_at = datetime('now') WHERE id = ?`)
        .run(-txn.amount, txn.id);
    })();
    res.json({ success: true, newAmount: -txn.amount });
  } catch (e) { next(e); }
});

// POST /api/transactions/:id/categorize
// Body: { splits: [{ categoryAccountId, amount, classId?, memo? }] }
router.post('/:id/categorize', (req, res, next) => {
  const { splits } = req.body;
  if (!Array.isArray(splits) || splits.length === 0) {
    return next(Object.assign(new Error('splits array is required'), { status: 400 }));
  }
  try {
    const parsed = splits.map(s => ({
      categoryAccountId: parseInt(s.categoryAccountId),
      amount: parseFloat(s.amount),
      classId: s.classId ? parseInt(s.classId) : null,
      memo: s.memo || null,
    }));
    const result = categorizeTransaction(parseInt(req.params.id), parsed);
    res.json(result);
  } catch (e) { next(e); }
});

// DELETE /api/transactions/:id/categorize
router.delete('/:id/categorize', (req, res, next) => {
  try {
    const result = uncategorizeTransaction(parseInt(req.params.id));
    res.json(result);
  } catch (e) { next(e); }
});

// POST /api/transactions/bulk-categorize
router.post('/bulk-categorize', (req, res, next) => {
  const { transactionIds, categoryAccountId, memo } = req.body;
  if (!Array.isArray(transactionIds) || !categoryAccountId) {
    return next(Object.assign(new Error('transactionIds[] and categoryAccountId are required'), { status: 400 }));
  }
  try {
    const result = bulkCategorize(transactionIds.map(Number), parseInt(categoryAccountId), memo);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
