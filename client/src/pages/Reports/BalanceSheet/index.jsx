import { useState } from 'react';
import { useBalanceSheet } from '../../../api/reports';
import { useClasses } from '../../../api/classes';
import DrilldownModal from '../../../components/shared/DrilldownModal';
import dayjs from 'dayjs';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
// Contra-assets have a negative balance (they reduce total assets)
const isContraAsset = (r) => r.type === 'ASSET' && r.normal_balance === 'CREDIT';

const s = {
  page: { maxWidth: '800px' },
  h1: { fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '24px' },
  controls: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' },
  label: { fontSize: '13px', fontWeight: '600', color: '#374151' },
  input: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
  select: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', background: '#fff', cursor: 'pointer' },
  card: { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '16px' },
  cardHeader: (color) => ({ padding: '14px 20px', background: color, color: '#fff', fontWeight: '700', fontSize: '15px', display: 'flex', justifyContent: 'space-between' }),
  row: { display: 'flex', justifyContent: 'space-between', padding: '10px 20px', fontSize: '13px', borderBottom: '1px solid #f1f5f9' },
  total: { display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontSize: '14px', fontWeight: '700', background: '#f8fafc' },
  code: { fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', marginRight: '8px' },
  balancedBanner: {
    padding: '12px 20px', borderRadius: '10px', marginBottom: '20px', fontSize: '14px',
    fontWeight: '600', textAlign: 'center',
    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
  },
  classNote: {
    padding: '12px 20px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px',
    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
  },
  reconcilingRow: {
    display: 'flex', justifyContent: 'space-between', padding: '10px 20px',
    fontSize: '13px', borderBottom: '1px solid #f1f5f9',
    background: '#fefce8', color: '#92400e',
  },
  classBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '3px 10px', background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: '#2563eb', marginLeft: '12px',
  },
};

export default function BalanceSheet() {
  const [asOfDate, setAsOfDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [classId, setClassId] = useState('');
  const [drilldown, setDrilldown] = useState(null);

  const openDrilldown = (r) => setDrilldown({
    accountId: r.account_id,
    endDate: asOfDate,          // balance sheet is cumulative up to asOfDate
    classId: classId || null,
    includeOpeningBalance: true,
  });

  const { data: classes = [] } = useClasses();
  const { data, isLoading, error } = useBalanceSheet(asOfDate, classId || null);

  const activeClass = classId ? classes.find(c => String(c.id) === classId) : null;

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ ...s.h1, marginBottom: 0 }}>Balance Sheet</h1>
        {activeClass && <span style={s.classBadge}>🏷️ {activeClass.name}</span>}
      </div>

      <div style={s.controls}>
        <label style={s.label}>As of date</label>
        <input type="date" style={s.input} value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />

        <label style={{ ...s.label, marginLeft: '8px' }}>Property / Class</label>
        <select style={s.select} value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">All properties</option>
          {classes.filter(c => c.is_active).map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>

        <a
          href={`/api/reports/balance-sheet/export?asOfDate=${asOfDate}${classId ? `&classId=${classId}` : ''}`}
          download
          style={{ marginLeft: 'auto', padding: '7px 16px', background: '#16a34a', color: '#fff', borderRadius: '7px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}
        >
          ⬇ Export Excel
        </a>
      </div>

      {isLoading && <div style={{ color: '#64748b' }}>Loading...</div>}
      {error && <div style={{ color: '#dc2626' }}>{error.message}</div>}

      {data && (
        <>
          {data.isBalanced ? (
            <div style={s.balancedBanner}>
              ✓ Assets = Liabilities + Equity — {fmt(data.assets.total)}
            </div>
          ) : (
            <div style={{ ...s.balancedBanner, background: '#fef9c3', borderColor: '#fde047', color: '#854d0e' }}>
              ⚠ Not balanced — some journal entries may be missing a class tag
            </div>
          )}

          {activeClass && (
            <div style={s.classNote}>
              ℹ️ Showing only journal entries tagged with <strong>{activeClass.name}</strong>.
            </div>
          )}

          {/* ASSETS */}
          <div style={s.card}>
            <div style={s.cardHeader('#2563eb')}>
              <span>Assets</span>
              <span>{fmt(data.assets.total)}</span>
            </div>
            {data.assets.items.map(r => (
              <div key={r.account_id} style={{ ...s.row, ...(isContraAsset(r) ? { background: '#fafafa' } : {}) }}>
                <span>
                  <span style={s.code}>{r.code}</span>
                  {r.name}
                  {isContraAsset(r) && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>(contra)</span>
                  )}
                </span>
                <span onClick={() => openDrilldown(r)} style={{ fontWeight: '500', color: isContraAsset(r) ? '#dc2626' : 'inherit', cursor: 'pointer', textDecoration: 'underline dotted' }}>
                  {isContraAsset(r) ? `(${fmt(Math.abs(r.balance))})` : fmt(r.balance)}
                </span>
              </div>
            ))}
            {data.assets.items.length === 0 && (
              <div style={{ ...s.row, color: '#94a3b8' }}>No asset balances</div>
            )}
            <div style={s.total}>
              <span>Total Assets</span>
              <span>{fmt(data.assets.total)}</span>
            </div>
          </div>

          {/* LIABILITIES */}
          <div style={s.card}>
            <div style={s.cardHeader('#dc2626')}>
              <span>Liabilities</span>
              <span>{fmt(data.liabilities.total)}</span>
            </div>
            {data.liabilities.items.map(r => (
              <div key={r.account_id} style={s.row}>
                <span><span style={s.code}>{r.code}</span>{r.name}</span>
                <span onClick={() => openDrilldown(r)} style={{ fontWeight: '500', cursor: 'pointer', textDecoration: 'underline dotted' }}>{fmt(r.balance)}</span>
              </div>
            ))}
            {data.liabilities.items.length === 0 && (
              <div style={{ ...s.row, color: '#94a3b8' }}>No liability balances</div>
            )}
            <div style={s.total}>
              <span>Total Liabilities</span>
              <span>{fmt(data.liabilities.total)}</span>
            </div>
          </div>

          {/* EQUITY — total is always derived: Assets − Liabilities */}
          <div style={s.card}>
            <div style={s.cardHeader('#7c3aed')}>
              <span>Equity</span>
              <span>{fmt(data.equity.total)}</span>
            </div>
            {data.equity.items.map((r, i) => (
              r.isReconciling
                ? (
                  <div key="reconciling" style={s.reconcilingRow}>
                    <span style={{ fontStyle: 'italic' }}>
                      ⚠ {r.name}
                    </span>
                    <span style={{ fontWeight: '500' }}>{fmt(r.balance)}</span>
                  </div>
                ) : (
                  <div key={r.account_id || i} style={s.row}>
                    <span><span style={s.code}>{r.code}</span>{r.name}</span>
                    <span onClick={() => r.account_id && openDrilldown(r)} style={{ fontWeight: '500', color: r.balance < 0 ? '#dc2626' : 'inherit', cursor: r.account_id ? 'pointer' : 'default', textDecoration: r.account_id ? 'underline dotted' : 'none' }}>
                      {r.balance < 0 ? `(${fmt(Math.abs(r.balance))})` : fmt(r.balance)}
                    </span>
                  </div>
                )
            ))}
            {data.equity.items.length === 0 && (
              <div style={{ ...s.row, color: '#94a3b8' }}>No equity entries — set up Opening Balances</div>
            )}
            <div style={s.total}>
              <span>Total Equity <span style={{ fontSize: '11px', fontWeight: '400', color: '#94a3b8' }}>(= Assets − Liabilities)</span></span>
              <span>{fmt(data.equity.total)}</span>
            </div>
          </div>

          {/* BOTTOM LINE */}
          <div style={{ ...s.card, border: '2px solid #1e293b' }}>
            <div style={{ ...s.total, fontSize: '16px', padding: '16px 20px' }}>
              <span>Total Liabilities + Equity</span>
              <span>{fmt(data.liabilities.total + data.equity.total)}</span>
            </div>
          </div>
        </>
      )}

      {drilldown && <DrilldownModal params={drilldown} onClose={() => setDrilldown(null)} />}
    </div>
  );
}
