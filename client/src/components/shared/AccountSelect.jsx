import { useState, useRef, useEffect } from 'react';
import { useAccounts } from '../../api/accounts';

const TYPE_ORDER  = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const TYPE_LABELS = { ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expenses' };

const DROP_MAX_H = 260;

export default function AccountSelect({ value, onChange, placeholder = 'Select account...', filterTypes, style }) {
  const { data: accounts = [] } = useAccounts();
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [dropStyle, setDropStyle] = useState({});
  const containerRef        = useRef(null);
  const inputRef            = useRef(null);

  const selected = value ? accounts.find(a => a.id === value) : null;

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    // Compute fixed position from trigger rect so the dropdown escapes any
    // overflow:auto ancestor (e.g. the split modal) and never gets clipped.
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < DROP_MAX_H && rect.top > spaceBelow;
      setDropStyle({
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
          : { top: rect.bottom + 4,                      bottom: 'auto' }),
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  // Use mousedown (fires before blur) so click registers before the input loses focus
  const handleSelect = (accountId) => {
    onChange(accountId);
    setOpen(false);
    setQuery('');
  };

  const filtered = accounts.filter(a => {
    if (filterTypes && !filterTypes.includes(a.type)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
  });

  const grouped = TYPE_ORDER.reduce((acc, type) => {
    if (filterTypes && !filterTypes.includes(type)) return acc;
    const items = filtered.filter(a => a.type === type);
    if (items.length) acc[type] = items;
    return acc;
  }, {});

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Trigger / search input */}
      <div
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '6px 8px', background: '#fff', cursor: 'text',
          border: `1px solid ${open ? '#3b82f6' : '#d1d5db'}`, borderRadius: '6px',
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
          minHeight: '32px', boxSizing: 'border-box',
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={selected ? `${selected.code} – ${selected.name}` : 'Type to search...'}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', background: 'transparent', minWidth: 0 }}
            onKeyDown={e => e.key === 'Escape' && (setOpen(false), setQuery(''))}
          />
        ) : (
          <span style={{ flex: 1, fontSize: '13px', color: selected ? '#374151' : '#9ca3af', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? `${selected.code} – ${selected.name}` : placeholder}
          </span>
        )}
        <span style={{ color: '#94a3b8', fontSize: '10px', flexShrink: 0 }}>▼</span>
      </div>

      {/* Dropdown list — position:fixed so it escapes overflow:auto ancestors */}
      {open && (
        <div style={{
          position: 'fixed', zIndex: 9999,
          ...dropStyle,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: `${DROP_MAX_H}px`, overflowY: 'auto',
        }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ padding: '14px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
              No accounts match "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div style={{
                  padding: '5px 10px', fontSize: '10px', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: '#94a3b8', background: '#f8fafc',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  {TYPE_LABELS[type]}
                </div>
                {items.map(a => (
                  <div
                    key={a.id}
                    onMouseDown={() => handleSelect(a.id)}
                    style={{
                      padding: '7px 12px', fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: value === a.id ? '#eff6ff' : 'transparent',
                      color:      value === a.id ? '#2563eb'  : '#374151',
                    }}
                    onMouseEnter={e => { if (value !== a.id) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (value !== a.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8', minWidth: '34px' }}>
                      {a.code}
                    </span>
                    {a.name}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
