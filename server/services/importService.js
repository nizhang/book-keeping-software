const crypto = require('crypto');
const { getDb } = require('../db/database');
const { parseCsv } = require('./parsers/csvParser');
const { parseOfx } = require('./parsers/ofxParser');
const { parseXlsx } = require('./parsers/xlsxParser');

function generateFitId(date, description, amount) {
  return crypto
    .createHash('sha1')
    .update(`${date}|${description}|${amount}`)
    .digest('hex')
    .slice(0, 20);
}

function detectFileType(filename, mimeType) {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'CSV';
  if (ext === 'ofx' || ext === 'qfx') return 'OFX';
  if (ext === 'xlsx' || ext === 'xls') return 'XLSX';
  if (mimeType && mimeType.includes('csv')) return 'CSV';
  return 'CSV'; // default
}

function parseFile(buffer, fileType) {
  switch (fileType) {
    case 'CSV':  return parseCsv(buffer);
    case 'OFX':  return parseOfx(buffer);
    case 'XLSX': return parseXlsx(buffer);
    default: throw new Error(`Unsupported file type: ${fileType}`);
  }
}

function importTransactions(buffer, filename, mimeType, sourceAccountId, dryRun = false, classId = null) {
  const db = getDb();
  const fileType = detectFileType(filename, mimeType);
  const parsed = parseFile(buffer, fileType);

  if (dryRun) {
    return {
      fileType,
      total: parsed.length,
      preview: parsed.slice(0, 20),
    };
  }

  const insertBatch = db.prepare(`
    INSERT INTO import_batches (filename, file_type, row_count, imported_count, skipped_count)
    VALUES (@filename, @fileType, @rowCount, 0, 0)
  `);

  const insertTxn = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (import_batch_id, date, description, amount, raw_amount, fit_id, source_account_id, reference, class_id)
    VALUES
      (@batchId, @date, @description, @amount, @rawAmount, @fitId, @sourceAccountId, @reference, @classId)
  `);

  const updateBatch = db.prepare(`
    UPDATE import_batches SET imported_count = @imported, skipped_count = @skipped WHERE id = @id
  `);

  const doImport = db.transaction(() => {
    const batchResult = insertBatch.run({
      filename,
      fileType,
      rowCount: parsed.length,
    });
    const batchId = batchResult.lastInsertRowid;

    let imported = 0, skipped = 0;

    for (const row of parsed) {
      const fitId = row.fitId || generateFitId(row.date, row.description, row.amount);
      const result = insertTxn.run({
        batchId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        rawAmount: row.rawAmount || String(row.amount),
        fitId,
        sourceAccountId,
        reference: row.reference || null,
        classId: classId || null,
      });
      if (result.changes > 0) imported++; else skipped++;
    }

    updateBatch.run({ id: batchId, imported, skipped });
    return { batchId, imported, skipped };
  });

  const { batchId, imported, skipped } = doImport();

  return {
    batchId,
    filename,
    fileType,
    total: parsed.length,
    imported,
    skipped,
  };
}

function getImportBatches() {
  return getDb().prepare('SELECT * FROM import_batches ORDER BY imported_at DESC').all();
}

function deleteImportBatch(batchId) {
  const db = getDb();
  // Transactions have ON DELETE CASCADE on journal_entries, so this cleans up fully
  db.prepare('DELETE FROM transactions WHERE import_batch_id = ?').run(batchId);
  db.prepare('DELETE FROM import_batches WHERE id = ?').run(batchId);
  return { success: true };
}

module.exports = { importTransactions, getImportBatches, deleteImportBatch };
