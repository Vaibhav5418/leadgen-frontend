import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api/axios';

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const returnTo = searchParams.get('returnTo');
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingLinkedIn, setFetchingLinkedIn] = useState(false);
  const [error, setError] = useState(null);
  const [contactInfoCollapsed, setContactInfoCollapsed] = useState(false);
  const [companyInsightsCollapsed, setCompanyInsightsCollapsed] = useState(false);
  const [activeInsightTab, setActiveInsightTab] = useState('about');
  const hasFetchedLinkedIn = useRef(false);

  useEffect(() => {
    fetchContact();
  }, [id]);

  const fetchContact = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/contacts/${id}`);
      setContact(response.data?.data || response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch contact details.');
      console.error('Error fetching contact:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedInData = async (useCompanyUrl = false) => {
    if (!contact) return;
    const linkedinUrl = useCompanyUrl && contact.companyLinkedinUrl 
      ? contact.companyLinkedinUrl 
      : (contact.personLinkedinUrl || contact.companyLinkedinUrl);
    if (!linkedinUrl) return;
    try {
      setFetchingLinkedIn(true);
      const url = useCompanyUrl 
        ? `/linkedin/fetch/${id}?type=company`
        : `/linkedin/fetch/${id}`;
      const response = await API.get(url);
      const updated = response.data?.data?.contact || response.data?.contact;
      if (updated) {
        setContact(updated);
      }
    } catch (err) {
      console.error('Error fetching LinkedIn data:', err);
    } finally {
      setFetchingLinkedIn(false);
    }
  };

  useEffect(() => {
    if (contact && (contact.personLinkedinUrl || contact.companyLinkedinUrl) && !hasFetchedLinkedIn.current) {
      hasFetchedLinkedIn.current = true;
      fetchLinkedInData();
    }
  }, [contact]);

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getCompanyInitials = (companyName) => {
    if (!companyName) return '?';
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
  };

  const handleOpenCompanyPage = () => {
    if (!contact?.company) return;
    const categoryToUse = categoryFromUrl || contact.category || '';
    const categoryParam = categoryToUse ? `?category=${encodeURIComponent(categoryToUse)}` : '';
    navigate(`/contacts/company/${encodeURIComponent(contact.company)}${categoryParam}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full bg-gray-200 blur-xl animate-pulse opacity-30"></div>
            <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600"></div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Loading Contact</p>
            <p className="text-xs text-gray-400 mt-1">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Not Found</h2>
            <p className="text-gray-600 mb-6">The contact you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => {
                // If returnTo is provided, navigate there, otherwise go to contacts
                if (returnTo) {
                  navigate(returnTo);
                } else {
                  const categoryParam = categoryFromUrl ? `?category=${encodeURIComponent(categoryFromUrl)}` : '';
                  navigate(`/contacts${categoryParam}`);
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {returnTo ? 'Back' : 'Back to Contacts'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const linkedinData = contact.linkedinData;
  const location = [contact.city, contact.state, contact.country].filter(Boolean).join(', ') || 'Not specified';
  const roleText = contact.title && contact.company 
    ? `${contact.title} at ${contact.company}`
    : contact.title || contact.company || '';

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Breadcrumb */}
          <nav className="mb-4 sm:mb-6 animate-fade-in-down">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 overflow-x-auto">
              <button
                onClick={() => {
                  // If returnTo is provided, navigate there, otherwise go to contacts
                  if (returnTo) {
                    navigate(returnTo);
                  } else {
                    const categoryToUse = categoryFromUrl || contact?.category || '';
                    const categoryParam = categoryToUse ? `?category=${encodeURIComponent(categoryToUse)}` : '';
                    navigate(`/contacts${categoryParam}`);
                  }
                }}
                className="hover:text-gray-900 transition-colors duration-200 flex items-center gap-1 whitespace-nowrap"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">{returnTo ? 'Back' : 'Contacts'}</span>
                <span className="sm:hidden">Back</span>
              </button>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-900 font-medium truncate">{contact.name}</span>
            </div>
          </nav>

          {/* Header Card */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 animate-fade-in-up">
            <div className="flex flex-col items-center sm:items-start sm:flex-row gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-lg ring-2 sm:ring-4 ring-blue-50">
                  {getInitials(contact.name)}
                </div>
              </div>

              {/* Name and Details */}
              <div className="flex-1 min-w-0 w-full sm:w-auto text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-start gap-2 sm:gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{contact.name}</h1>
                  {contact.category && (
                    <span className="px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200 whitespace-nowrap">
                      {contact.category}
                    </span>
                  )}
                </div>
                {roleText && (
                  <p className="text-gray-600 text-base sm:text-lg mb-2 sm:mb-3 font-medium break-words">{roleText}</p>
                )}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-center gap-3 sm:gap-6 text-gray-600 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="break-words">{location}</span>
                  </div>
                  {contact.industry && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="break-words">{contact.industry}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                {(contact.personLinkedinUrl || contact.companyLinkedinUrl) && (
                  <a
                    href={contact.personLinkedinUrl || contact.companyLinkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <span className="hidden sm:inline">LinkedIn Profile</span>
                    <span className="sm:hidden">LinkedIn</span>
                  </a>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-white text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-all duration-200 border border-gray-300 shadow-sm hover:shadow-md w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">Send Email</span>
                    <span className="sm:hidden">Email</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Contact Information */}
          <div className="lg:col-span-1">
            {/* Contact Information Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up hover:shadow-md transition-shadow duration-300">
              <div 
                className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                onClick={() => setContactInfoCollapsed(!contactInfoCollapsed)}
              >
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="hidden sm:inline">Contact Information</span>
                  <span className="sm:hidden">Contact Info</span>
                </h2>
                <button className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                  <svg 
                    className={`w-5 h-5 transition-transform duration-300 ${contactInfoCollapsed ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {!contactInfoCollapsed && (
                <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-fade-in bg-white">
                  {/* Email */}
                  {contact.email && (
                    <div className="group">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Email</label>
                      <a 
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-all duration-200 border border-transparent hover:border-blue-200"
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 flex-1 truncate min-w-0">{contact.email}</span>
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}

                  {/* Phone */}
                  {contact.firstPhone && (
                    <div className="group">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Phone</label>
                      <a 
                        href={`tel:${contact.firstPhone}`}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 border border-transparent hover:border-gray-200"
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 flex-1 break-all">{contact.firstPhone}</span>
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}

                  {/* Company Phone */}
                  {contact.companyPhone && contact.companyPhone !== contact.firstPhone && (
                    <div className="group">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Company Phone</label>
                      <a 
                        href={`tel:${contact.companyPhone}`}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 border border-transparent hover:border-gray-200"
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 flex-1 break-all">{contact.companyPhone}</span>
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Company Insights */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up hover:shadow-md transition-shadow duration-300">
              {/* Section Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="hidden sm:inline">Company Insights</span>
                  <span className="sm:hidden">Company</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 flex-shrink-0"
                    onClick={() => setCompanyInsightsCollapsed(!companyInsightsCollapsed)}
                  >
                    <svg 
                      className={`w-5 h-5 transition-transform duration-300 ${companyInsightsCollapsed ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {!companyInsightsCollapsed && (
                <div className="animate-fade-in">
                  {/* Tabs */}
                  <div className="px-4 sm:px-6 pt-3 sm:pt-4 border-b border-gray-200">
                    <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide">
                      <button
                        onClick={() => setActiveInsightTab('about')}
                        className={`pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap relative flex-shrink-0 ${
                          activeInsightTab === 'about'
                            ? 'text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        About
                        {activeInsightTab === 'about' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full animate-slide-in"></span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveInsightTab('employees')}
                        className={`pb-2 sm:pb-3 px-1 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap relative flex-shrink-0 ${
                          activeInsightTab === 'employees'
                            ? 'text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Employees {contact.employees && <span className="text-gray-400">({contact.employees})</span>}
                        {activeInsightTab === 'employees' && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full animate-slide-in"></span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Company Info */}
                  <div className="px-4 sm:px-6 py-4 sm:py-6">
                    {contact.company && (
                      <div className="mb-4 sm:mb-6">
                        {/* Company Header (clickable to open company page) */}
                        <button
                          type="button"
                          onClick={handleOpenCompanyPage}
                          className="w-full flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 text-left hover:bg-blue-50 hover:border-blue-200 transition-colors duration-200"
                        >
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-sm flex-shrink-0">
                            {getCompanyInitials(contact.company)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 break-words">{contact.company}</h3>
                            <p className="text-xs sm:text-sm text-gray-500">View company profile & insights</p>
                          </div>
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        {/* About Tab Content */}
                        {activeInsightTab === 'about' && (
                          <div className="space-y-4 sm:space-y-6 animate-fade-in">
                            {/* Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              {/* Industry */}
                              {contact.industry && (
                                <div className="p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Industry</label>
                                  <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">{contact.industry}</p>
                                </div>
                              )}

                              {/* Category */}
                              {contact.category && (
                                <div className="p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Category</label>
                                  <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">{contact.category}</p>
                                </div>
                              )}

                              {/* Location */}
                              <div className="p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Location</label>
                                <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">
                                  {[contact.companyCity, contact.companyState, contact.companyCountry].filter(Boolean).join(', ') || 
                                   [contact.city, contact.state, contact.country].filter(Boolean).join(', ') || 
                                   'Not specified'}
                                </p>
                              </div>

                              {/* Website */}
                              {contact.website && (
                                <div className="p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Website</label>
                                  <a
                                    href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 break-all"
                                  >
                                    {contact.website}
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Company Address */}
                            {contact.companyAddress && (
                              <div className="p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Address</label>
                                <p className="text-xs sm:text-sm text-gray-700 break-words">{contact.companyAddress}</p>
                              </div>
                            )}

                            {/* Keywords */}
                            {contact.keywords && (
                              <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 block">Keywords</label>
                                <div className="flex flex-wrap gap-2">
                                  {contact.keywords.split(',').map((keyword, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-200 cursor-default"
                                    >
                                      {keyword.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Employees Tab Content */}
                        {activeInsightTab === 'employees' && (
                          <div className="animate-fade-in">
                            {contact.employees ? (
                              <div className="p-4 sm:p-6 bg-white rounded-lg border border-gray-200">
                                <div className="text-center">
                                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                  </div>
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Number of Employees</label>
                                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{contact.employees}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-gray-200">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                  </svg>
                                </div>
                                <p className="text-gray-500 text-xs sm:text-sm">No employees data available</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
