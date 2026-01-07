import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import CompanyDetail from './pages/CompanyDetail';
import Import from './pages/Import';
import AddContact from './pages/AddContact';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Home page → Dashboard */}
          <Route path="/" element={<Dashboard />} />

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

        <Route
          path="/contacts"
          element={<Contacts />}
        />

        <Route
          path="/contacts/company/:companyName"
          element={<CompanyDetail />}
        />

        <Route
          path="/contacts/:id"
          element={<ContactDetail />}
        />

        <Route
          path="/contacts/new"
          element={<AddContact />}
        />

        <Route
          path="/import"
          element={<Import />}
        />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
