import { useState } from 'react';
import { useClasses, useCreateClass, useUpdateClass, useDeleteClass } from '../../api/classes';
import toast from 'react-hot-toast';

const s = {
  page: { maxWidth: '700px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  h1: { fontSize: '24px', fontWeight: '700', color: '#1e293b' },
  addBtn: { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  td: { padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f1f5f9', color: '#374151' },
  actions: { display: 'flex', gap: '8px' },
  editBtn: { padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: '#fff' },
  delBtn: { padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: '#fff', color: '#dc2626' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox: { background: '#fff', borderRadius: '12px', padding: '28px', width: '400px', maxWidth: '90vw' },
  modalTitle: { fontSize: '18px', fontWeight: '700', marginBottom: '20px' },
  formRow: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' },
  footer: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' },
  cancelBtn: { padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', background: '#fff' },
  saveBtn: { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  empty: { textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px' },
  hint: { fontSize: '13px', color: '#64748b', marginBottom: '20px' },
};

function ClassForm({ cls, onClose }) {
  const isEdit = !!cls?.id;
  const create = useCreateClass();
  const update = useUpdateClass();
  const [name, setName] = useState(cls?.name || '');
  const [description, setDescription] = useState(cls?.description || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) await update.mutateAsync({ id: cls.id, name, description });
      else await create.mutateAsync({ name, description });
      toast.success(isEdit ? 'Class updated' : 'Class created');
      onClose();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div style={s.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modalBox}>
        <div style={s.modalTitle}>{isEdit ? 'Edit Class' : 'New Class'}</div>
        <form onSubmit={handleSubmit}>
          <div style={s.formRow}>
            <label style={s.label}>Class Name</label>
            <input style={s.input} value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Project Alpha, Store A, Q1 Campaign" />
          </div>
          <div style={s.formRow}>
            <label style={s.label}>Description (optional)</label>
            <input style={s.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
          </div>
          <div style={s.footer}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.saveBtn}>{isEdit ? 'Save' : 'Create Class'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Classes() {
  const { data: classes = [], isLoading } = useClasses();
  const deleteClass = useDeleteClass();
  const [modal, setModal] = useState(null);

  const handleDelete = async (cls) => {
    if (!confirm(`Delete class "${cls.name}"?`)) return;
    try {
      await deleteClass.mutateAsync(cls.id);
      toast.success('Class deleted');
    } catch (err) { toast.error(err.message); }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Classes</h1>
        <button style={s.addBtn} onClick={() => setModal({})}>+ New Class</button>
      </div>

      <p style={s.hint}>
        Classes let you tag transactions by department, project, or location for segment reporting.
        Assign a class to each line when categorizing or splitting a transaction.
      </p>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Name</th>
            <th style={s.th}>Description</th>
            <th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {classes.length === 0 ? (
            <tr><td colSpan={3} style={s.empty}>No classes yet. Create one to start tracking by segment.</td></tr>
          ) : (
            classes.map(cls => (
              <tr key={cls.id}>
                <td style={{ ...s.td, fontWeight: '600' }}>{cls.name}</td>
                <td style={{ ...s.td, color: '#94a3b8' }}>{cls.description || '—'}</td>
                <td style={s.td}>
                  <div style={s.actions}>
                    <button style={s.editBtn} onClick={() => setModal({ cls })}>Edit</button>
                    <button style={s.delBtn} onClick={() => handleDelete(cls)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {modal && <ClassForm cls={modal.cls} onClose={() => setModal(null)} />}
    </div>
  );
}
