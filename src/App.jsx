import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import ContactActivityHistory from './pages/ContactActivityHistory';
import CompanyDetail from './pages/CompanyDetail';
import Import from './pages/Import';
import AddContact from './pages/AddContact';
import Projects from './pages/Projects';
import CreateProject from './pages/CreateProject';
import ProjectDetail from './pages/ProjectDetail';
import Funnel from './pages/Funnel';

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
                <Dashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/contacts"
            element={
              <PrivateRoute>
                <Contacts />
              </PrivateRoute>
            }
          />

          <Route
            path="/contacts/company/:companyName"
            element={
              <PrivateRoute>
                <CompanyDetail />
              </PrivateRoute>
            }
          />

          <Route
            path="/contacts/:id/activities"
            element={
              <PrivateRoute>
                <ContactActivityHistory />
              </PrivateRoute>
            }
          />

          <Route
            path="/contacts/:id"
            element={
              <PrivateRoute>
                <ContactDetail />
              </PrivateRoute>
            }
          />

          <Route
            path="/contacts/new"
            element={
              <PrivateRoute>
                <AddContact />
              </PrivateRoute>
            }
          />

          <Route
            path="/import"
            element={
              <PrivateRoute>
                <Import />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects"
            element={
              <PrivateRoute>
                <Projects />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/new"
            element={
              <PrivateRoute>
                <CreateProject />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/edit"
            element={
              <PrivateRoute>
                <CreateProject />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id"
            element={
              <PrivateRoute>
                <ProjectDetail />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/funnel"
            element={
              <PrivateRoute>
                <Funnel />
              </PrivateRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
