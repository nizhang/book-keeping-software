import { useTransactions } from '../../api/transactions';
import { useIncomeStatement, useBalanceSheet } from '../../api/reports';
import { useImportBatches } from '../../api/imports';
import AmountDisplay from '../../components/shared/AmountDisplay';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const s = {
  page: {},
  h1: { fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' },
  sub: { fontSize: '13px', color: '#64748b', marginBottom: '28px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' },
  card: (color) => ({
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    borderLeft: `4px solid ${color}`,
  }),
  cardLabel: { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '8px' },
  cardValue: { fontSize: '26px', fontWeight: '800', color: '#1e293b' },
  section: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px' },
  sectionTitle: { fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  viewAll: { fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: '500' },
  txRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' },
  txDesc: { maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' },
  txDate: { fontSize: '12px', color: '#94a3b8' },
  badge: (cat) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '600',
    background: cat ? '#dcfce7' : '#fef3c7', color: cat ? '#16a34a' : '#92400e', marginLeft: '8px',
  }),
  emptyState: { textAlign: 'center', padding: '40px', color: '#94a3b8' },
  quickLinks: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' },
  quickLink: { padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '500', color: '#374151', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
};

function StatCard({ label, value, color, sub }) {
  return (
    <div style={s.card(color)}>
      <div style={s.cardLabel}>{label}</div>
      <div style={s.cardValue}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const now = dayjs();
  const startDate = now.startOf('year').format('YYYY-MM-DD');
  const endDate   = now.format('YYYY-MM-DD');

  const { data: txData } = useTransactions({ limit: 10, sortBy: 'date', sortDir: 'desc' });
  const { data: uncatData } = useTransactions({ categorized: 'false', limit: 1 });
  const { data: is } = useIncomeStatement(startDate, endDate);
  const { data: bs } = useBalanceSheet(endDate);

  const recentTxns = txData?.data || [];
  const uncategorizedCount = uncatData?.total ?? '—';
  const netIncome = is?.netIncome;
  const totalAssets = bs?.assets?.total;

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Dashboard</h1>
      <div style={s.sub}>Welcome — {now.format('MMMM D, YYYY')}</div>

      <div style={s.quickLinks}>
        <Link to="/import"        style={s.quickLink}>📥 Import Transactions</Link>
        <Link to="/transactions"  style={s.quickLink}>💳 View Transactions</Link>
        <Link to="/reports/income" style={s.quickLink}>📈 Income Statement</Link>
        <Link to="/reports/balance" style={s.quickLink}>⚖️ Balance Sheet</Link>
      </div>

      <div style={s.grid}>
        <StatCard
          label="Net Income (YTD)"
          value={netIncome !== undefined ? fmt(netIncome) : '—'}
          color={netIncome >= 0 ? '#16a34a' : '#dc2626'}
          sub={`Jan 1 – ${now.format('MMM D, YYYY')}`}
        />
        <StatCard
          label="Total Assets"
          value={totalAssets !== undefined ? fmt(totalAssets) : '—'}
          color="#2563eb"
          sub="As of today"
        />
        <StatCard
          label="Uncategorized"
          value={uncategorizedCount}
          color="#d97706"
          sub="transactions need review"
        />
        <StatCard
          label="Revenue (YTD)"
          value={is?.totalRevenue !== undefined ? fmt(is.totalRevenue) : '—'}
          color="#7c3aed"
          sub="Year to date"
        />
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>
          Recent Transactions
          <Link to="/transactions" style={s.viewAll}>View all →</Link>
        </div>
        {recentTxns.length === 0 ? (
          <div style={s.emptyState}>
            No transactions yet. <Link to="/import" style={{ color: '#2563eb' }}>Import a bank file</Link> to get started.
          </div>
        ) : (
          recentTxns.map(txn => (
            <div key={txn.id} style={s.txRow}>
              <div>
                <div style={s.txDesc}>{txn.description}</div>
                <div style={s.txDate}>{dayjs(txn.date).format('MMM D, YYYY')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AmountDisplay amount={txn.amount} />
                <span style={s.badge(txn.is_categorized)}>{txn.is_categorized ? 'Done' : 'Pending'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
