import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api/axios';

export default function CompanyDetail() {
  const { companyName } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'IND-IT & Service';
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  
  const decodedCompanyName = decodeURIComponent(companyName);

  useEffect(() => {
    fetchCompanyContacts();
  }, [decodedCompanyName, category]);

  const fetchCompanyContacts = async () => {
    try {
      setLoading(true);
      const params = { 
        category,
        page: 1,
        limit: 1000 // Get all contacts for this company
      };
      
      const response = await API.get('/contacts', { params });
      const list = response?.data?.data || response?.data || [];
      
      // Filter contacts by company name
      const companyContacts = Array.isArray(list) 
        ? list.filter(contact => (contact.company || 'No Company') === decodedCompanyName)
        : [];
      
      setContacts(companyContacts);
      setError(null);
    } catch (err) {
      setError('Failed to fetch company contacts. Please try again.');
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyInitials = (companyName) => {
    if (!companyName) return '?';
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
  };

  // Clean markdown formatting from text
  const cleanMarkdown = (text) => {
    if (!text) return '';
    
    // Remove markdown headers (##, ###, etc.)
    text = text.replace(/^#{1,6}\s+/gm, '');
    
    // Remove bold markers (**text** or __text__)
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');
    
    // Remove italic markers (*text* or _text_)
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/_([^_]+)_/g, '$1');
    
    // Remove list markers (*, -, +) at the start of lines
    text = text.replace(/^[\s]*[-*+]\s+/gm, '• ');
    
    // Remove numbered list markers (1., 2., etc.)
    text = text.replace(/^\d+\.\s+/gm, '');
    
    // Clean up multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Trim whitespace
    text = text.trim();
    
    return text;
  };

  const handleContactClick = (contactId) => {
    const categoryParam = category ? `?category=${encodeURIComponent(category)}` : '';
    navigate(`/contacts/${contactId}${categoryParam}`);
  };

  const handleBack = () => {
    const categoryParam = category ? `?category=${encodeURIComponent(category)}` : '';
    navigate(`/contacts${categoryParam}`);
  };

  const handleAnalyzeCompany = async () => {
    if (!companyDetails?.website) {
      setAnalysisError('Website URL is required for analysis');
      return;
    }

    try {
      setAnalyzing(true);
      setAnalysisError(null);
      
      const response = await API.post('/company-analysis/analyze', {
        companyName: decodedCompanyName,
        website: companyDetails.website
      });

      if (response.data.success) {
        setAnalysis(response.data.data);
      } else {
        setAnalysisError(response.data.error || 'Failed to analyze company');
      }
    } catch (err) {
      console.error('Error analyzing company:', err);
      console.error('Error response:', err?.response);
      console.error('Error status:', err?.response?.status);
      console.error('Error data:', err?.response?.data);
      
      // Provide more detailed error messages
      let errorMessage = 'Failed to analyze company website. Please try again.';
      
      if (err?.response?.status === 429) {
        // Quota or rate limit exceeded
        errorMessage = err?.response?.data?.error || 'OpenAI API quota exceeded. Please check your OpenAI account billing and add credits.';
      } else if (err?.response?.status === 500) {
        errorMessage = err?.response?.data?.error || 'Server error. Please check if OpenAI API key is configured.';
      } else if (err?.response?.status === 401) {
        errorMessage = err?.response?.data?.error || 'OpenAI API key is invalid. Please check your configuration.';
      } else if (err?.response?.status === 400) {
        errorMessage = err?.response?.data?.error || 'Invalid request. Please check the company website URL.';
      } else if (err?.code === 'ECONNREFUSED' || err?.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please make sure the backend is running.';
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      setAnalysisError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gray-200 blur-xl animate-pulse"></div>
            <div className="relative animate-spin rounded-full h-14 w-14 border-2 border-gray-200 border-t-gray-900 mx-auto"></div>
          </div>
          <p className="tracking-wide text-sm uppercase text-gray-500 font-medium">Loading company details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-5 py-4 rounded-lg shadow-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const companyDetails = contacts.length > 0 ? contacts[0] : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Contacts
        </button>

        {/* Company Analysis Section */}
        {companyDetails?.website && (
          <div className="mb-6">
            {/* Hero card with company meta + summary button */}
            <div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg border border-slate-100">
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,_#e0f2ff,_transparent_30%),_radial-gradient(circle_at_85%_15%,_#ede9fe,_transparent_28%)]"></div>
              <div className="relative p-6 lg:p-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm uppercase tracking-wide font-semibold text-blue-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Groq AI Insight
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">{decodedCompanyName}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    {companyDetails.website && (
                      <a
                        href={companyDetails.website.startsWith('http') ? companyDetails.website : `https://${companyDetails.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition"
                      >
                        {/* Globe / internet icon */}
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4a8 8 0 100 16 8 8 0 000-16z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20M12 2c2.5 2.5 4 6 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6-4-10s1.5-7.5 4-10z" />
                        </svg>
                        {companyDetails.website}
                      </a>
                    )}
                    {companyDetails.companyLinkedinUrl && (
                      <a
                        href={companyDetails.companyLinkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition"
                      >
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {companyDetails.email && (
                      <a
                        href={`mailto:${companyDetails.email}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition"
                      >
                        {/* Mail / envelope icon */}
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {companyDetails.email}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={handleAnalyzeCompany}
                    disabled={analyzing}
                    className="group inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {analyzing ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Summarizing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Summarize
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {analysisError && (
              <div className="mt-3 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl shadow-sm animate-fade-in">
                <p className="text-sm">{analysisError}</p>
              </div>
            )}

            {analysis && (
              <div className="mt-6 animate-fade-in">
                {/* Professional Horizontal Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Company Overview */}
                  <div className="group relative bg-gradient-to-br from-white to-blue-50/30 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative p-6 h-full flex flex-col">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-xl font-bold text-white">1</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs uppercase tracking-wider text-blue-600 font-bold mb-1">Company Overview</p>
                          <p className="text-base text-gray-900 font-semibold">Position & Story</p>
                        </div>
                      </div>
                      <div className="flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line overflow-y-auto">
                        {cleanMarkdown(analysis.analysis.companyOverview || analysis.fullText.split('1)')[1]?.split('2)')[0]?.trim() || 'Analysis not available')}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Strategic positioning</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core Offering */}
                  <div className="group relative bg-gradient-to-br from-white to-emerald-50/30 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative p-6 h-full flex flex-col">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-xl font-bold text-white">2</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs uppercase tracking-wider text-emerald-600 font-bold mb-1">Core Offering</p>
                          <p className="text-base text-gray-900 font-semibold">Products & Value</p>
                        </div>
                      </div>
                      <div className="flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line overflow-y-auto">
                        {cleanMarkdown(analysis.analysis.coreOffering || analysis.fullText.split('2)')[1]?.split('3)')[0]?.trim() || 'Analysis not available')}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Value proposition</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Business Considerations */}
                  <div className="group relative bg-gradient-to-br from-white to-purple-50/30 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative p-6 h-full flex flex-col">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-xl font-bold text-white">3</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs uppercase tracking-wider text-purple-600 font-bold mb-1">Business Considerations</p>
                          <p className="text-base text-gray-900 font-semibold">Risks & Opportunities</p>
                        </div>
                      </div>
                      <div className="flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line overflow-y-auto">
                        {cleanMarkdown(analysis.analysis.businessConsiderations || analysis.fullText.split('3)')[1]?.trim() || 'Analysis not available')}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span>Strategic insights</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {analysis.generatedAt && (
                    <div className="text-xs text-gray-500">
                      Generated on {new Date(analysis.generatedAt).toLocaleString()}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleAnalyzeCompany}
                      disabled={analyzing}
                      className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Re-run
                    </button>
                    <button
                      onClick={() => {
                        setAnalysis(null);
                        setAnalysisError(null);
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Details - Left Side */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-blue-700">
                    {getCompanyInitials(decodedCompanyName)}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  {decodedCompanyName}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>{contacts.length} {contacts.length === 1 ? 'person' : 'people'}</span>
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-4 border-t border-gray-200 pt-6">
                {companyDetails?.industry && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Industry</h3>
                    <p className="text-sm text-gray-900">{companyDetails.industry}</p>
                  </div>
                )}

                {(companyDetails?.companyAddress || companyDetails?.companyCity || companyDetails?.companyState || companyDetails?.companyCountry) && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Address</h3>
                    <p className="text-sm text-gray-900">
                      {[
                        companyDetails.companyAddress,
                        companyDetails.companyCity,
                        companyDetails.companyState,
                        companyDetails.companyCountry
                      ].filter(Boolean).join(', ') || 'Not available'}
                    </p>
                  </div>
                )}

                {companyDetails?.companyPhone && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Phone</h3>
                    <a 
                      href={`tel:${companyDetails.companyPhone}`} 
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {companyDetails.companyPhone}
                    </a>
                  </div>
                )}

                {companyDetails?.website && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Website</h3>
                    <a 
                      href={companyDetails.website.startsWith('http') ? companyDetails.website : `https://${companyDetails.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {companyDetails.website}
                    </a>
                  </div>
                )}

                {companyDetails?.companyLinkedinUrl && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">LinkedIn</h3>
                    <a 
                      href={companyDetails.companyLinkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      View Company LinkedIn
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* People List - Right Side */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                People at {decodedCompanyName}
              </h2>
              
              {contacts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No contacts found for this company.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contacts.map((contact) => (
                    <div
                      key={contact._id}
                      onClick={() => handleContactClick(contact._id)}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-blue-700">
                            {contact.name ? contact.name.substring(0, 2).toUpperCase() : '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">
                            {contact.name || 'Unknown'}
                          </h3>
                          {contact.title && (
                            <p className="text-xs text-gray-600 mb-2 truncate">{contact.title}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <a 
                              href={`mailto:${contact.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-blue-600 hover:underline truncate"
                            >
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.firstPhone && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <a 
                              href={`tel:${contact.firstPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-blue-600 hover:underline"
                            >
                              {contact.firstPhone}
                            </a>
                          </div>
                        )}
                        {(contact.personLinkedinUrl || contact.companyLinkedinUrl) && (
                          <div className="flex items-center gap-2 text-xs">
                            <a
                              href={contact.personLinkedinUrl || contact.companyLinkedinUrl}
                              onClick={(e) => e.stopPropagation()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                              LinkedIn
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
