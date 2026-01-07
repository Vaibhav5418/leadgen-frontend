import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

const initialState = {
  name: '',
  title: '',
  company: '',
  email: '',
  firstPhone: '',
  employees: '',
  category: 'IND-IT & Service',
  industry: '',
  keywords: '',
  personLinkedinUrl: '',
  website: '',
  companyLinkedinUrl: '',
  facebookUrl: '',
  twitterUrl: '',
  city: '',
  state: '',
  country: '',
  companyAddress: '',
  companyCity: '',
  companyState: '',
  companyCountry: '',
  companyPhone: '',
  seoDescription: '',
  technologies: '',
  annualRevenue: ''
};

export default function AddContact() {
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await API.post('/contacts', form);
      navigate('/contacts');
    } catch (err) {
      let errorMsg = err?.response?.data?.error || 'Failed to save contact.';
      
      // Check if it's a duplicate error
      if (err?.response?.status === 409 || err?.response?.data?.duplicate) {
        errorMsg = `Duplicate contact detected: ${errorMsg}`;
      }
      
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add Contact</h1>
            <p className="text-gray-600 mt-2">Enter the contact details and save to MongoDB.</p>
          </div>
          <button
            onClick={() => navigate('/contacts')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Back to Contacts
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['name', 'Name', true],
            ['title', 'Title'],
            ['company', 'Company'],
            ['email', 'Email', false, 'email'],
            ['firstPhone', 'First Phone'],
            ['employees', '# Employees'],
            ['category', 'Category'],
            ['industry', 'Industry'],
            ['keywords', 'Keywords'],
            ['personLinkedinUrl', 'Person Linkedin Url'],
            ['website', 'Website'],
            ['companyLinkedinUrl', 'Company Linkedin Url'],
            ['facebookUrl', 'Facebook Url'],
            ['twitterUrl', 'Twitter Url'],
            ['city', 'City'],
            ['state', 'State'],
            ['country', 'Country'],
            ['companyAddress', 'Company Address'],
            ['companyCity', 'Company City'],
            ['companyState', 'Company State'],
            ['companyCountry', 'Company Country'],
            ['companyPhone', 'Company Phone'],
            ['seoDescription', 'SEO Description'],
            ['technologies', 'Technologies'],
            ['annualRevenue', 'Annual Revenue']
          ].map(([key, label, required, type = 'text']) => (
            <div key={key} className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">
                {label}{required ? ' *' : ''}
              </label>
              <input
                type={type}
                name={key}
                value={form[key]}
                onChange={handleChange}
                required={required}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          <div className="md:col-span-2 flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => setForm(initialState)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            >
              {saving ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
