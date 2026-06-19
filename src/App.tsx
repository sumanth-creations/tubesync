import { Suspense, lazy, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';

import LoginPage from './components/Auth/LoginPage';
import SignupPage from './components/Auth/SignupPage';
import AuthCallback from './components/Auth/AuthCallback';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Layout from './components/Layout/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const VideosPage = lazy(() => import('./pages/VideosPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ShortsPage = lazy(() => import('./pages/ShortsPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const SEOAnalyzer = lazy(() => import('./pages/SEOAnalyzer'));
const AIAgentPage = lazy(() => import('./pages/AIAgentPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Loading page...</p>
      </div>
    </div>
  );
}

function RootRedirect() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    return <Navigate to={`/settings${window.location.search}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="/agent" element={<Suspense fallback={<PageLoader />}><AIAgentPage /></Suspense>} />
          <Route path="/generate" element={<Suspense fallback={<PageLoader />}><GeneratePage /></Suspense>} />
          <Route path="/upload" element={<Suspense fallback={<PageLoader />}><UploadPage /></Suspense>} />
          <Route path="/videos" element={<Suspense fallback={<PageLoader />}><VideosPage /></Suspense>} />
          <Route path="/activity" element={<Suspense fallback={<PageLoader />}><ActivityPage /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
          <Route path="/shorts" element={<Suspense fallback={<PageLoader />}><ShortsPage /></Suspense>} />
          <Route path="/calendar" element={<Suspense fallback={<PageLoader />}><CalendarPage /></Suspense>} />
          <Route path="/seo" element={<Suspense fallback={<PageLoader />}><SEOAnalyzer /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-medium">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
