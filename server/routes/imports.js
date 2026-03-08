const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { importTransactions, getImportBatches, deleteImportBatch } = require('../services/importService');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.memoryStorage(); // store in memory, no temp files needed
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.ofx', '.qfx', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
  },
});

// POST /api/import — import a file
router.post('/', upload.single('file'), (req, res, next) => {
  if (!req.file) return next(Object.assign(new Error('No file uploaded'), { status: 400 }));
  const { sourceAccountId, classId } = req.body;
  if (!sourceAccountId) return next(Object.assign(new Error('sourceAccountId is required'), { status: 400 }));

  try {
    const result = importTransactions(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      parseInt(sourceAccountId),
      false,
      classId ? parseInt(classId) : null
    );
    res.json(result);
  } catch (e) { next(e); }
});

// GET /api/import/preview — dry run, returns parsed rows without saving
router.get('/preview', upload.single('file'), (req, res, next) => {
  if (!req.file) return next(Object.assign(new Error('No file uploaded'), { status: 400 }));
  try {
    const result = importTransactions(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      0,
      true // dryRun
    );
    res.json(result);
  } catch (e) { next(e); }
});

// POST /api/import/preview — same but via POST (easier for form submission)
router.post('/preview', upload.single('file'), (req, res, next) => {
  if (!req.file) return next(Object.assign(new Error('No file uploaded'), { status: 400 }));
  try {
    const result = importTransactions(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      0,
      true
    );
    res.json(result);
  } catch (e) { next(e); }
});

// GET /api/import/batches — list past imports
router.get('/batches', (req, res) => {
  res.json(getImportBatches());
});

// DELETE /api/import/batches/:id
router.delete('/batches/:id', (req, res, next) => {
  try {
    res.json(deleteImportBatch(parseInt(req.params.id)));
  } catch (e) { next(e); }
});

module.exports = router;
