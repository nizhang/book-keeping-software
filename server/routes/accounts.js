const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/accounts
router.get('/', (req, res) => {
  const db = getDb();
  const accounts = db.prepare(`
    SELECT * FROM accounts WHERE is_active = 1 ORDER BY code
  `).all();
  res.json(accounts);
});

// GET /api/accounts/:id
router.get('/:id', (req, res, next) => {
  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return next(Object.assign(new Error('Account not found'), { status: 404 }));

  // Compute balance
  const balance = db.prepare(`
    SELECT
      SUM(CASE WHEN entry_type = 'DEBIT'  THEN amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) as total_credit
    FROM journal_entries WHERE account_id = ?
  `).get(req.params.id);

  const td = balance.total_debit  || 0;
  const tc = balance.total_credit || 0;
  const bal = account.normal_balance === 'DEBIT' ? td - tc : tc - td;

  res.json({ ...account, balance: bal });
});

// POST /api/accounts
router.post('/', (req, res, next) => {
  const { code, name, type, normal_balance, parent_id, description } = req.body;
  if (!code || !name || !type || !normal_balance) {
    return next(Object.assign(new Error('code, name, type, normal_balance are required'), { status: 400 }));
  }

  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO accounts (code, name, type, normal_balance, parent_id, description)
      VALUES (@code, @name, @type, @normal_balance, @parent_id, @description)
    `).run({ code, name, type, normal_balance, parent_id: parent_id || null, description: description || null });

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(account);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return next(Object.assign(new Error(`Account code '${code}' already exists`), { status: 409 }));
    next(e);
  }
});

// PUT /api/accounts/:id
router.put('/:id', (req, res, next) => {
  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return next(Object.assign(new Error('Account not found'), { status: 404 }));

  const { name, description, parent_id, is_active } = req.body;
  db.prepare(`
    UPDATE accounts SET
      name = COALESCE(@name, name),
      description = COALESCE(@description, description),
      parent_id = @parent_id,
      is_active = COALESCE(@is_active, is_active),
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: req.params.id,
    name: name || null,
    description: description || null,
    parent_id: parent_id !== undefined ? parent_id : account.parent_id,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : null,
  });

  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id));
});

// DELETE /api/accounts/:id
// Hard-deletes if no journal entries exist; soft-deletes (is_active=0) if entries exist.
router.delete('/:id', (req, res, next) => {
  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return next(Object.assign(new Error('Account not found'), { status: 404 }));

  const hasEntries = db.prepare('SELECT 1 FROM journal_entries WHERE account_id = ? LIMIT 1').get(req.params.id);

  if (hasEntries) {
    // Soft-delete: hide from chart of accounts but preserve historical journal entries
    db.prepare(`UPDATE accounts SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ success: true, deactivated: true });
  } else {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true, deactivated: false });
  }
});

module.exports = router;
