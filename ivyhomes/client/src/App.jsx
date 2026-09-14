import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SavedProvider } from './context/SavedContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';

// Route-level code splitting: the browse grid, the detail page and the
// insights screen are three very different bundles and nobody needs all three.
const Login = lazy(() => import('./pages/Login'));
const Listings = lazy(() => import('./pages/Listings'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const Rentals = lazy(() => import('./pages/Rentals'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Saved = lazy(() => import('./pages/Saved'));
const Insights = lazy(() => import('./pages/Insights'));

const FullPageSpinner = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-ink-soft">
    <Spinner className="h-6 w-6" />
  </div>
);

function RequireAuth({ children }) {
  const { status } = useAuth();
  if (status === 'restoring') return <FullPageSpinner />;
  if (status === 'anon') return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { status } = useAuth();
  if (status === 'restoring') return <FullPageSpinner />;
  if (status === 'authed') return <Navigate to="/listings" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <SavedProvider>
        <Suspense fallback={<FullPageSpinner />}>
          <Routes>
            <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Navigate to="/listings" replace />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/listings/:id" element={<ListingDetail />} />
              <Route path="/rentals" element={<Rentals />} />
              <Route path="/rentals/:id" element={<ListingDetail kind="rental" />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/insights" element={<Insights />} />
            </Route>
            <Route path="*" element={<Navigate to="/listings" replace />} />
          </Routes>
        </Suspense>
      </SavedProvider>
    </AuthProvider>
  );
}
