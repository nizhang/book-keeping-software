const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { parseStatement } = require('../services/statementParser');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — PDFs can be larger
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') cb(null, true);
    else cb(Object.assign(new Error(`Only PDF files are supported, got: ${ext}`), { status: 400 }));
  },
});

// POST /api/parse-statement
router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return next(Object.assign(new Error('No file uploaded'), { status: 400 }));
  }

  try {
    const result = await parseStatement(req.file.buffer);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
