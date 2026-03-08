const express = require('express');
const router = express.Router();
const { getIncomeStatement, getBalanceSheet } = require('../services/reportService');
const dayjs = require('dayjs');

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

module.exports = router;
