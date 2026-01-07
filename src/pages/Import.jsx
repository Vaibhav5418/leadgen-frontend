import { useState } from 'react';
import API from '../api/axios';

export default function Import() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [category, setCategory] = useState('IND-IT & Service');

  const categories = [
    'IND-IT & Service',
    'Accounting & Book keeping',
    'Web Design & Development',
    'Enterprise Software',
    'Finance Services - IND',
    'E-commerce',
    'CRM',
    'Middle East',
    'International',
    'USA Chicago',
    'IT Company - USA',
    'IT Company - Chicago',
    'Weam.ai Mumbai Data',
    'ERP Software',
    'ERP NEXT- Manufacturing-Automotive Components & Spares',
    'Salon & Spa - Chicago',
    'SPA & SALON AHMEDABAD',
    'kology'
  ];

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setMessage('');
    setError('');
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV or Excel file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    try {
      setUploading(true);
      setError('');
      setMessage('');
      setResult(null);

      const response = await API.post('/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setResult(response.data.data);
      setMessage('Import completed successfully');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Upload failed. Please try again.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Import Contacts</h1>
        <p className="text-gray-600 mb-6">
          Upload a CSV or Excel file with the following columns:
          Name, Title, Company, Email, First Phone, # Employees, Category,
          Industry, Keywords, Person Linkedin Url, Website, Company Linkedin Url,
          Facebook Url, Twitter Url, City, State, Country, Company Address,
          Company City, Company State, Company Country, Company Phone,
          SEO Description, Technologies, Annual Revenue.
        </p>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select category to assign
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select file (CSV, XLSX, or XLS)
          </label>
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg p-2 mb-4"
          />

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload & Import'}
          </button>

          {message && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm">
                  <strong className="text-gray-700">Total Rows:</strong>
                  <span className="ml-2 text-gray-900">{result.totalRows}</span>
                </div>
                <div className="text-sm">
                  <strong className="text-gray-700">Valid Contacts:</strong>
                  <span className="ml-2 text-gray-900">{result.validContacts}</span>
                </div>
                <div className="text-sm">
                  <strong className="text-green-700">Inserted:</strong>
                  <span className="ml-2 text-green-900 font-semibold">{result.inserted}</span>
                </div>
                <div className="text-sm">
                  <strong className="text-orange-700">Skipped (Duplicates):</strong>
                  <span className="ml-2 text-orange-900 font-semibold">{result.skipped || 0}</span>
                </div>
              </div>

              {/* Column Mapping Information */}
              {result.columnMapping && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-semibold text-blue-800 mb-3">
                      Column Mapping Information
                    </div>
                    
                    {/* Detected Columns */}
                    {result.columnMapping.detected && result.columnMapping.detected.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-blue-700 mb-1">
                          Detected Columns ({result.columnMapping.detected.length}):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.columnMapping.detected.map((col, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mapped Columns */}
                    {result.columnMapping.mapped && result.columnMapping.mapped.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-green-700 mb-1">
                          Successfully Mapped ({result.columnMapping.mapped.length}):
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {result.columnMapping.mapped.map((map, idx) => (
                            <div key={idx} className="text-xs text-gray-700">
                              <span className="font-medium">{map.original}</span>
                              <span className="mx-2">→</span>
                              <span className="text-green-700">{map.mapped}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unmapped Columns */}
                    {result.columnMapping.unmapped && result.columnMapping.unmapped.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-orange-700 mb-1">
                          Unmapped Columns ({result.columnMapping.unmapped.length}):
                        </div>
                        <div className="text-xs text-orange-600 mb-1">
                          These columns were not recognized and will be ignored.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.columnMapping.unmapped.map((col, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm font-semibold text-yellow-800 mb-2">
                    Warnings & Errors ({result.errors.length}):
                  </div>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1 max-h-60 overflow-y-auto">
                    {result.errors.map((errMsg, idx) => (
                      <li key={idx}>{errMsg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
