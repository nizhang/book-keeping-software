import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',                    label: 'Dashboard',        icon: '📊' },
  { to: '/transactions',        label: 'Transactions',     icon: '💳' },
  { to: '/import',              label: 'Import',           icon: '📥' },
  { to: '/accounts',            label: 'Chart of Accounts',icon: '📋' },
  { to: '/classes',             label: 'Classes',          icon: '🏷️' },
  { to: '/opening-balances',   label: 'Opening Balances', icon: '🏦' },
  { to: '/reports/income',      label: 'Income Statement', icon: '📈' },
  { to: '/reports/balance',     label: 'Balance Sheet',    icon: '⚖️' },
];

const sidebarStyle = {
  width: '220px',
  background: '#1e293b',
  color: '#e2e8f0',
  padding: '0',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

const logoStyle = {
  padding: '20px 16px',
  fontSize: '18px',
  fontWeight: '700',
  color: '#f8fafc',
  borderBottom: '1px solid #334155',
};

const navStyle = { padding: '8px 0', flex: 1 };

const linkBase = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 16px',
  color: '#94a3b8',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '500',
  borderLeft: '3px solid transparent',
  transition: 'all 0.15s',
};

const linkActive = {
  ...linkBase,
  color: '#f8fafc',
  background: '#334155',
  borderLeftColor: '#3b82f6',
};

export default function Sidebar() {
  return (
    <aside style={sidebarStyle}>
      <div style={logoStyle}>📒 BookKeeping</div>
      <nav style={navStyle}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => isActive ? linkActive : linkBase}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
