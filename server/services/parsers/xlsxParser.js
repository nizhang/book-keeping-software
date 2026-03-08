const XLSX = require('xlsx');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const DATE_FORMATS = ['MM/DD/YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'M/D/YYYY', 'MM-DD-YYYY'];

function detectColumn(headers, keywords) {
  const lower = headers.map(h => String(h).toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lower.findIndex(h => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDate(val) {
  if (val instanceof Date) return dayjs(val).format('YYYY-MM-DD');
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  for (const fmt of DATE_FORMATS) {
    const d = dayjs(str, fmt, true);
    if (d.isValid()) return d.format('YYYY-MM-DD');
  }
  const d = dayjs(str);
  if (d.isValid()) return d.format('YYYY-MM-DD');
  throw new Error(`Cannot parse date: ${val}`);
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (rows.length < 2) throw new Error('Excel file has no data rows');

  const headers = rows[0].map(h => String(h || ''));
  const dataRows = rows.slice(1);

  const dateIdx   = detectColumn(headers, ['date', 'posted', 'transaction date']);
  const descIdx   = detectColumn(headers, ['description', 'memo', 'payee', 'narrative', 'details', 'name']);
  const amountIdx = detectColumn(headers, ['amount', 'transaction amount']);
  const debitIdx  = detectColumn(headers, ['debit', 'withdrawal', 'charge']);
  const creditIdx = detectColumn(headers, ['credit', 'deposit', 'payment']);
  const refIdx    = detectColumn(headers, ['reference', 'check', 'ref']);

  if (dateIdx === -1) throw new Error('Could not detect date column. Headers: ' + headers.join(', '));
  if (descIdx === -1) throw new Error('Could not detect description column. Headers: ' + headers.join(', '));

  const transactions = [];

  for (const row of dataRows) {
    const dateVal = row[dateIdx];
    const desc    = row[descIdx];
    if (!dateVal || !desc) continue;

    let amount;
    const rawAmount = amountIdx !== -1 ? String(row[amountIdx] ?? '') : null;

    if (amountIdx !== -1) {
      const val = String(row[amountIdx] || '').replace(/[$,\s]/g, '').replace(/\(([^)]+)\)/, '-$1');
      amount = parseFloat(val);
    } else if (debitIdx !== -1 || creditIdx !== -1) {
      const debit  = parseFloat(String(row[debitIdx]  || '0').replace(/[$,\s]/g, '')) || 0;
      const credit = parseFloat(String(row[creditIdx] || '0').replace(/[$,\s]/g, '')) || 0;
      amount = credit - debit;
    } else {
      throw new Error('Cannot find amount columns in Excel file');
    }

    if (isNaN(amount)) continue;

    let date;
    try { date = parseDate(dateVal); } catch { continue; }

    transactions.push({
      date,
      description: String(desc).trim(),
      amount,
      rawAmount: rawAmount || String(amount),
      reference: refIdx !== -1 ? String(row[refIdx] || '') : null,
      fitId: null,
    });
  }

  return transactions;
}

module.exports = { parseXlsx };
