const pdfParse = require('pdf-parse');

// Matches a line ending with two dollar amounts: txnAmount + runningBalance
const AMOUNT_PAIR_RE = /([\d,]+\.\d{2})([\d,]+\.\d{2})$/;
const BEGINNING_BAL_RE = /beginning cash balance/i;
const SECURITY_DEPOSIT_RE = /security deposit|transfer to sd|transfer to s\.d\b/i;
const OWNER_PAYMENT_RE = /owner payment/i;
const SKIP_LINE_RE = /^(page \d|date|total|bills due|required reserves|work order|ending cash|property cash)/i;

function parseNum(str) {
  return parseFloat(str.replace(/,/g, ''));
}

function cleanDescription(line) {
  return line
    // Remove date prefix
    .replace(/^\d{2}\/\d{2}\/\d{4}/, '')
    // Remove trailing amounts
    .replace(/([\d,]+\.\d{2}){1,2}$/, '')
    // Remove reference numbers and receipt IDs
    .replace(/\b(Receipt|Check|ACH payment|eCheck receipt|CC receipt)\s*[\w-]*/gi, '')
    // Remove leading unit references like #12 -
    .replace(/^[\s\-#\d]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parse a PM owner statement PDF using running-balance direction detection.
 * Income: balance increases. Expense: balance decreases.
 * No API key required.
 */
async function parseStatement(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  const rawLines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let prevBalance = null;
  let netAmount = 0;       // sum of owner payment disbursements
  const items = [];
  // Accumulate multi-line description fragments
  let pendingDesc = '';

  for (const line of rawLines) {
    if (SKIP_LINE_RE.test(line)) continue;

    // Detect beginning balance — date may be concatenated with amount (e.g. "...2026475.00")
    if (BEGINNING_BAL_RE.test(line)) {
      const cleaned = line.replace(/\d{2}\/\d{2}\/\d{4}/, ' ');
      const m = cleaned.match(/([\d,]+\.\d{2})/);
      if (m) prevBalance = parseNum(m[1]);
      continue;
    }

    // Normalize: strip a leading year if it's concatenated with the first amount
    // e.g. "...March 2026375.006,468.80" → "...March 2026 375.006,468.80"
    const normalizedLine = line.replace(/(20\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})([\d,]+\.\d{2})$/, '$2$3');

    // Try to match a ledger line: ends with two amounts
    const pairMatch = normalizedLine.match(AMOUNT_PAIR_RE);
    if (!pairMatch || prevBalance === null) {
      // Accumulate as part of a multi-line description
      if (prevBalance !== null) pendingDesc += ' ' + line;
      continue;
    }

    const txnAmount  = parseNum(pairMatch[1]);
    const newBalance = parseNum(pairMatch[2]);
    const fullDesc   = (pendingDesc + ' ' + normalizedLine).trim();
    pendingDesc = '';

    // Skip security deposit lines
    if (SECURITY_DEPOSIT_RE.test(fullDesc)) {
      prevBalance = newBalance;
      continue;
    }

    // Owner payment = disbursement to owner (the deposit itself, not an income line)
    if (OWNER_PAYMENT_RE.test(fullDesc)) {
      netAmount += txnAmount;
      prevBalance = newBalance;
      continue;
    }

    // Determine direction from balance movement (allow 1¢ rounding tolerance)
    const diff = Math.round((newBalance - prevBalance) * 100) / 100;
    const expectedIncome  = Math.abs(diff - txnAmount) < 0.02;
    const expectedExpense = Math.abs(diff + txnAmount) < 0.02;

    if (!expectedIncome && !expectedExpense) {
      // Can't determine direction — skip (likely a header/total line)
      prevBalance = newBalance;
      continue;
    }

    const isIncome = expectedIncome;
    const description = cleanDescription(fullDesc) || (isIncome ? 'Rental Income' : 'Expense');

    items.push({ description, amount: txnAmount, isIncome });
    prevBalance = newBalance;
  }

  return {
    netAmount: netAmount > 0 ? Math.round(netAmount * 100) / 100 : null,
    lines: items,
  };
}

module.exports = { parseStatement };
