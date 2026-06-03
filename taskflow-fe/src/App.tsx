import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './components/layout/MainLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import MyTasksPage from './pages/tasks/MyTasksPage';
import MembersPage from './pages/members/MembersPage';
import EvaluationsPage from './pages/evaluation/EvaluationsPage';
import AnalyticsPage from './pages/reports/AnalyticsPage';
import InboxPage from './pages/inbox/InboxPage';
import SettingsPage from './pages/settings/SettingsPage';
import TimesheetPage from './pages/timesheet/TimesheetPage';
import './styles/global.scss';

const App: React.FC = () => {
  const [currentTheme, setCurrentTheme] = React.useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('taskflow_theme') as any) || 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('dark');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('taskflow_token', token);

      // Check if this page is rendered inside an iframe (for silent refresh)
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'SILENT_REFRESH_SUCCESS',
          token: token
        }, window.location.origin);
        return;
      }

      const redirectPath = localStorage.getItem('taskflow_redirect_path') || '/';
      localStorage.removeItem('taskflow_redirect_path');
      window.location.href = redirectPath;
      return;
    }

    const existingToken = localStorage.getItem('taskflow_token');
    if (!existingToken) {
      const currentFullPath = window.location.pathname + window.location.search + window.location.hash;
      // Do not store redirect path if we are already at root or it's a token response url
      if (currentFullPath && !currentFullPath.includes('token=')) {
        localStorage.setItem('taskflow_redirect_path', currentFullPath);
      }
      const backendUrl = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api')
        .replace(/\/api\/?$/, '')
        .replace(/\/+$/, '');
      const publicUrl = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
      window.location.href = `${backendUrl}/auth/redirect?origin=${encodeURIComponent(window.location.origin + publicUrl)}`;
    }
  }, []);

  React.useEffect(() => {
    const handleThemeChange = () => {
      const themeVal = (localStorage.getItem('taskflow_theme') as any) || 'dark';
      setCurrentTheme(themeVal);
    };

    window.addEventListener('storage', handleThemeChange);
    window.addEventListener('theme-changed', handleThemeChange);

    return () => {
      window.removeEventListener('storage', handleThemeChange);
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (currentTheme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
        const systemTheme = e.matches ? 'dark' : 'light';
        root.setAttribute('data-theme', systemTheme);
        setResolvedTheme(systemTheme);
      };
      applySystemTheme(media);
      media.addEventListener('change', applySystemTheme);
      return () => media.removeEventListener('change', applySystemTheme);
    } else {
      root.setAttribute('data-theme', currentTheme);
      setResolvedTheme(currentTheme);
    }
  }, [currentTheme]);

  const isDark = resolvedTheme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 6,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgContainer: isDark ? '#1e2030' : '#ffffff',
          colorBgElevated: isDark ? '#1e2030' : '#ffffff',
          colorBorder: isDark ? '#2a2d42' : '#e2e8f0',
          colorText: isDark ? '#e8eaed' : '#0f172a',
          colorTextSecondary: isDark ? '#9ca0b0' : '#475569',
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="my-tasks" element={<MyTasksPage />} />
            <Route path="timesheet" element={<TimesheetPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="evaluations" element={<EvaluationsPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider >
  );
};

export default App;
