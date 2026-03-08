import { useState } from 'react';
import { useIncomeStatement } from '../../../api/reports';
import { useClasses } from '../../../api/classes';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const s = {
  page: { maxWidth: '900px' },
  h1: { fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '24px' },
  controls: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' },
  label: { fontSize: '13px', fontWeight: '600', color: '#374151' },
  input: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' },
  select: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', background: '#fff', cursor: 'pointer' },
  card: { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '20px' },
  cardHeader: (color) => ({ padding: '14px 20px', background: color, color: '#fff', fontWeight: '700', fontSize: '15px', display: 'flex', justifyContent: 'space-between' }),
  row: { display: 'flex', justifyContent: 'space-between', padding: '10px 20px', fontSize: '13px', borderBottom: '1px solid #f1f5f9' },
  total: { display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontSize: '14px', fontWeight: '700', background: '#f8fafc' },
  netCard: (positive) => ({
    padding: '20px', borderRadius: '12px', textAlign: 'center',
    background: positive ? '#f0fdf4' : '#fef2f2',
    border: `1px solid ${positive ? '#bbf7d0' : '#fecaca'}`,
    marginBottom: '20px',
  }),
  netLabel: { fontSize: '13px', color: '#64748b', marginBottom: '4px' },
  netAmount: (positive) => ({ fontSize: '32px', fontWeight: '800', color: positive ? '#16a34a' : '#dc2626' }),
  code: { fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', marginRight: '8px' },
  classBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: '#2563eb', marginLeft: '12px' },
};

export default function IncomeStatement() {
  const [startDate, setStartDate] = useState(dayjs().startOf('year').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [classId, setClassId] = useState('');

  const { data: classes = [] } = useClasses();
  const { data, isLoading, error } = useIncomeStatement(startDate, endDate, classId || null);

  const activeClass = classId ? classes.find(c => String(c.id) === classId) : null;

  const chartData = data ? [
    { name: 'Revenue',    value: data.totalRevenue,  fill: '#16a34a' },
    { name: 'Expenses',   value: data.totalExpenses, fill: '#dc2626' },
    { name: 'Net Income', value: data.netIncome,     fill: data.netIncome >= 0 ? '#2563eb' : '#9333ea' },
  ] : [];

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ ...s.h1, marginBottom: 0 }}>Income Statement</h1>
        {activeClass && <span style={s.classBadge}>🏷️ {activeClass.name}</span>}
      </div>

      <div style={s.controls}>
        <label style={s.label}>From</label>
        <input type="date" style={s.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
        <label style={s.label}>To</label>
        <input type="date" style={s.input} value={endDate} onChange={e => setEndDate(e.target.value)} />

        {/* Class / Property filter */}
        <label style={{ ...s.label, marginLeft: '8px' }}>Property / Class</label>
        <select style={s.select} value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">All properties</option>
          {classes.filter(c => c.is_active).map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading && <div style={{ color: '#64748b' }}>Loading...</div>}
      {error && <div style={{ color: '#dc2626' }}>{error.message}</div>}

      {data && (
        <>
          <div style={s.netCard(data.netIncome >= 0)}>
            <div style={s.netLabel}>Net Income{activeClass ? ` — ${activeClass.name}` : ''}</div>
            <div style={s.netAmount(data.netIncome >= 0)}>{fmt(data.netIncome)}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {dayjs(startDate).format('MMM D, YYYY')} – {dayjs(endDate).format('MMM D, YYYY')}
            </div>
          </div>

          <div style={s.card}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 16, right: 20, left: 20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}
                  label={false}
                  isAnimationActive={false}
                  fill="#2563eb"
                >
                  {chartData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.card}>
            <div style={s.cardHeader('#16a34a')}>
              <span>Revenue</span>
              <span>{fmt(data.totalRevenue)}</span>
            </div>
            {data.revenue.map(r => (
              <div key={r.account_id} style={s.row}>
                <span><span style={s.code}>{r.code}</span>{r.name}</span>
                <span style={{ color: '#16a34a', fontWeight: '500' }}>{fmt(r.total)}</span>
              </div>
            ))}
            {data.revenue.length === 0 && (
              <div style={{ ...s.row, color: '#94a3b8' }}>No revenue in this period</div>
            )}
            <div style={s.total}>
              <span>Total Revenue</span>
              <span style={{ color: '#16a34a' }}>{fmt(data.totalRevenue)}</span>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardHeader('#dc2626')}>
              <span>Expenses</span>
              <span>{fmt(data.totalExpenses)}</span>
            </div>
            {data.expenses.map(r => (
              <div key={r.account_id} style={s.row}>
                <span><span style={s.code}>{r.code}</span>{r.name}</span>
                <span style={{ color: '#dc2626', fontWeight: '500' }}>{fmt(r.total)}</span>
              </div>
            ))}
            {data.expenses.length === 0 && (
              <div style={{ ...s.row, color: '#94a3b8' }}>No expenses in this period</div>
            )}
            <div style={s.total}>
              <span>Total Expenses</span>
              <span style={{ color: '#dc2626' }}>{fmt(data.totalExpenses)}</span>
            </div>
          </div>

          <div style={{ ...s.card, border: `2px solid ${data.netIncome >= 0 ? '#16a34a' : '#dc2626'}` }}>
            <div style={{ ...s.total, fontSize: '18px', padding: '16px 20px' }}>
              <span>Net Income</span>
              <span style={{ color: data.netIncome >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(data.netIncome)}</span>
            </div>
          </div>

          {activeClass && (
            <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
              Showing only journal entries tagged with class "{activeClass.name}".
              Untagged entries are excluded.
            </div>
          )}
        </>
      )}
    </div>
  );
}
