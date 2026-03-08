const express = require('express');
const router = express.Router();
const { getIncomeStatement, getBalanceSheet } = require('../services/reportService');
const dayjs = require('dayjs');
const XLSX = require('xlsx');

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n) { return Math.round((n || 0) * 100) / 100; }

function sendXlsx(res, wb, filename) {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

function styleSheet(ws) {
  // Set column widths
  ws['!cols'] = [{ wch: 8 }, { wch: 38 }, { wch: 16 }];
  return ws;
}

// GET /api/reports/income-statement?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&classId=N]
router.get('/income-statement', (req, res, next) => {
  const startDate = req.query.startDate || dayjs().startOf('year').format('YYYY-MM-DD');
  const endDate   = req.query.endDate   || dayjs().format('YYYY-MM-DD');
  const classId   = req.query.classId   ? parseInt(req.query.classId) : null;
  try {
    res.json(getIncomeStatement(startDate, endDate, classId));
  } catch (e) { next(e); }
});

// GET /api/reports/balance-sheet?asOfDate=YYYY-MM-DD[&classId=N]
router.get('/balance-sheet', (req, res, next) => {
  const asOfDate = req.query.asOfDate || dayjs().format('YYYY-MM-DD');
  const classId  = req.query.classId  ? parseInt(req.query.classId) : null;
  try {
    res.json(getBalanceSheet(asOfDate, classId));
  } catch (e) { next(e); }
});

// GET /api/reports/income-statement/export
router.get('/income-statement/export', (req, res, next) => {
  try {
    const startDate = req.query.startDate || dayjs().startOf('year').format('YYYY-MM-DD');
    const endDate   = req.query.endDate   || dayjs().format('YYYY-MM-DD');
    const classId   = req.query.classId   ? parseInt(req.query.classId) : null;
    const d = getIncomeStatement(startDate, endDate, classId);

    const rows = [];
    const title = classId ? `Income Statement — Class ${classId}` : 'Income Statement';
    rows.push([title]);
    rows.push([`Period: ${startDate} to ${endDate}`]);
    rows.push([]);
    rows.push(['Code', 'Account', 'Amount']);

    rows.push(['', 'REVENUE', '']);
    d.revenue.forEach(r => rows.push([r.code, r.name, fmtNum(r.total)]));
    rows.push(['', 'Total Revenue', fmtNum(d.totalRevenue)]);
    rows.push([]);

    rows.push(['', 'EXPENSES', '']);
    d.expenses.forEach(r => rows.push([r.code, r.name, fmtNum(r.total)]));
    rows.push(['', 'Total Expenses', fmtNum(d.totalExpenses)]);
    rows.push([]);

    rows.push(['', 'NET INCOME', fmtNum(d.netIncome)]);

    const ws = styleSheet(XLSX.utils.aoa_to_sheet(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Income Statement');

    const filename = `income-statement_${startDate}_${endDate}${classId ? `_class${classId}` : ''}.xlsx`;
    sendXlsx(res, wb, filename);
  } catch (e) { next(e); }
});

// GET /api/reports/balance-sheet/export
router.get('/balance-sheet/export', (req, res, next) => {
  try {
    const asOfDate = req.query.asOfDate || dayjs().format('YYYY-MM-DD');
    const classId  = req.query.classId  ? parseInt(req.query.classId) : null;
    const d = getBalanceSheet(asOfDate, classId);

    const rows = [];
    const title = classId ? `Balance Sheet — Class ${classId}` : 'Balance Sheet';
    rows.push([title]);
    rows.push([`As of: ${asOfDate}`]);
    rows.push([]);
    rows.push(['Code', 'Account', 'Amount']);

    rows.push(['', 'ASSETS', '']);
    d.assets.items.forEach(r => rows.push([r.code, r.name, fmtNum(r.balance)]));
    rows.push(['', 'Total Assets', fmtNum(d.assets.total)]);
    rows.push([]);

    rows.push(['', 'LIABILITIES', '']);
    d.liabilities.items.forEach(r => rows.push([r.code, r.name, fmtNum(r.balance)]));
    rows.push(['', 'Total Liabilities', fmtNum(d.liabilities.total)]);
    rows.push([]);

    rows.push(['', 'EQUITY', '']);
    d.equity.items.forEach(r => rows.push([r.code, r.name, fmtNum(r.balance)]));
    rows.push(['', 'Total Equity', fmtNum(d.equity.total)]);
    rows.push([]);

    rows.push(['', 'Total Liabilities + Equity', fmtNum(d.liabilities.total + d.equity.total)]);

    const ws = styleSheet(XLSX.utils.aoa_to_sheet(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');

    const filename = `balance-sheet_${asOfDate}${classId ? `_class${classId}` : ''}.xlsx`;
    sendXlsx(res, wb, filename);
  } catch (e) { next(e); }
});

module.exports = router;
