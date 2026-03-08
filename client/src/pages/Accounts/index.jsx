import { useState } from 'react';
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '../../api/accounts';
import toast from 'react-hot-toast';

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const TYPE_COLORS = { ASSET: '#2563eb', LIABILITY: '#dc2626', EQUITY: '#7c3aed', REVENUE: '#16a34a', EXPENSE: '#d97706' };
const NORMAL_BALANCE = { ASSET: 'DEBIT', LIABILITY: 'CREDIT', EQUITY: 'CREDIT', REVENUE: 'CREDIT', EXPENSE: 'DEBIT' };

const s = {
  page: { maxWidth: '900px' },
  h1: { fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#1e293b' },
  addBtn: { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '24px' },
  section: { marginBottom: '32px' },
  sectionTitle: { fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', padding: '4px 0' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  td: { padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f1f5f9', color: '#374151' },
  code: { fontFamily: 'monospace', fontSize: '13px', color: '#6366f1' },
  actions: { display: 'flex', gap: '8px' },
  editBtn: { padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: '#fff' },
  delBtn: { padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: '#fff', color: '#dc2626' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox: { background: '#fff', borderRadius: '12px', padding: '28px', width: '420px', maxWidth: '90vw' },
  modalTitle: { fontSize: '18px', fontWeight: '700', marginBottom: '20px' },
  formRow: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' },
  select: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' },
  modalFooter: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' },
  cancelBtn: { padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', background: '#fff' },
  saveBtn: { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
};

function AccountForm({ account, onClose }) {
  const isEdit = !!account?.id;
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const [form, setForm] = useState({
    code: account?.code || '',
    name: account?.name || '',
    type: account?.type || 'EXPENSE',
    normal_balance: account?.normal_balance || 'DEBIT',
    description: account?.description || '',
  });

  const set = (field) => (e) => {
    const val = e.target.value;
    setForm(f => {
      const next = { ...f, [field]: val };
      if (field === 'type') next.normal_balance = NORMAL_BALANCE[val] || 'DEBIT';
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) await update.mutateAsync({ id: account.id, name: form.name, description: form.description });
      else await create.mutateAsync(form);
      toast.success(isEdit ? 'Account updated' : 'Account created');
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div style={s.modal} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modalBox}>
        <div style={s.modalTitle}>{isEdit ? 'Edit Account' : 'New Account'}</div>
        <form onSubmit={handleSubmit}>
          {!isEdit && (
            <>
              <div style={s.formRow}>
                <label style={s.label}>Account Code</label>
                <input style={s.input} value={form.code} onChange={set('code')} required placeholder="e.g. 5160" />
              </div>
              <div style={s.formRow}>
                <label style={s.label}>Type</label>
                <select style={s.select} value={form.type} onChange={set('type')}>
                  {TYPE_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>
          )}
          <div style={s.formRow}>
            <label style={s.label}>Account Name</label>
            <input style={s.input} value={form.name} onChange={set('name')} required placeholder="e.g. Parking & Tolls" />
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Description (optional)</label>
            <input style={s.input} value={form.description} onChange={set('description')} />
          </div>
          <div style={s.modalFooter}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.saveBtn}>{isEdit ? 'Save Changes' : 'Create Account'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts();
  const deleteAccount = useDeleteAccount();
  const [modal, setModal] = useState(null); // null | { account? }

  const grouped = TYPE_ORDER.reduce((acc, type) => {
    const items = accounts.filter(a => a.type === type);
    if (items.length) acc[type] = items;
    return acc;
  }, {});

  const handleDelete = async (account) => {
    const msg = `Delete "${account.name}"?\n\n` +
      `If this account has existing transactions it will be hidden from the chart of accounts ` +
      `(historical data is preserved). Otherwise it will be permanently removed.`;
    if (!confirm(msg)) return;
    try {
      const result = await deleteAccount.mutateAsync(account.id);
      toast.success(result.deactivated ? `"${account.name}" hidden (has existing entries)` : `"${account.name}" deleted`);
    } catch (err) { toast.error(err.message); }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ ...s.h1, marginBottom: 0 }}>Chart of Accounts</h1>
        <button style={s.addBtn} onClick={() => setModal({})}>+ New Account</button>
      </div>

      {TYPE_ORDER.map(type => {
        const items = grouped[type] || [];
        if (!items.length) return null;
        return (
          <div key={type} style={s.section}>
            <div style={{ ...s.sectionTitle, color: TYPE_COLORS[type] }}>{type}</div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Normal Balance</th>
                  <th style={s.th}>Description</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(account => (
                  <tr key={account.id}>
                    <td style={s.td}><span style={s.code}>{account.code}</span></td>
                    <td style={s.td}>{account.name}</td>
                    <td style={s.td}>{account.normal_balance}</td>
                    <td style={{ ...s.td, color: '#94a3b8' }}>{account.description || '—'}</td>
                    <td style={s.td}>
                      <div style={s.actions}>
                        <button style={s.editBtn} onClick={() => setModal({ account })}>Edit</button>
                        <button style={s.delBtn} onClick={() => handleDelete(account)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {modal && <AccountForm account={modal.account} onClose={() => setModal(null)} />}
    </div>
  );
}
