import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api/axios';
import ActivityLogModal from '../components/ActivityLogModal';

export default function ContactActivityHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const returnTo = searchParams.get('returnTo') || '/projects';
  const [contact, setContact] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'call', 'email', 'linkedin'
  const [activityModal, setActivityModal] = useState({
    isOpen: false,
    type: null,
    contactName: '',
    companyName: '',
    projectId: null,
    contactId: null,
    phoneNumber: null,
    email: null,
    linkedInProfileUrl: null
  });

  useEffect(() => {
    if (id) {
      fetchContact();
      fetchActivities();
    }
  }, [id]);

  const fetchContact = async () => {
    try {
      const response = await API.get(`/contacts/${id}`);
      setContact(response.data?.data || response.data);
    } catch (err) {
      console.error('Error fetching contact:', err);
      setError('Failed to load contact details.');
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/activities/contact/${id}`);
      if (response.data.success) {
        setActivities(response.data.data || []);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Failed to load activity history.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenActivityModal = (type) => {
    if (!contact) return;
    setActivityModal({
      isOpen: true,
      type,
      contactName: contact.name || 'N/A',
      companyName: contact.company || '',
      projectId: projectId || null,
      contactId: id,
      phoneNumber: contact.firstPhone || null,
      email: contact.email || null,
      linkedInProfileUrl: contact.personLinkedinUrl || contact.companyLinkedinUrl || null
    });
  };

  const handleCloseActivityModal = () => {
    setActivityModal({
      isOpen: false,
      type: null,
      contactName: '',
      companyName: '',
      projectId: null,
      contactId: null,
      phoneNumber: null,
      email: null,
      linkedInProfileUrl: null
    });
    // Refresh activities after saving
    fetchActivities();
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'call':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
        );
      case 'email':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case 'linkedin':
        return (
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getActivityTypeLabel = (type) => {
    switch (type) {
      case 'call': return 'Call';
      case 'email': return 'Email';
      case 'linkedin': return 'LinkedIn';
      default: return 'Activity';
    }
  };

  // Filter activities based on active filter
  const filteredActivities = activities.filter(activity => {
    if (activeFilter === 'all') return true;
    return activity.type === activeFilter;
  });

  // Group activities by type for stats
  const callActivities = activities.filter(a => a.type === 'call');
  const emailActivities = activities.filter(a => a.type === 'email');
  const linkedInActivities = activities.filter(a => a.type === 'linkedin');

  const getOutcomeBadge = (outcome) => {
    const outcomeConfig = {
      'connected-had-conversation': { bg: 'bg-green-100', text: 'text-green-800', label: 'Connected' },
      'left-voicemail': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Voicemail' },
      'no-answer': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'No Answer' },
      'email-sent-successfully': { bg: 'bg-green-100', text: 'text-green-800', label: 'Sent' },
      'received-reply': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Reply Received' },
      'connection-request-sent': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Request Sent' },
      'message-sent': { bg: 'bg-green-100', text: 'text-green-800', label: 'Message Sent' }
    };
    const config = outcomeConfig[outcome] || { bg: 'bg-gray-100', text: 'text-gray-800', label: outcome };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gray-200 blur-xl animate-pulse"></div>
            <div className="relative animate-spin rounded-full h-14 w-14 border-2 border-gray-200 border-t-gray-900 mx-auto"></div>
          </div>
          <p className="tracking-wide text-sm uppercase text-gray-500 font-medium">Loading activity history...</p>
        </div>
      </div>
    );
  }

  if (error && !contact) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Contact</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate(returnTo)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Breadcrumb */}
          <nav className="mb-6 animate-fade-in-down">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <button
                onClick={() => navigate(returnTo)}
                className="hover:text-gray-900 transition-colors duration-200 flex items-center gap-1.5 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-700 font-semibold">Activity History</span>
            </div>
          </nav>

          {/* Contact Header */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 shadow-lg p-6 lg:p-8 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-8">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl lg:text-3xl font-bold text-white shadow-xl ring-4 ring-blue-50 transform hover:scale-105 transition-transform duration-200">
                  {contact ? getInitials(contact.name) : '?'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white shadow-md"></div>
              </div>

              {/* Name and Details */}
              <div className="flex-1 min-w-0 w-full lg:w-auto text-center lg:text-left">
                <div className="mb-3">
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
                    {contact?.name || 'Contact'}
                  </h1>
                  {contact?.company && (
                    <p className="text-gray-600 text-lg lg:text-xl font-medium">
                      {contact.company}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-center justify-center lg:justify-start gap-4 text-gray-600 text-sm">
                  {contact?.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors duration-200 border border-gray-200 hover:border-blue-200 group"
                    >
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">{contact.email}</span>
                    </a>
                  )}
                  {contact?.firstPhone && (
                    <a
                      href={`tel:${contact.firstPhone}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-green-50 rounded-lg transition-colors duration-200 border border-gray-200 hover:border-green-200 group"
                    >
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="font-medium">{contact.firstPhone}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <button
                  onClick={() => handleOpenActivityModal('call')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold text-sm rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-100 w-full sm:w-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Log Call</span>
                </button>
                <button
                  onClick={() => handleOpenActivityModal('email')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-100 w-full sm:w-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Log Email</span>
                </button>
                <button
                  onClick={() => handleOpenActivityModal('linkedin')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-semibold text-sm rounded-xl hover:from-blue-800 hover:to-indigo-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-100 w-full sm:w-auto"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  <span>Log LinkedIn</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity History Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-5 py-4 rounded-xl shadow-md animate-shake">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {activities.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <div 
              onClick={() => setActiveFilter('all')}
              className={`bg-gradient-to-br rounded-2xl border shadow-lg p-6 hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-105 ${
                activeFilter === 'all' 
                  ? 'from-blue-500 to-blue-600 border-blue-400 text-white' 
                  : 'from-white to-blue-50 border-blue-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-wide mb-1 ${
                    activeFilter === 'all' ? 'text-blue-100' : 'text-gray-600'
                  }`}>Total Activities</p>
                  <p className={`text-3xl font-bold ${
                    activeFilter === 'all' ? 'text-white' : 'text-gray-900'
                  }`}>{activities.length}</p>
                  <p className={`text-xs mt-1 ${
                    activeFilter === 'all' ? 'text-blue-100' : 'text-gray-500'
                  }`}>All interactions</p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                  activeFilter === 'all' 
                    ? 'bg-white bg-opacity-20' 
                    : 'bg-gradient-to-br from-blue-500 to-blue-600'
                }`}>
                  <svg className={`w-7 h-7 ${activeFilter === 'all' ? 'text-white' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>
            <div 
              onClick={() => setActiveFilter('call')}
              className={`bg-gradient-to-br rounded-2xl border shadow-lg p-6 hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-105 ${
                activeFilter === 'call' 
                  ? 'from-green-500 to-green-600 border-green-400 text-white' 
                  : 'from-white to-green-50 border-green-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-wide mb-1 ${
                    activeFilter === 'call' ? 'text-green-100' : 'text-gray-600'
                  }`}>Calls</p>
                  <p className={`text-3xl font-bold ${
                    activeFilter === 'call' ? 'text-white' : 'text-gray-900'
                  }`}>{callActivities.length}</p>
                  <p className={`text-xs mt-1 ${
                    activeFilter === 'call' ? 'text-green-100' : 'text-gray-500'
                  }`}>Phone interactions</p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                  activeFilter === 'call' 
                    ? 'bg-white bg-opacity-20' 
                    : 'bg-gradient-to-br from-green-500 to-green-600'
                }`}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
              </div>
            </div>
            <div 
              onClick={() => setActiveFilter('email')}
              className={`bg-gradient-to-br rounded-2xl border shadow-lg p-6 hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-105 ${
                activeFilter === 'email' 
                  ? 'from-blue-500 to-blue-600 border-blue-400 text-white' 
                  : 'from-white to-blue-50 border-blue-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-wide mb-1 ${
                    activeFilter === 'email' ? 'text-blue-100' : 'text-gray-600'
                  }`}>Emails</p>
                  <p className={`text-3xl font-bold ${
                    activeFilter === 'email' ? 'text-white' : 'text-gray-900'
                  }`}>{emailActivities.length}</p>
                  <p className={`text-xs mt-1 ${
                    activeFilter === 'email' ? 'text-blue-100' : 'text-gray-500'
                  }`}>Email outreach</p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                  activeFilter === 'email' 
                    ? 'bg-white bg-opacity-20' 
                    : 'bg-gradient-to-br from-blue-500 to-blue-600'
                }`}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div 
              onClick={() => setActiveFilter('linkedin')}
              className={`bg-gradient-to-br rounded-2xl border shadow-lg p-6 hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-105 ${
                activeFilter === 'linkedin' 
                  ? 'from-indigo-500 to-indigo-600 border-indigo-400 text-white' 
                  : 'from-white to-indigo-50 border-indigo-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-wide mb-1 ${
                    activeFilter === 'linkedin' ? 'text-indigo-100' : 'text-gray-600'
                  }`}>LinkedIn</p>
                  <p className={`text-3xl font-bold ${
                    activeFilter === 'linkedin' ? 'text-white' : 'text-gray-900'
                  }`}>{linkedInActivities.length}</p>
                  <p className={`text-xs mt-1 ${
                    activeFilter === 'linkedin' ? 'text-indigo-100' : 'text-gray-500'
                  }`}>LinkedIn activities</p>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                  activeFilter === 'linkedin' 
                    ? 'bg-white bg-opacity-20' 
                    : 'bg-gradient-to-br from-indigo-500 to-indigo-600'
                }`}>
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </div>
              </div>
            </div>
            {/* Current Status */}
            {(() => {
              const linkedInActivities = activities.filter(a => a.type === 'linkedin' && a.status);
              const latestStatus = linkedInActivities.length > 0 
                ? linkedInActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].status
                : null;
              
              if (!latestStatus) return null;
              
              const getStatusCardClass = (status) => {
                switch(status) {
                  case 'CIP': return 'from-white to-blue-50 border-blue-200';
                  case 'No Reply': return 'from-white to-gray-50 border-gray-200';
                  case 'Not Interested': return 'from-white to-red-50 border-red-200';
                  case 'Meeting Proposed': return 'from-white to-yellow-50 border-yellow-200';
                  case 'Meeting Scheduled': return 'from-white to-cyan-50 border-cyan-200';
                  case 'In-Person Meeting': return 'from-white to-indigo-50 border-indigo-200';
                  case 'Meeting Completed': return 'from-white to-green-50 border-green-200';
                  case 'SQL': return 'from-white to-emerald-50 border-emerald-200';
                  case 'Tech Discussion': return 'from-white to-purple-50 border-purple-200';
                  case 'WON': return 'from-white to-green-100 border-green-400 border-2';
                  case 'Lost': return 'from-white to-red-100 border-red-400 border-2';
                  case 'Low Potential - Open': return 'from-white to-orange-50 border-orange-200';
                  case 'Potential Future': return 'from-white to-teal-50 border-teal-200';
                  default: return 'from-white to-gray-50 border-gray-200';
                }
              };
              
              const getStatusTextClass = (status) => {
                switch(status) {
                  case 'CIP': return 'text-blue-800';
                  case 'No Reply': return 'text-gray-800';
                  case 'Not Interested': return 'text-red-800';
                  case 'Meeting Proposed': return 'text-yellow-800';
                  case 'Meeting Scheduled': return 'text-cyan-800';
                  case 'In-Person Meeting': return 'text-indigo-800';
                  case 'Meeting Completed': return 'text-green-800';
                  case 'SQL': return 'text-emerald-800';
                  case 'Tech Discussion': return 'text-purple-800';
                  case 'WON': return 'text-green-900';
                  case 'Lost': return 'text-red-900';
                  case 'Low Potential - Open': return 'text-orange-800';
                  case 'Potential Future': return 'text-teal-800';
                  default: return 'text-gray-800';
                }
              };
              
              const getStatusIconBg = (status) => {
                switch(status) {
                  case 'CIP': return 'bg-blue-100 border-blue-200';
                  case 'No Reply': return 'bg-gray-100 border-gray-200';
                  case 'Not Interested': return 'bg-red-100 border-red-200';
                  case 'Meeting Proposed': return 'bg-yellow-100 border-yellow-200';
                  case 'Meeting Scheduled': return 'bg-cyan-100 border-cyan-200';
                  case 'In-Person Meeting': return 'bg-indigo-100 border-indigo-200';
                  case 'Meeting Completed': return 'bg-green-100 border-green-200';
                  case 'SQL': return 'bg-emerald-100 border-emerald-200';
                  case 'Tech Discussion': return 'bg-purple-100 border-purple-200';
                  case 'WON': return 'bg-green-200 border-green-400 border-2';
                  case 'Lost': return 'bg-red-200 border-red-400 border-2';
                  case 'Low Potential - Open': return 'bg-orange-100 border-orange-200';
                  case 'Potential Future': return 'bg-teal-100 border-teal-200';
                  default: return 'bg-gray-100 border-gray-200';
                }
              };
              
              return (
                <div className={`bg-gradient-to-br ${getStatusCardClass(latestStatus)} rounded-2xl border shadow-lg p-6 hover:shadow-xl transition-shadow duration-200`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold uppercase tracking-wide mb-1">Current Status</p>
                      <p className={`text-2xl font-bold ${getStatusTextClass(latestStatus)} mb-1`}>{latestStatus}</p>
                      <p className="text-xs text-gray-500 mt-1">Latest LinkedIn activity</p>
                    </div>
                    <div className={`w-14 h-14 ${getStatusIconBg(latestStatus)} rounded-xl flex items-center justify-center shadow-lg`}>
                      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Activity Type Filter Tabs */}
        {activities.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 shadow-lg p-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                  activeFilter === 'all'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                All ({activities.length})
              </button>
              <button
                onClick={() => setActiveFilter('call')}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                  activeFilter === 'call'
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg transform scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Calls ({callActivities.length})
              </button>
              <button
                onClick={() => setActiveFilter('email')}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                  activeFilter === 'email'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Emails ({emailActivities.length})
              </button>
              <button
                onClick={() => setActiveFilter('linkedin')}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                  activeFilter === 'linkedin'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg transform scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn ({linkedInActivities.length})
              </button>
            </div>
          </div>
        )}

        {/* Activities List */}
        {activities.length === 0 ? (
          <div className="text-center py-20 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 mb-6 shadow-inner">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No activities yet</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
              Start logging activities to track your interactions with this contact and build a comprehensive engagement history.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleOpenActivityModal('call')}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Log First Activity
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 lg:px-8 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Activity Timeline</h2>
                  <p className="text-sm text-gray-500 mt-1">Complete interaction history with {contact?.name}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-blue-700">{activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No {activeFilter === 'all' ? '' : activeFilter} activities found</h3>
                  <p className="text-gray-600 mb-6">Try selecting a different filter or log a new activity.</p>
                  <button
                    onClick={() => {
                      const typeMap = { call: 'call', email: 'email', linkedin: 'linkedin' };
                      handleOpenActivityModal(typeMap[activeFilter] || 'call');
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Log {activeFilter === 'all' ? 'Activity' : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
                  </button>
                </div>
              ) : (
                filteredActivities.map((activity, index) => (
                <div key={activity._id || index} className="p-6 lg:p-8 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 group">
                  <div className="flex gap-5 lg:gap-6">
                    {/* Icon with Timeline */}
                    <div className="flex-shrink-0 relative">
                      {getActivityIcon(activity.type)}
                      {index < activities.length - 1 && (
                        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-gray-200 to-transparent"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900">
                              {getActivityTypeLabel(activity.type)}
                            </h3>
                            {getOutcomeBadge(activity.outcome)}
                            {activity.status && activity.type === 'linkedin' && (
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                activity.status === 'CIP' ? 'bg-blue-100 text-blue-800' :
                                activity.status === 'No Reply' ? 'bg-gray-100 text-gray-800' :
                                activity.status === 'Not Interested' ? 'bg-red-100 text-red-800' :
                                activity.status === 'Meeting Proposed' ? 'bg-yellow-100 text-yellow-800' :
                                activity.status === 'Meeting Scheduled' ? 'bg-cyan-100 text-cyan-800' :
                                activity.status === 'In-Person Meeting' ? 'bg-indigo-100 text-indigo-800' :
                                activity.status === 'Meeting Completed' ? 'bg-green-100 text-green-800' :
                                activity.status === 'SQL' ? 'bg-emerald-100 text-emerald-800' :
                                activity.status === 'Tech Discussion' ? 'bg-purple-100 text-purple-800' :
                                activity.status === 'WON' ? 'bg-green-200 text-green-900 border-2 border-green-400' :
                                activity.status === 'Lost' ? 'bg-red-200 text-red-900 border-2 border-red-400' :
                                activity.status === 'Low Potential - Open' ? 'bg-orange-100 text-orange-800' :
                                activity.status === 'Potential Future' ? 'bg-teal-100 text-teal-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {activity.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-medium">{formatDateTime(activity.createdAt)}</span>
                            </div>
                            {activity.projectId?.companyName && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                                  {activity.projectId.companyName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Call Number, Date and Status (Only for Call activities) */}
                      {activity.type === 'call' && (activity.callNumber || activity.callDate || activity.callStatus) && (
                        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm">
                          <div className="flex flex-wrap gap-4">
                            {activity.callNumber && (
                              <div className="flex-1 min-w-[120px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Call</p>
                                </div>
                                <p className="text-sm font-medium text-green-800">
                                  {activity.callNumber}
                                </p>
                              </div>
                            )}
                            {activity.callDate && (
                              <div className="flex-1 min-w-[120px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Call Date</p>
                                </div>
                                <p className="text-sm font-medium text-green-800">
                                  {new Date(activity.callDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </p>
                              </div>
                            )}
                            {activity.callStatus && (
                              <div className="flex-1 min-w-[120px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Status</p>
                                </div>
                                <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                                  activity.callStatus === 'Interested' ? 'bg-green-100 text-green-800' :
                                  activity.callStatus === 'Not Interested' ? 'bg-red-100 text-red-800' :
                                  activity.callStatus === 'Ring' ? 'bg-gray-100 text-gray-800' :
                                  activity.callStatus === 'Busy' ? 'bg-blue-100 text-blue-800' :
                                  activity.callStatus === 'Call Back' ? 'bg-purple-100 text-purple-800' :
                                  activity.callStatus === 'Hang Up' ? 'bg-pink-100 text-pink-800' :
                                  activity.callStatus === 'Switch Off' ? 'bg-amber-100 text-amber-800' :
                                  activity.callStatus === 'Future' ? 'bg-indigo-100 text-indigo-800' :
                                  activity.callStatus === 'Details Shared' ? 'bg-yellow-100 text-yellow-800' :
                                  activity.callStatus === 'Demo Booked' ? 'bg-cyan-100 text-cyan-800' :
                                  activity.callStatus === 'Invalid' ? 'bg-gray-100 text-gray-800' :
                                  activity.callStatus === 'Existing' ? 'bg-orange-100 text-orange-800' :
                                  activity.callStatus === 'Demo Completed' ? 'bg-gray-100 text-gray-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {activity.callStatus}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* LinkedIn Account Name (Only for LinkedIn activities) */}
                      {activity.type === 'linkedin' && activity.linkedInAccountName && (
                        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                            </svg>
                            <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">LinkedIn Account Used</p>
                          </div>
                          <p className="text-sm font-medium text-blue-800">
                            {activity.linkedInAccountName}
                          </p>
                        </div>
                      )}

                      {/* Ln Request Sent and Connected (Only for LinkedIn activities) */}
                      {activity.type === 'linkedin' && (activity.lnRequestSent || activity.connected) && (
                        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {activity.lnRequestSent && (
                            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs font-semibold text-purple-900 uppercase tracking-wide">Ln Request Sent</p>
                              </div>
                              <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                                activity.lnRequestSent === 'Yes' ? 'bg-green-100 text-green-800' :
                                activity.lnRequestSent === 'No' ? 'bg-red-100 text-red-800' :
                                activity.lnRequestSent === 'Existing Connect' ? 'bg-blue-100 text-blue-800' :
                                activity.lnRequestSent === 'Inactive Profile' ? 'bg-gray-100 text-gray-800' :
                                activity.lnRequestSent === 'Irrelevant Profile' ? 'bg-orange-100 text-orange-800' :
                                activity.lnRequestSent === 'Open to Work' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {activity.lnRequestSent}
                              </span>
                            </div>
                          )}
                          {activity.connected && (
                            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Connected</p>
                              </div>
                              <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                                activity.connected === 'Yes' ? 'bg-green-100 text-green-800' :
                                activity.connected === 'No' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {activity.connected}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Conversation Notes */}
                      <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {activity.conversationNotes}
                        </p>
                      </div>

                      {/* Next Action */}
                      {activity.nextAction && (
                        <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900 mb-1">
                              Next Action: <span className="font-bold">{activity.nextAction}</span>
                            </p>
                            {activity.nextActionDate && (
                              <p className="text-xs text-blue-700 font-medium">
                                Scheduled for {formatDate(activity.nextActionDate)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity Log Modal */}
      <ActivityLogModal
        isOpen={activityModal.isOpen}
        onClose={handleCloseActivityModal}
        type={activityModal.type}
        contactName={activityModal.contactName}
        companyName={activityModal.companyName}
        projectId={activityModal.projectId}
        contactId={activityModal.contactId}
        phoneNumber={activityModal.phoneNumber}
        email={activityModal.email}
        linkedInProfileUrl={activityModal.linkedInProfileUrl}
      />
    </div>
  );
}

