import { useDrilldown } from '../../api/reports';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  box: {
    background: '#fff', borderRadius: '14px', padding: '28px',
    width: '820px', maxWidth: '95vw', maxHeight: '85vh',
    display: 'flex', flexDirection: 'column',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  title: { fontSize: '17px', fontWeight: '700', color: '#1e293b' },
  sub: { fontSize: '12px', color: '#64748b', marginTop: '3px' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b', lineHeight: 1 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b',
    borderBottom: '2px solid #e2e8f0', background: '#f8fafc', position: 'sticky', top: 0,
  },
  td: { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#374151', verticalAlign: 'top' },
  totalRow: { padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '14px', borderTop: '2px solid #e2e8f0', marginTop: '4px' },
  badge: (type) => ({
    display: 'inline-block', padding: '1px 7px', borderRadius: '99px', fontSize: '11px', fontWeight: '600',
    background: type === 'DEBIT' ? '#fee2e2' : '#dcfce7',
    color: type === 'DEBIT' ? '#dc2626' : '#16a34a',
  }),
  scrollArea: { overflowY: 'auto', flex: 1 },
};

export default function DrilldownModal({ params, onClose }) {
  const { data, isLoading } = useDrilldown(params);

  const entries = data?.entries || [];
  const account = data?.account;

  // Net signed total: normal_balance determines which direction is "positive"
  const isDebitNormal = account?.normal_balance === 'DEBIT';
  const net = entries.reduce((sum, e) => {
    const signed = e.entry_type === 'DEBIT' ? e.amount : -e.amount;
    return sum + (isDebitNormal ? signed : -signed);
  }, 0);

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.box}>
        <div style={s.header}>
          <div>
            <div style={s.title}>
              {account ? `${account.code} — ${account.name}` : 'Loading...'}
            </div>
            <div style={s.sub}>
              {params.startDate && params.endDate
                ? `${params.startDate} to ${params.endDate}`
                : params.endDate ? `As of ${params.endDate}` : ''}
              {params.classId ? ' · Filtered by class' : ''}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.scrollArea}>
          {isLoading && <div style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>Loading...</div>}

          {!isLoading && entries.length === 0 && (
            <div style={{ padding: '20px', color: '#94a3b8', textAlign: 'center' }}>No entries found for this account in the selected period.</div>
          )}

          {!isLoading && entries.length > 0 && (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Description</th>
                  <th style={s.th}>Memo</th>
                  <th style={s.th}>Class</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Dr</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Cr</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td style={s.td}>{e.date}</td>
                    <td style={s.td}>{e.transaction_type === 'opening_balance' ? <em style={{ color: '#94a3b8' }}>Opening Balance</em> : e.description}</td>
                    <td style={{ ...s.td, color: '#64748b' }}>{e.memo || ''}</td>
                    <td style={s.td}>{e.class_name ? <span style={{ padding: '1px 7px', background: '#eff6ff', borderRadius: '99px', fontSize: '11px', color: '#2563eb' }}>{e.class_name}</span> : ''}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>
                      {e.entry_type === 'DEBIT' ? fmt(e.amount) : ''}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>
                      {e.entry_type === 'CREDIT' ? fmt(e.amount) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {entries.length > 0 && (
          <div style={s.totalRow}>
            Net: <span style={{ color: net >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(Math.abs(net))}{net < 0 ? ' (Cr)' : ' (Dr net)'}</span>
            &nbsp;·&nbsp; {entries.length} entries
          </div>
        )}
      </div>
    </div>
  );
}
