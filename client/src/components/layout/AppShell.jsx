import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const styles = {
  shell: { display: 'flex', height: '100vh', overflow: 'hidden' },
  main: { flex: 1, overflow: 'auto', padding: '24px' },
};

export default function AppShell() {
  return (
    <div style={styles.shell}>
      <Sidebar />
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
