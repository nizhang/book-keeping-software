const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { saveOpeningBalances } = require('../services/accountingService');

// GET /api/opening-balances
// Returns current opening balance lines (excluding the OBE offset entries)
router.get('/', (req, res) => {
  const db = getDb();
  const txn = db.prepare(`SELECT * FROM transactions WHERE type = 'opening_balance' LIMIT 1`).get();
  if (!txn) return res.json({ asOfDate: null, lines: [] });

  const obEquityAccount = db.prepare(`SELECT id FROM accounts WHERE code = '3040'`).get();

  const entries = db.prepare(`
    SELECT je.*, a.name as account_name, a.code as account_code, a.type as account_type,
           a.normal_balance, cls.name as class_name
    FROM journal_entries je
    JOIN accounts a ON je.account_id = a.id
    LEFT JOIN classes cls ON je.class_id = cls.id
    WHERE je.transaction_id = ?
  `).all(txn.id);

  // Return only the "real" account lines (skip OBE offset entries)
  const lines = entries
    .filter(e => !obEquityAccount || e.account_id !== obEquityAccount.id)
    .map(e => ({
      accountId:    e.account_id,
      accountName:  e.account_name,
      accountCode:  e.account_code,
      accountType:  e.account_type,
      amount:       e.amount,
      classId:      e.class_id,
      className:    e.class_name,
    }));

  res.json({ asOfDate: txn.date, lines });
});

// POST /api/opening-balances  (upsert — replaces any existing opening balances)
// Body: { asOfDate: 'YYYY-MM-DD', lines: [{ accountId, amount, classId? }] }
router.post('/', (req, res, next) => {
  const { asOfDate, lines } = req.body;
  if (!asOfDate) {
    return next(Object.assign(new Error('asOfDate is required'), { status: 400 }));
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return next(Object.assign(new Error('lines[] must be a non-empty array'), { status: 400 }));
  }
  try {
    const parsed = lines.map(l => ({
      accountId: parseInt(l.accountId),
      amount:    parseFloat(l.amount),
      classId:   l.classId ? parseInt(l.classId) : null,
    }));
    const result = saveOpeningBalances(asOfDate, parsed);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
