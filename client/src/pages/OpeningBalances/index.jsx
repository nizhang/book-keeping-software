import { useState, useEffect } from 'react';
import { useAccounts } from '../../api/accounts';
import { useClasses } from '../../api/classes';
import { useOpeningBalances, useSaveOpeningBalances } from '../../api/openingBalances';
import toast from 'react-hot-toast';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const s = {
  page:     { maxWidth: '860px' },
  h1:       { fontSize: '24px', fontWeight: '700', marginBottom: '6px', color: '#1e293b' },
  subtitle: { fontSize: '14px', color: '#64748b', marginBottom: '28px' },
  card:     { background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px' },
  cardTitle:{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '16px' },
  label:    { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' },
  input:    { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' },
  select:   { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#fff' },
  addBtn:   { padding: '7px 14px', border: '1px dashed #3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#3b82f6', background: '#eff6ff', fontWeight: '600' },
  saveBtn:  { padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  delBtn:   { padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: '#fff', color: '#dc2626' },
  grid:     { display: 'grid', gridTemplateColumns: '1fr 130px 150px 36px', gap: '8px', alignItems: 'center', marginBottom: '8px' },
  gridHdr:  { display: 'grid', gridTemplateColumns: '1fr 130px 150px 36px', gap: '8px', marginBottom: '6px' },
  hdrCell:  { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' },
  section:  { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '12px 0 6px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' },
  summaryCard: { borderRadius: '8px', padding: '14px 18px', textAlign: 'right' },
  summaryLabel:{ fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' },
  summaryValue:{ fontSize: '22px', fontWeight: '700' },
};

function emptyLine() {
  return { id: Date.now() + Math.random(), accountId: '', amount: '', classId: '' };
}

export default function OpeningBalances() {
  const { data: allAccounts = [], isLoading: loadingAccts } = useAccounts();
  const { data: allClasses = [], isLoading: loadingClasses } = useClasses();
  const { data: saved,          isLoading: loadingSaved   } = useOpeningBalances();
  const saveMutation = useSaveOpeningBalances();

  // Only ASSET + LIABILITY accounts are relevant for opening balances
  const balanceAccounts = allAccounts.filter(a => a.type === 'ASSET' || a.type === 'LIABILITY');
  const assetAccounts     = balanceAccounts.filter(a => a.type === 'ASSET');
  const liabilityAccounts = balanceAccounts.filter(a => a.type === 'LIABILITY');

  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([emptyLine()]);
  const [filterClassId, setFilterClassId] = useState('');

  // Pre-populate from saved data
  useEffect(() => {
    if (!saved) return;
    if (saved.asOfDate) setAsOfDate(saved.asOfDate);
    if (saved.lines && saved.lines.length > 0) {
      setLines(saved.lines.map(l => ({
        id:        Date.now() + Math.random(),
        accountId: String(l.accountId),
        amount:    String(l.amount),
        classId:   l.classId ? String(l.classId) : '',
      })));
    }
  }, [saved]);

  const updateLine = (id, field, value) =>
    setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l));

  const removeLine = (id) =>
    setLines(ls => ls.filter(l => l.id !== id));

  const addLine = () => setLines(ls => [
    ...ls,
    { ...emptyLine(), classId: filterClassId || '' },
  ]);

  // Summary calculations
  const getAmount = (l) => parseFloat(l.amount) || 0;
  const getAccountType = (accountId) => {
    const acct = balanceAccounts.find(a => String(a.id) === String(accountId));
    return acct?.type;
  };

  const visibleLines = filterClassId
    ? lines.filter(l => l.classId === filterClassId)
    : lines;

  const totalAssets      = visibleLines.filter(l => getAccountType(l.accountId) === 'ASSET').reduce((s, l) => s + getAmount(l), 0);
  const totalLiabilities = visibleLines.filter(l => getAccountType(l.accountId) === 'LIABILITY').reduce((s, l) => s + getAmount(l), 0);
  const netEquity        = totalAssets - totalLiabilities;

  const handleSave = async () => {
    if (!asOfDate) { toast.error('Please set an "as of" date'); return; }

    const validLines = lines.filter(l => l.accountId && getAmount(l) > 0);
    if (validLines.length === 0) { toast.error('Add at least one balance line'); return; }

    const payload = validLines.map(l => ({
      accountId: parseInt(l.accountId),
      amount:    parseFloat(l.amount),
      classId:   l.classId ? parseInt(l.classId) : null,
    }));

    try {
      await saveMutation.mutateAsync({ asOfDate, lines: payload });
      toast.success('Opening balances saved!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loadingAccts || loadingClasses || loadingSaved) return <div>Loading…</div>;

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Opening Balances</h1>
      <p style={s.subtitle}>
        Enter the starting balances for your accounts as of the date you begin tracking in this system.
        These entries set up your Balance Sheet before any transactions are imported.
      </p>

      {/* Date */}
      <div style={s.card}>
        <div style={s.cardTitle}>As of Date</div>
        <div>
          <label style={s.label}>Date your bookkeeping starts</label>
          <input
            type="date"
            style={s.input}
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
          />
        </div>
      </div>

      {/* Balance Lines */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={s.cardTitle}>Account Balances</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>View by class:</span>
            <select
              style={{ ...s.select, fontSize: '13px', padding: '6px 10px' }}
              value={filterClassId}
              onChange={e => setFilterClassId(e.target.value)}
            >
              <option value="">All classes</option>
              {allClasses.filter(c => c.is_active).map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={s.gridHdr}>
          <div style={s.hdrCell}>Account</div>
          <div style={{ ...s.hdrCell, textAlign: 'right' }}>Amount ($)</div>
          <div style={s.hdrCell}>Property / Class</div>
          <div />
        </div>

        {/* ASSET lines */}
        {visibleLines.some(l => getAccountType(l.accountId) === 'ASSET') && (
          <div style={s.section}>Assets</div>
        )}
        {visibleLines.map(l => {
          const type = getAccountType(l.accountId);
          if (type !== 'ASSET') return null;
          return <LineRow key={l.id} line={l} accounts={balanceAccounts} classes={allClasses}
                          onUpdate={updateLine} onRemove={removeLine} />;
        })}

        {/* LIABILITY lines */}
        {visibleLines.some(l => getAccountType(l.accountId) === 'LIABILITY') && (
          <div style={s.section}>Liabilities</div>
        )}
        {visibleLines.map(l => {
          const type = getAccountType(l.accountId);
          if (type !== 'LIABILITY') return null;
          return <LineRow key={l.id} line={l} accounts={balanceAccounts} classes={allClasses}
                          onUpdate={updateLine} onRemove={removeLine} />;
        })}

        {/* Unassigned (no account selected yet) */}
        {visibleLines.filter(l => !getAccountType(l.accountId)).map(l => (
          <LineRow key={l.id} line={l} accounts={balanceAccounts} classes={allClasses}
                   onUpdate={updateLine} onRemove={removeLine} />
        ))}

        {filterClassId && visibleLines.length === 0 && (
          <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0' }}>
            No opening balance lines for this class. Click &ldquo;+ Add Line&rdquo; to add one.
          </div>
        )}

        <div style={{ marginTop: '12px' }}>
          <button style={s.addBtn} onClick={addLine}>+ Add Line</button>
        </div>
      </div>

      {/* Summary */}
      <div style={s.card}>
        <div style={s.cardTitle}>Summary</div>
        <div style={s.summaryGrid}>
          <div style={{ ...s.summaryCard, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <div style={s.summaryLabel}>Total Assets</div>
            <div style={{ ...s.summaryValue, color: '#2563eb' }}>${fmt(totalAssets)}</div>
          </div>
          <div style={{ ...s.summaryCard, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <div style={s.summaryLabel}>Total Liabilities</div>
            <div style={{ ...s.summaryValue, color: '#dc2626' }}>${fmt(totalLiabilities)}</div>
          </div>
          <div style={{ ...s.summaryCard, background: netEquity >= 0 ? '#f0fdf4' : '#fef9c3', border: `1px solid ${netEquity >= 0 ? '#bbf7d0' : '#fde68a'}` }}>
            <div style={s.summaryLabel}>Opening Balance Equity (3040)</div>
            <div style={{ ...s.summaryValue, color: netEquity >= 0 ? '#16a34a' : '#d97706' }}>
              {netEquity < 0 ? '-' : ''}${fmt(Math.abs(netEquity))}
            </div>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px', marginBottom: 0 }}>
          Opening Balance Equity = Total Assets − Total Liabilities.
          This auto-balances your double-entry books.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={s.saveBtn} onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save Opening Balances'}
        </button>
      </div>
    </div>
  );
}

function LineRow({ line, accounts, classes, onUpdate, onRemove }) {
  const assetAccts     = accounts.filter(a => a.type === 'ASSET');
  const liabilityAccts = accounts.filter(a => a.type === 'LIABILITY');

  return (
    <div style={s.grid}>
      {/* Account */}
      <select
        style={{ ...s.select, width: '100%' }}
        value={line.accountId}
        onChange={e => onUpdate(line.id, 'accountId', e.target.value)}
      >
        <option value="">— Select account —</option>
        <optgroup label="ASSETS">
          {assetAccts.map(a => (
            <option key={a.id} value={String(a.id)}>{a.code} {a.name}</option>
          ))}
        </optgroup>
        <optgroup label="LIABILITIES">
          {liabilityAccts.map(a => (
            <option key={a.id} value={String(a.id)}>{a.code} {a.name}</option>
          ))}
        </optgroup>
      </select>

      {/* Amount */}
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        style={{ ...s.input, width: '100%', textAlign: 'right' }}
        value={line.amount}
        onChange={e => onUpdate(line.id, 'amount', e.target.value)}
      />

      {/* Class */}
      <select
        style={{ ...s.select, width: '100%' }}
        value={line.classId}
        onChange={e => onUpdate(line.id, 'classId', e.target.value)}
      >
        <option value="">— No class —</option>
        {classes.filter(c => c.is_active).map(c => (
          <option key={c.id} value={String(c.id)}>{c.name}</option>
        ))}
      </select>

      {/* Remove */}
      <button style={s.delBtn} onClick={() => onRemove(line.id)} title="Remove line">✕</button>
    </div>
  );
}
