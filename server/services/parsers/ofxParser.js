/**
 * Custom OFX/QFX parser. Handles both:
 * - Legacy SGML format (most bank exports): no closing tags
 * - Modern XML format
 */

function parseOfxDate(str) {
  // OFX date: YYYYMMDD or YYYYMMDDHHMMSS[.XXX][+/-offset:TZ]
  const digits = str.trim().replace(/[^0-9].*$/, ''); // strip everything after non-digit
  if (digits.length < 8) throw new Error(`Invalid OFX date: ${str}`);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function parseOFXSgml(content) {
  // Find STMTTRN blocks (no closing tags in SGML)
  const transactions = [];
  const parts = content.split(/<STMTTRN>/i);
  parts.shift(); // remove content before first <STMTTRN>

  for (const block of parts) {
    const get = (tag) => {
      const m = new RegExp(`<${tag}>([^\r\n<]+)`, 'i').exec(block);
      return m ? m[1].trim() : null;
    };

    const fitId   = get('FITID');
    const dateStr = get('DTPOSTED') || get('DTUSER');
    const amtStr  = get('TRNAMT');
    const name    = get('NAME') || get('PAYEE') || 'Unknown';
    const memo    = get('MEMO');
    const ref     = get('CHECKNUM') || get('REFNUM');

    if (!dateStr || !amtStr) continue;

    const amount = parseFloat(amtStr);
    if (isNaN(amount)) continue;

    let date;
    try { date = parseOFXDate(dateStr); } catch { continue; }

    const description = memo && memo !== name ? `${name} - ${memo}` : name;

    transactions.push({ fitId, date, description, amount, rawAmount: amtStr, reference: ref || null });
  }

  return transactions;
}

function parseOFXXml(content) {
  const transactions = [];
  const txnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = txnRegex.exec(content)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = new RegExp(`<${tag}>([^<]+)<\/${tag}>`, 'i').exec(block);
      return m ? m[1].trim() : null;
    };

    const fitId   = get('FITID');
    const dateStr = get('DTPOSTED') || get('DTUSER');
    const amtStr  = get('TRNAMT');
    const name    = get('NAME') || 'Unknown';
    const memo    = get('MEMO');
    const ref     = get('CHECKNUM') || get('REFNUM');

    if (!dateStr || !amtStr) continue;

    const amount = parseFloat(amtStr);
    if (isNaN(amount)) continue;

    let date;
    try { date = parseOFXDate(dateStr); } catch { continue; }

    const description = memo && memo !== name ? `${name} - ${memo}` : name;

    transactions.push({ fitId, date, description, amount, rawAmount: amtStr, reference: ref || null });
  }

  return transactions;
}

function parseOFXDate(str) {
  const digits = str.trim().replace(/[^0-9].*$/, '');
  if (digits.length < 8) throw new Error(`Invalid OFX date: ${str}`);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function parseOfx(buffer) {
  const content = buffer.toString('utf8');

  // Determine format
  const isXml = content.trim().startsWith('<?xml') ||
                /<\?OFX/.test(content) ||
                /<STMTTRN>[\s\S]*?<\/STMTTRN>/i.test(content);

  return isXml ? parseOFXXml(content) : parseOFXSgml(content);
}

module.exports = { parseOfx };
