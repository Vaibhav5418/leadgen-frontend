import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
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
import ProjectDashboard from './pages/ProjectDashboard';
import ProspectDashboard from './pages/ProspectDashboard';
import MasterDashboard from './pages/MasterDashboard';
import Report from './pages/Report';
import LinkedInReport from './pages/LinkedInReport';
import ColdCallingReport from './pages/ColdCallingReport';
import EmailReport from './pages/EmailReport';
import FunnelProjects from './pages/FunnelProjects';
import LinkedInFunnelDetail from './pages/LinkedInFunnelDetail';
import ColdCallingFunnelDetail from './pages/ColdCallingFunnelDetail';
import EmailFunnelDetail from './pages/EmailFunnelDetail';

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

        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
            path="/master-dashboard"
            element={
              <PrivateRoute>
                <MasterDashboard />
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
            path="/projects/dashboard"
            element={
              <PrivateRoute>
                <ProjectDashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/prospects/dashboard"
            element={
              <PrivateRoute>
                <ProspectDashboard />
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
                <Report />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/linkedin-funnel"
            element={
              <PrivateRoute>
                <LinkedInReport />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/cold-calling-funnel"
            element={
              <PrivateRoute>
                <ColdCallingReport />
              </PrivateRoute>
            }
          />

          <Route
            path="/projects/:id/email-funnel"
            element={
              <PrivateRoute>
                <EmailReport />
              </PrivateRoute>
            }
          />

          <Route
            path="/funnel"
            element={
              <PrivateRoute>
                <FunnelProjects />
              </PrivateRoute>
            }
          />

          <Route
            path="/funnel/:id/linkedin"
            element={
              <PrivateRoute>
                <LinkedInFunnelDetail />
              </PrivateRoute>
            }
          />

          <Route
            path="/funnel/:id/cold-calling"
            element={
              <PrivateRoute>
                <ColdCallingFunnelDetail />
              </PrivateRoute>
            }
          />

          <Route
            path="/funnel/:id/email"
            element={
              <PrivateRoute>
                <EmailFunnelDetail />
              </PrivateRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
