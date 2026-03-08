import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useImportFile, usePreviewFile, useImportBatches, useDeleteBatch } from '../../api/imports';
import { useAccounts } from '../../api/accounts';
import { useClasses } from '../../api/classes';
import AmountDisplay from '../../components/shared/AmountDisplay';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const STEPS = ['Upload', 'Preview', 'Done'];

const s = {
  page: { maxWidth: '800px' },
  h1: { fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '24px' },
  stepper: { display: 'flex', gap: '0', marginBottom: '32px' },
  stepItem: (active, done) => ({
    flex: 1, textAlign: 'center', padding: '10px',
    background: done ? '#dcfce7' : active ? '#eff6ff' : '#f8fafc',
    color: done ? '#16a34a' : active ? '#2563eb' : '#94a3b8',
    fontSize: '13px', fontWeight: '600', borderBottom: `2px solid ${done ? '#16a34a' : active ? '#2563eb' : '#e2e8f0'}`,
  }),
  card: { background: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '24px' },
  zone: (isDragActive) => ({
    border: `2px dashed ${isDragActive ? '#2563eb' : '#cbd5e1'}`,
    borderRadius: '12px', padding: '48px 24px', textAlign: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
    background: isDragActive ? '#eff6ff' : '#f8fafc',
  }),
  zoneIcon: { fontSize: '48px', marginBottom: '12px' },
  zoneText: { fontSize: '16px', color: '#64748b', marginBottom: '4px' },
  zoneHint: { fontSize: '12px', color: '#94a3b8' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', marginTop: '16px' },
  select: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' },
  btn: { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginTop: '16px' },
  outlineBtn: { padding: '10px 20px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginTop: '16px', marginRight: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '12px' },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '8px 12px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', color: '#374151' },
  resultCard: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '20px', marginBottom: '16px' },
  stat: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' },
  histTable: { width: '100%', borderCollapse: 'collapse', marginTop: '16px' },
  delBtn: { padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', background: '#fff' },
};

function DropZone({ onFile }) {
  const onDrop = useCallback((files) => { if (files[0]) onFile(files[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'], 'application/octet-stream': ['.ofx', '.qfx'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
  });

  return (
    <div {...getRootProps()} style={s.zone(isDragActive)}>
      <input {...getInputProps()} />
      <div style={s.zoneIcon}>📂</div>
      <div style={s.zoneText}>{isDragActive ? 'Drop it here' : 'Drag & drop your bank file, or click to browse'}</div>
      <div style={s.zoneHint}>Supports CSV, OFX, QFX, XLSX files up to 10MB</div>
    </div>
  );
}

function ImportHistory() {
  const { data: batches = [] } = useImportBatches();
  const deleteBatch = useDeleteBatch();

  if (!batches.length) return null;

  return (
    <div style={s.card}>
      <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Import History</div>
      <table style={s.histTable}>
        <thead>
          <tr>
            <th style={s.th}>File</th>
            <th style={s.th}>Type</th>
            <th style={s.th}>Imported</th>
            <th style={s.th}>Skipped</th>
            <th style={s.th}>Date</th>
            <th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr key={b.id}>
              <td style={s.td}>{b.filename}</td>
              <td style={s.td}>{b.file_type}</td>
              <td style={s.td}>{b.imported_count}</td>
              <td style={s.td}>{b.skipped_count}</td>
              <td style={s.td}>{dayjs(b.imported_at).format('MMM D, YYYY HH:mm')}</td>
              <td style={s.td}>
                <button style={s.delBtn} onClick={async () => {
                  if (!confirm('Delete this import and all its transactions?')) return;
                  try { await deleteBatch.mutateAsync(b.id); toast.success('Import deleted'); } catch (e) { toast.error(e.message); }
                }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Import() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [classId, setClassId] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const { data: accounts = [] } = useAccounts();
  const { data: classes = [] } = useClasses();
  const bankAccounts = accounts.filter(a => a.type === 'ASSET');
  const previewFile = usePreviewFile();
  const importFile = useImportFile();

  const handleFile = (f) => {
    setFile(f);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!file) return toast.error('Select a file first');
    if (!sourceAccountId) return toast.error('Select the bank account');
    try {
      const res = await previewFile.mutateAsync(file);
      setPreview(res);
      setStep(1);
    } catch (e) { toast.error(e.message); }
  };

  const handleImport = async () => {
    try {
      const res = await importFile.mutateAsync({ file, sourceAccountId: parseInt(sourceAccountId), classId: classId ? parseInt(classId) : null });
      setResult(res);
      setStep(2);
      toast.success(`Imported ${res.imported} transactions`);
    } catch (e) { toast.error(e.message); }
  };

  const reset = () => { setStep(0); setFile(null); setPreview(null); setResult(null); setSourceAccountId(''); setClassId(''); };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Import Bank Transactions</h1>

      <div style={s.stepper}>
        {STEPS.map((label, i) => (
          <div key={i} style={s.stepItem(step === i, step > i)}>{i + 1}. {label}</div>
        ))}
      </div>

      {step === 0 && (
        <div style={s.card}>
          <DropZone onFile={handleFile} />
          {file && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f0f9ff', borderRadius: '8px', fontSize: '13px', color: '#0369a1' }}>
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
          <label style={s.label}>Which bank account did these transactions come from?</label>
          <select style={s.select} value={sourceAccountId} onChange={e => setSourceAccountId(e.target.value)}>
            <option value="">Select account...</option>
            {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
          </select>
          <label style={s.label}>Assign class to all imported transactions <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
          <select style={s.select} value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">— No class —</option>
            {classes.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <br />
          <button style={s.btn} onClick={handlePreview} disabled={previewFile.isPending}>
            {previewFile.isPending ? 'Parsing...' : 'Preview →'}
          </button>
        </div>
      )}

      {step === 1 && preview && (
        <div style={s.card}>
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>
            Preview — {preview.total} rows found ({preview.fileType})
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Showing first {preview.preview.length} rows</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Description</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i}>
                    <td style={s.td}>{row.date}</td>
                    <td style={s.td}>{row.description}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}><AmountDisplay amount={row.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button style={s.outlineBtn} onClick={() => setStep(0)}>← Back</button>
            <button style={s.btn} onClick={handleImport} disabled={importFile.isPending}>
              {importFile.isPending ? 'Importing...' : `Import all ${preview.total} transactions`}
            </button>
          </div>
        </div>
      )}

      {step === 2 && result && (
        <div style={s.card}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#16a34a', marginBottom: '16px' }}>✓ Import Complete</div>
          <div style={s.resultCard}>
            <div style={s.stat}><span>File</span><strong>{result.filename}</strong></div>
            <div style={s.stat}><span>Total rows</span><strong>{result.total}</strong></div>
            <div style={s.stat}><span>Imported</span><strong style={{ color: '#16a34a' }}>{result.imported}</strong></div>
            <div style={s.stat}><span>Skipped (duplicates)</span><strong style={{ color: '#d97706' }}>{result.skipped}</strong></div>
          </div>
          <button style={s.btn} onClick={reset}>Import another file</button>
          <a href="/transactions" style={{ ...s.outlineBtn, display: 'inline-block', textDecoration: 'none', marginLeft: '10px', textAlign: 'center' }}>View Transactions →</a>
        </div>
      )}

      <ImportHistory />
    </div>
  );
}
