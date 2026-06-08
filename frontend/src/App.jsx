import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import MainLayout from './components/Layout/MainLayout';
import JobsFeature from './features/JobsFeature';
import ConnectionsFeature from './features/ConnectionsFeature';
import DashboardFeature from './features/DashboardFeature';
import LogsFeature from './features/LogsFeature';

// Configurazione globale fetch
const setupFetchInterceptor = (store) => {
  const originalFetch = window.fetch;
  window.fetch = async (url, options = {}) => {
    const state = store.getState();
    const headers = new Headers(options.headers || {});
    
    // Inietta header del progetto attivo se va verso /api
    if (url.includes('/api/')) {
      headers.set('X-Project-ID', state.activeProjectId);
    }
    
    options.headers = headers;
    return originalFetch(url, options);
  };
};

function App() {
  const { theme } = useAppStore();

  useEffect(() => {
    setupFetchInterceptor(useAppStore);
    useAppStore.getState().fetchProjects();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="jobs" element={<JobsFeature />} />
          <Route path="dashboard" element={<DashboardFeature />} />
          <Route path="connections" element={<ConnectionsFeature />} />
          <Route path="logs" element={<LogsFeature />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
