import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider, getSavedLanguage } from '@/context/LanguageContext';
import { Layout } from '@/components/Layout';
import { LanguageSelectPage } from '@/pages/LanguageSelectPage';
import { HomePage } from '@/pages/HomePage';
import { ReportPage } from '@/pages/ReportPage';
import { ConfirmationPage } from '@/pages/ConfirmationPage';
import { StatusPage } from '@/pages/StatusPage';
import { DashboardPage } from '@/pages/DashboardPage';
import type { JSX } from 'react';

// Guard: redirect to language select if no language saved yet
function LanguageGuard({ children }: { children: JSX.Element }) {
  const saved = getSavedLanguage();
  if (!saved) return <Navigate to="/" replace />;
  return children;
}

// The language-select page is shown only at "/" when no language is saved
function RootRoute() {
  const saved = getSavedLanguage();
  if (saved) return <Navigate to="/home" replace />;
  return <LanguageSelectPage />;
}

function AppRoutes() {
  const location = useLocation();
  const isLanguageSelect = location.pathname === '/';

  return (
    <>
      {isLanguageSelect ? (
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Layout>
          <Routes>
            <Route path="/home" element={<LanguageGuard><HomePage /></LanguageGuard>} />
            <Route path="/report" element={<LanguageGuard><ReportPage /></LanguageGuard>} />
            <Route path="/confirmation" element={<LanguageGuard><ConfirmationPage /></LanguageGuard>} />
            <Route path="/status" element={<LanguageGuard><StatusPage /></LanguageGuard>} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Layout>
      )}
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
