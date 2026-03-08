const { parse } = require('csv-parse/sync');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// Common date formats banks use
const DATE_FORMATS = ['MM/DD/YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'M/D/YYYY', 'MM-DD-YYYY', 'YYYY/MM/DD'];

function detectColumn(headers, keywords) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lower.findIndex(h => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDate(str) {
  str = str.trim();
  for (const fmt of DATE_FORMATS) {
    const d = dayjs(str, fmt, true);
    if (d.isValid()) return d.format('YYYY-MM-DD');
  }
  // fallback: let dayjs try
  const d = dayjs(str);
  if (d.isValid()) return d.format('YYYY-MM-DD');
  throw new Error(`Cannot parse date: ${str}`);
}

function parseCsv(buffer) {
  const content = buffer.toString('utf8').replace(/^\uFEFF/, ''); // strip BOM
  const rows = parse(content, {
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (rows.length < 2) throw new Error('CSV file has no data rows');

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const dateIdx   = detectColumn(headers, ['date', 'posted', 'transaction date', 'trans date']);
  const descIdx   = detectColumn(headers, ['description', 'memo', 'payee', 'narrative', 'details', 'name']);
  const amountIdx = detectColumn(headers, ['amount', 'transaction amount']);
  const debitIdx  = detectColumn(headers, ['debit', 'withdrawal', 'charge']);
  const creditIdx = detectColumn(headers, ['credit', 'deposit', 'payment']);
  const refIdx    = detectColumn(headers, ['reference', 'check', 'ref', 'check no']);

  if (dateIdx === -1) throw new Error('Could not detect date column in CSV. Headers: ' + headers.join(', '));
  if (descIdx === -1) throw new Error('Could not detect description column in CSV. Headers: ' + headers.join(', '));

  const transactions = [];

  for (const row of dataRows) {
    if (row.every(c => !c || !c.trim())) continue;

    const dateStr = row[dateIdx];
    const desc    = row[descIdx] || 'Unknown';
    const ref     = refIdx !== -1 ? row[refIdx] : null;

    if (!dateStr || !dateStr.trim()) continue;

    let amount;
    const rawAmount = amountIdx !== -1 ? row[amountIdx] : null;

    if (amountIdx !== -1) {
      // Single amount column — may have parentheses for negatives or explicit sign
      const val = row[amountIdx].replace(/[$,\s]/g, '').replace(/\(([^)]+)\)/, '-$1');
      amount = parseFloat(val);
    } else if (debitIdx !== -1 || creditIdx !== -1) {
      // Separate debit/credit columns
      const debit  = debitIdx  !== -1 ? parseFloat((row[debitIdx]  || '0').replace(/[$,\s]/g, '')) || 0 : 0;
      const credit = creditIdx !== -1 ? parseFloat((row[creditIdx] || '0').replace(/[$,\s]/g, '')) || 0 : 0;
      amount = credit - debit; // positive = money in, negative = money out
    } else {
      throw new Error('Cannot find amount columns in CSV');
    }

    if (isNaN(amount)) continue;

    let date;
    try { date = parseDate(dateStr); } catch { continue; }

    transactions.push({
      date,
      description: desc.trim(),
      amount,
      rawAmount: rawAmount || String(amount),
      reference: ref || null,
      fitId: null, // CSV has no native FITID; importService will generate hash
    });
  }

  return transactions;
}

module.exports = { parseCsv };
