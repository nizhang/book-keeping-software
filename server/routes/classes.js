const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// GET /api/classes
router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM classes WHERE is_active = 1 ORDER BY name').all());
});

// POST /api/classes
router.post('/', (req, res, next) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return next(Object.assign(new Error('name is required'), { status: 400 }));
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO classes (name, description) VALUES (@name, @description)
    `).run({ name: name.trim(), description: description || null });
    res.status(201).json(db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return next(Object.assign(new Error(`Class '${name}' already exists`), { status: 409 }));
    next(e);
  }
});

// PUT /api/classes/:id
router.put('/:id', (req, res, next) => {
  const db = getDb();
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
  if (!cls) return next(Object.assign(new Error('Class not found'), { status: 404 }));

  const { name, description } = req.body;
  try {
    db.prepare(`
      UPDATE classes SET
        name = COALESCE(@name, name),
        description = COALESCE(@description, description),
        updated_at = datetime('now')
      WHERE id = @id
    `).run({ id: req.params.id, name: name || null, description: description || null });
    res.json(db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return next(Object.assign(new Error(`Class '${name}' already exists`), { status: 409 }));
    next(e);
  }
});

// DELETE /api/classes/:id  (soft delete)
router.delete('/:id', (req, res, next) => {
  const db = getDb();
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
  if (!cls) return next(Object.assign(new Error('Class not found'), { status: 404 }));

  const hasEntries = db.prepare('SELECT 1 FROM journal_entries WHERE class_id = ? LIMIT 1').get(req.params.id);
  if (hasEntries) return next(Object.assign(new Error('Class has journal entries — deactivate by setting is_active=0 instead'), { status: 409 }));

  db.prepare("UPDATE classes SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
