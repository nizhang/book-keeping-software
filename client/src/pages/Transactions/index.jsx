import { useState } from 'react';
import { useTransactions, useCategorize, useUncategorize, useBulkCategorize, useMergeCategorize, useDeleteTransaction, useFlipAmount } from '../../api/transactions';
import { useAccounts } from '../../api/accounts';
import { useClasses } from '../../api/classes';
import AccountSelect from '../../components/shared/AccountSelect';
import ClassSelect from '../../components/shared/ClassSelect';
import AmountDisplay from '../../components/shared/AmountDisplay';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const s = {
  page: {},
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  h1: { fontSize: '24px', fontWeight: '700', color: '#1e293b' },
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', padding: '16px', background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  input: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
  select: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  td: { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', color: '#374151', verticalAlign: 'middle' },
  badge: (categorized) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '600',
    background: categorized ? '#dcfce7' : '#fef3c7', color: categorized ? '#16a34a' : '#92400e',
  }),
  splitBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', background: '#ede9fe', color: '#7c3aed' },
  pager: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', fontSize: '13px', color: '#64748b' },
  pageBtn: (disabled) => ({ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: '#fff', fontSize: '13px' }),
  bulkBar: { display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', marginBottom: '10px', fontSize: '13px' },
  delBtn: { padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', background: '#fff' },
  flipBtn: { padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', color: '#64748b', background: '#fff' },
  splitBtn: { padding: '4px 8px', border: '1px solid #c4b5fd', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', color: '#7c3aed', background: '#fff', marginLeft: '4px' },
  removeBtn: { padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#64748b', background: '#fff', marginLeft: '4px' },
};

// ─── SplitModal ──────────────────────────────────────────────────────────────

function SplitModal({ txn, onClose }) {
  const categorize = useCategorize();
  const { data: accounts = [] } = useAccounts();
  const absAmount = Math.abs(txn.amount);

  // Pre-populate from existing journal entries if already categorized
  const existingSplits = txn.journal_entries
    ?.filter(je => je.account_id !== txn.source_account_id)
    .map(je => ({
      categoryAccountId: je.account_id,
      amount: je.amount,
      classId: je.class_id || null,
      memo: je.memo || '',
    })) || [];

  const defaultClassId = txn.class_id || null;
  const [splits, setSplits] = useState(
    existingSplits.length > 0
      ? existingSplits
      : [{ categoryAccountId: null, amount: absAmount, classId: defaultClassId, memo: '' }]
  );
  const [bulkClass, setBulkClass] = useState(defaultClassId);
  const [parsing, setParsing] = useState(false);

  const handleParseStatement = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-statement', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error || 'Parse failed');
      const { lines } = await res.json();
      if (!lines?.length) { toast.error('No line items found in statement'); return; }
      setSplits(lines.map(l => ({
        categoryAccountId: null,
        amount: l.amount,
        classId: defaultClassId,
        memo: l.description,
        _isIncome: l.isIncome,
      })));
      toast.success(`Parsed ${lines.length} lines from statement — assign accounts to each line`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setParsing(false);
    }
  };

  // Signed contribution per split: EXPENSE=DEBIT (negative net), REVENUE=CREDIT (positive net),
  // balance-sheet accounts follow transaction direction. This lets income and expense splits
  // coexist on one transaction (e.g. net property-manager deposit = rent minus expenses).
  const signedAmt = (sp) => {
    const amt = parseFloat(sp.amount) || 0;
    const acct = accounts.find(a => a.id === sp.categoryAccountId);
    if (!acct) return txn.amount >= 0 ? amt : -amt;
    if (acct.type === 'EXPENSE') return -amt;
    if (acct.type === 'REVENUE') return amt;
    return txn.amount >= 0 ? amt : -amt;
  };

  const signedTotal = Math.round(splits.reduce((s, sp) => s + signedAmt(sp), 0) * 100) / 100;
  const remaining = Math.round((txn.amount - signedTotal) * 100) / 100;
  const isBalanced = Math.abs(remaining) < 0.01;

  const setField = (idx, field) => (value) => {
    setSplits(prev => prev.map((sp, i) => i === idx ? { ...sp, [field]: value } : sp));
  };

  const addLine = () => {
    const rem = Math.round((txn.amount - splits.reduce((s, sp) => s + signedAmt(sp), 0)) * 100) / 100;
    setSplits(prev => [...prev, { categoryAccountId: null, amount: Math.abs(rem) > 0.01 ? Math.abs(rem) : 0, classId: null, memo: '' }]);
  };

  const removeLine = (idx) => setSplits(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!isBalanced) return toast.error('Amounts must equal the transaction total');
    if (splits.some(s => !s.categoryAccountId)) return toast.error('Each line needs an account');
    if (splits.some(s => !s.classId)) return toast.error('Each line must have a class assigned');
    try {
      await categorize.mutateAsync({
        id: txn.id,
        splits: splits.map(s => ({
          categoryAccountId: parseInt(s.categoryAccountId),
          amount: parseFloat(s.amount),
          classId: s.classId ? parseInt(s.classId) : null,
          memo: s.memo || null,
        })),
      });
      toast.success('Transaction categorized');
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  const modal = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    box: { background: '#fff', borderRadius: '14px', padding: '28px', width: '780px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' },
    title: { fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' },
    sub: { fontSize: '13px', color: '#64748b', marginBottom: '20px' },
    grid: { display: 'grid', gridTemplateColumns: '100px 1fr 140px 1fr 28px', gap: '8px', alignItems: 'center', marginBottom: '8px' },
    hdr: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', padding: '0 4px' },
    amtInput: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '100%', fontVariantNumeric: 'tabular-nums' },
    memoInput: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '100%' },
    divider: { borderTop: '1px solid #e2e8f0', margin: '16px 0' },
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' },
    balance: (ok) => ({ fontSize: '13px', fontWeight: '600', color: ok ? '#16a34a' : '#dc2626' }),
    addBtn: { padding: '6px 14px', border: '1px dashed #c4b5fd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#7c3aed', background: '#faf5ff', marginTop: '4px' },
    applyAllRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '7px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' },
    applyAllBtn: { padding: '5px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
    cancelBtn: { padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', background: '#fff' },
    saveBtn: (ok) => ({ padding: '8px 18px', background: ok ? '#2563eb' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', cursor: ok ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600' }),
    xBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  };

  return (
    <div style={modal.overlay}>
      <div style={modal.box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={modal.title}>Split Transaction</div>
          <label style={{ padding: '6px 12px', background: parsing ? '#f1f5f9' : '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '7px', cursor: parsing ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600', color: '#2563eb', whiteSpace: 'nowrap' }}>
            {parsing ? '⏳ Parsing…' : '📄 Parse Statement'}
            <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleParseStatement} disabled={parsing} />
          </label>
        </div>
        <div style={modal.sub}>
          {txn.description} &nbsp;•&nbsp; {dayjs(txn.date).format('MMM D, YYYY')} &nbsp;•&nbsp;
          <strong><AmountDisplay amount={txn.amount} /></strong>
        </div>

        {/* Column headers */}
        <div style={modal.grid}>
          <div style={modal.hdr}>Amount</div>
          <div style={modal.hdr}>Account</div>
          <div style={modal.hdr}>Class</div>
          <div style={modal.hdr}>Memo</div>
          <div />
        </div>

        {/* Apply class to all rows */}
        <div style={modal.applyAllRow}>
          <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>Apply class to all:</span>
          <ClassSelect
            value={bulkClass}
            onChange={setBulkClass}
            placeholder="Select class..."
            style={{ flex: 1, maxWidth: '200px' }}
          />
          <button
            style={modal.applyAllBtn}
            onClick={() => { if (bulkClass !== null) setSplits(prev => prev.map(sp => ({ ...sp, classId: bulkClass }))); }}
          >
            Apply to all
          </button>
        </div>

        {splits.map((sp, idx) => {
          const acctType = accounts.find(a => a.id === sp.categoryAccountId)?.type;
          const isExpense = acctType === 'EXPENSE';
          return (
          <div key={idx} style={modal.grid}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {isExpense && (
                <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '15px', flexShrink: 0, lineHeight: 1 }} title="Expense (money out)">−</span>
              )}
              <input
                type="number"
                step="0.01"
                min="0.01"
                style={{ ...modal.amtInput, borderColor: isExpense ? '#fca5a5' : '#d1d5db' }}
                value={sp.amount}
                onChange={e => setField(idx, 'amount')(parseFloat(e.target.value) || 0)}
              />
            </div>
            <AccountSelect
              value={sp.categoryAccountId}
              onChange={setField(idx, 'categoryAccountId')}
              placeholder={sp._isIncome === true ? '↑ Income account…' : sp._isIncome === false ? '↓ Expense account…' : 'Select account…'}
              style={{ width: '100%' }}
            />
            <ClassSelect
              value={sp.classId}
              onChange={setField(idx, 'classId')}
              placeholder="No class"
              style={{ width: '100%' }}
            />
            <input
              type="text"
              style={modal.memoInput}
              value={sp.memo}
              onChange={e => setField(idx, 'memo')(e.target.value)}
              placeholder="Memo (optional)"
            />
            <button
              style={modal.xBtn}
              onClick={() => removeLine(idx)}
              disabled={splits.length === 1}
              title="Remove line"
            >✕</button>
          </div>
          );
        })}

        <button style={modal.addBtn} onClick={addLine}>+ Add line</button>

        <div style={modal.divider} />

        <div style={modal.footer}>
          <div>
            <div style={modal.balance(isBalanced)}>
              {isBalanced
                ? `✓ Balanced — total $${absAmount.toFixed(2)}`
                : remaining > 0
                  ? `Remaining: $${remaining.toFixed(2)} of $${absAmount.toFixed(2)}`
                  : `Over by: $${Math.abs(remaining).toFixed(2)}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={modal.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={modal.saveBtn(isBalanced)} onClick={handleSave} disabled={!isBalanced || categorize.isPending}>
              {categorize.isPending ? 'Saving...' : 'Save Split'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MergeSplitModal ─────────────────────────────────────────────────────────

function MergeSplitModal({ txns, onClose }) {
  const mergeCat = useMergeCategorize();
  const { data: accounts = [] } = useAccounts();
  const combinedAmount = txns.reduce((s, t) => s + t.amount, 0);

  const [splits, setSplits] = useState([{ categoryAccountId: null, amount: Math.abs(combinedAmount), classId: null, memo: '' }]);
  const [bulkClass, setBulkClass] = useState(null);

  const signedAmt = (sp) => {
    const amt = parseFloat(sp.amount) || 0;
    const acct = accounts.find(a => a.id === sp.categoryAccountId);
    if (!acct) return combinedAmount >= 0 ? amt : -amt;
    if (acct.type === 'EXPENSE') return -amt;
    if (acct.type === 'REVENUE') return amt;
    return combinedAmount >= 0 ? amt : -amt;
  };

  const signedTotal = Math.round(splits.reduce((s, sp) => s + signedAmt(sp), 0) * 100) / 100;
  const remaining   = Math.round((combinedAmount - signedTotal) * 100) / 100;
  const isBalanced  = Math.abs(remaining) < 0.01;

  const setField = (idx, field) => (value) =>
    setSplits(prev => prev.map((sp, i) => i === idx ? { ...sp, [field]: value } : sp));

  const addLine = () => {
    const rem = Math.round((combinedAmount - splits.reduce((s, sp) => s + signedAmt(sp), 0)) * 100) / 100;
    setSplits(prev => [...prev, { categoryAccountId: null, amount: Math.abs(rem) > 0.01 ? Math.abs(rem) : 0, classId: null, memo: '' }]);
  };

  const handleSave = async () => {
    if (!isBalanced) return toast.error('Amounts must equal the combined total');
    if (splits.some(s => !s.categoryAccountId)) return toast.error('Each line needs an account');
    if (splits.some(s => !s.classId)) return toast.error('Each line must have a class assigned');
    try {
      await mergeCat.mutateAsync({
        transactionIds: txns.map(t => t.id),
        splits: splits.map(s => ({
          categoryAccountId: parseInt(s.categoryAccountId),
          amount: parseFloat(s.amount),
          classId: s.classId ? parseInt(s.classId) : null,
          memo: s.memo || null,
        })),
      });
      toast.success(`${txns.length} transactions split together`);
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  const m = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    box: { background: '#fff', borderRadius: '14px', padding: '28px', width: '780px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' },
    txnList: { fontSize: '12px', color: '#475569', background: '#f8fafc', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', borderLeft: '3px solid #6366f1' },
    grid: { display: 'grid', gridTemplateColumns: '100px 1fr 140px 1fr 28px', gap: '8px', alignItems: 'center', marginBottom: '8px' },
    hdr: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', padding: '0 4px' },
    inp: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '100%' },
    applyRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '7px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' },
    xBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#94a3b8' },
  };

  return (
    <div style={m.overlay}>
      <div style={m.box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Split Together — <AmountDisplay amount={combinedAmount} /></div>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>Combined split across {txns.length} transactions — amounts allocated proportionally</div>
          </div>
          <button style={m.xBtn} onClick={onClose}>✕</button>
        </div>

        <div style={m.txnList}>
          {txns.map(t => (
            <div key={t.id}>{dayjs(t.date).format('MMM D, YYYY')} &nbsp;·&nbsp; {t.description.slice(0, 55)} &nbsp;·&nbsp; <strong><AmountDisplay amount={t.amount} /></strong></div>
          ))}
        </div>

        <div style={m.grid}>
          <div style={m.hdr}>Amount</div><div style={m.hdr}>Account</div>
          <div style={m.hdr}>Class</div><div style={m.hdr}>Memo</div><div />
        </div>

        <div style={m.applyRow}>
          <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>Apply class to all:</span>
          <ClassSelect value={bulkClass} onChange={setBulkClass} placeholder="Select class..." style={{ flex: 1, maxWidth: '200px' }} />
          <button style={{ padding: '5px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
            onClick={() => { if (bulkClass !== null) setSplits(prev => prev.map(sp => ({ ...sp, classId: bulkClass }))); }}>
            Apply to all
          </button>
        </div>

        {splits.map((sp, idx) => {
          const isExpense = accounts.find(a => a.id === sp.categoryAccountId)?.type === 'EXPENSE';
          return (
            <div key={idx} style={m.grid}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {isExpense && <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '15px', flexShrink: 0 }}>−</span>}
                <input type="number" step="0.01" style={{ ...m.inp, borderColor: isExpense ? '#fca5a5' : '#d1d5db' }}
                  value={sp.amount} onChange={e => setField(idx, 'amount')(parseFloat(e.target.value) || 0)} />
              </div>
              <AccountSelect value={sp.categoryAccountId} onChange={setField(idx, 'categoryAccountId')} placeholder="Select account..." style={{ width: '100%' }} />
              <ClassSelect value={sp.classId} onChange={setField(idx, 'classId')} placeholder="No class" style={{ width: '100%' }} />
              <input type="text" style={m.inp} value={sp.memo} onChange={e => setField(idx, 'memo')(e.target.value)} placeholder="Memo (optional)" />
              <button style={m.xBtn} onClick={() => setSplits(prev => prev.filter((_, i) => i !== idx))} disabled={splits.length === 1}>✕</button>
            </div>
          );
        })}

        <button style={{ padding: '6px 14px', border: '1px dashed #c4b5fd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#7c3aed', background: '#faf5ff', marginTop: '4px' }} onClick={addLine}>+ Add line</button>

        <div style={{ borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: isBalanced ? '#16a34a' : '#dc2626' }}>
              {isBalanced ? '✓ Balanced' : `Remaining: $${Math.abs(remaining).toFixed(2)}`}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Each transaction gets a proportional share of each line</div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', background: '#fff' }} onClick={onClose}>Cancel</button>
            <button style={{ padding: '8px 18px', background: isBalanced ? '#6366f1' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', cursor: isBalanced ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600' }}
              onClick={handleSave} disabled={!isBalanced || mergeCat.isPending}>
              {mergeCat.isPending ? 'Saving…' : 'Save Split'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BulkBar ─────────────────────────────────────────────────────────────────

function BulkBar({ selected, selectedTxns, onClear, onMergeSplit }) {
  const bulk = useBulkCategorize();
  const [catId, setCatId] = useState(null);

  const apply = async () => {
    if (!catId) return toast.error('Select a category first');
    const res = await bulk.mutateAsync({ transactionIds: selected, categoryAccountId: catId });
    toast.success(`Categorized ${res.success} transactions${res.failed.length ? `, ${res.failed.length} failed` : ''}`);
    onClear();
  };

  return (
    <div style={s.bulkBar}>
      <strong>{selected.length} selected</strong>
      <AccountSelect value={catId} onChange={setCatId} placeholder="Assign category..." style={{ width: '260px' }} />
      <button onClick={apply} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
        Apply to all
      </button>
      {selected.length >= 2 && (
        <button onClick={onMergeSplit} style={{ padding: '6px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
          Split Together
        </button>
      )}
      <button onClick={onClear} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: '#fff' }}>
        Clear
      </button>
    </div>
  );
}

// ─── TransactionRow ───────────────────────────────────────────────────────────

function TransactionRow({ txn, selected, onSelect }) {
  const categorize = useCategorize();
  const uncategorize = useUncategorize();
  const deleteT = useDeleteTransaction();
  const flipAmount = useFlipAmount();
  const [splitOpen, setSplitOpen] = useState(false);

  // All journal entries that are NOT the bank (source) account side
  const categoryEntries = txn.journal_entries?.filter(je => je.account_id !== txn.source_account_id) || [];
  const isSplit = categoryEntries.length > 1;
  const singleEntry = categoryEntries.length === 1 ? categoryEntries[0] : null;

  const handleQuickCategorize = async (accountId) => {
    if (!accountId) return;
    const classId = txn.class_id || null;
    if (!classId) return toast.error('Assign a class to this transaction before categorizing');
    try {
      await categorize.mutateAsync({
        id: txn.id,
        splits: [{ categoryAccountId: accountId, amount: Math.abs(txn.amount), classId, memo: null }],
      });
      toast.success('Categorized');
    } catch (err) { toast.error(err.message); }
  };

  const handleUncategorize = async () => {
    try {
      await uncategorize.mutateAsync(txn.id);
      toast.success('Uncategorized');
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this transaction?')) return;
    try { await deleteT.mutateAsync(txn.id); toast.success('Deleted'); }
    catch (err) { toast.error(err.message); }
  };

  const handleFlip = async () => {
    const dir = txn.amount >= 0 ? 'outgoing (−)' : 'incoming (+)';
    if (!confirm(`Flip this transaction to ${dir}? Any existing categorization will be cleared.`)) return;
    try { await flipAmount.mutateAsync(txn.id); toast.success('Amount sign flipped'); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <tr>
        <td style={s.td}><input type="checkbox" checked={selected} onChange={() => onSelect(txn.id)} /></td>
        <td style={s.td}>{dayjs(txn.date).format('MMM D, YYYY')}</td>
        <td style={{ ...s.td, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={txn.description}>
          {txn.description}
        </td>
        <td style={{ ...s.td, textAlign: 'right' }}><AmountDisplay amount={txn.amount} /></td>

        {/* Category column */}
        <td style={{ ...s.td, minWidth: '280px' }}>
          {txn.is_categorized ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {isSplit ? (
                <>
                  <span style={s.splitBadge}>Split ({categoryEntries.length} lines)</span>
                  {categoryEntries.map((je, i) => (
                    <span key={i} style={{ fontSize: '11px', color: '#64748b' }}>
                      {je.account_code} ${je.amount.toFixed(2)}
                      {je.class_name && <span style={{ color: '#7c3aed' }}> [{je.class_name}]</span>}
                    </span>
                  ))}
                </>
              ) : singleEntry ? (
                <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '500' }}>
                  {singleEntry.account_code} – {singleEntry.account_name}
                  {singleEntry.class_name && (
                    <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '99px', background: '#ede9fe', color: '#7c3aed', fontSize: '11px' }}>
                      {singleEntry.class_name}
                    </span>
                  )}
                </span>
              ) : null}
              <button style={s.splitBtn} onClick={() => setSplitOpen(true)} title="Edit categorization">Edit</button>
              <button style={s.removeBtn} onClick={handleUncategorize} title="Remove category">✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AccountSelect
                value={null}
                onChange={handleQuickCategorize}
                placeholder="Quick categorize..."
                style={{ width: '200px', fontSize: '12px' }}
              />
              <button style={s.splitBtn} onClick={() => setSplitOpen(true)} title="Split this transaction">Split</button>
            </div>
          )}
        </td>

        <td style={s.td}><span style={s.badge(txn.is_categorized)}>{txn.is_categorized ? 'Done' : 'Pending'}</span></td>
        <td style={s.td}>
          <button style={s.flipBtn} onClick={handleFlip} title="Flip amount sign (e.g. mark payment as outgoing)">
            {txn.amount >= 0 ? '−' : '+'} Flip
          </button>
          {' '}
          <button style={s.delBtn} onClick={handleDelete}>Delete</button>
        </td>
      </tr>

      {splitOpen && <SplitModal txn={txn} onClose={() => setSplitOpen(false)} />}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ limit: 50, categorized: 'false' });
  const [selected, setSelected] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const { data: classes = [] } = useClasses();

  const { data, isLoading } = useTransactions({ ...filters, page });
  const transactions = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / (filters.limit || 50));

  const setFilter = (key) => (e) => {
    setFilters(f => ({ ...f, [key]: e.target.value }));
    setPage(1);
    setSelected([]);
  };

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === transactions.length ? [] : transactions.map(t => t.id));

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Transactions</h1>
        <span style={{ fontSize: '13px', color: '#64748b' }}>{total} total</span>
      </div>

      <div style={s.filters}>
        <input type="date" style={s.input} onChange={setFilter('startDate')} title="From date" />
        <input type="date" style={s.input} onChange={setFilter('endDate')} title="To date" />
        <input type="text" style={{ ...s.input, width: '200px' }} placeholder="Search description..." onChange={setFilter('search')} />
        <select style={s.select} defaultValue="false" onChange={setFilter('categorized')}>
          <option value="">All</option>
          <option value="false">Uncategorized</option>
          <option value="true">Categorized</option>
        </select>
        <select style={s.select} onChange={setFilter('classId')}>
          <option value="">All classes</option>
          {classes.filter(c => c.is_active).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {selected.length > 0 && (
        <BulkBar
          selected={selected}
          selectedTxns={transactions.filter(t => selected.includes(t.id))}
          onClear={() => setSelected([])}
          onMergeSplit={() => setMergeOpen(true)}
        />
      )}
      {mergeOpen && (
        <MergeSplitModal
          txns={transactions.filter(t => selected.includes(t.id))}
          onClose={() => { setMergeOpen(false); setSelected([]); }}
        />
      )}

      {isLoading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : (
        <>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}><input type="checkbox" onChange={toggleAll} checked={selected.length === transactions.length && transactions.length > 0} /></th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Description</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
                <th style={s.th}>Category / Split</th>
                <th style={s.th}>Status</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
                  No transactions found. Import a bank file to get started.
                </td></tr>
              ) : (
                transactions.map(txn => (
                  <TransactionRow key={txn.id} txn={txn} selected={selected.includes(txn.id)} onSelect={toggleSelect} />
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={s.pager}>
              <button style={s.pageBtn(page <= 1)} onClick={() => setPage(p => p - 1)} disabled={page <= 1}>← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button style={s.pageBtn(page >= totalPages)} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
