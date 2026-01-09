import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';

// Lazy load components for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Contacts = lazy(() => import('./pages/Contacts'));
const ContactDetail = lazy(() => import('./pages/ContactDetail'));
const ContactActivityHistory = lazy(() => import('./pages/ContactActivityHistory'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
const Import = lazy(() => import('./pages/Import'));
const AddContact = lazy(() => import('./pages/AddContact'));
const Projects = lazy(() => import('./pages/Projects'));
const CreateProject = lazy(() => import('./pages/CreateProject'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gray-200 blur-xl animate-pulse"></div>
        <div className="relative animate-spin rounded-full h-14 w-14 border-2 border-gray-200 border-t-blue-600 mx-auto"></div>
      </div>
      <p className="text-sm text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

// Private Route Component
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

// Root redirect component - checks auth and redirects accordingly
const RootRedirect = () => {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Root path - redirects to login or dashboard based on auth */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<Layout />}>
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Dashboard />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/contacts"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Contacts />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/contacts/company/:companyName"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <CompanyDetail />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/contacts/:id/activities"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ContactActivityHistory />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/contacts/:id"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ContactDetail />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/contacts/new"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <AddContact />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/import"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Import />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/projects"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Projects />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/projects/new"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <CreateProject />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/projects/:id/edit"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <CreateProject />
                  </Suspense>
                </PrivateRoute>
              }
            />

            <Route
              path="/projects/:id"
              element={
                <PrivateRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ProjectDetail />
                  </Suspense>
                </PrivateRoute>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
