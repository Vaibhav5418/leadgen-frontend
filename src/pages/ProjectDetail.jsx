import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import ActivityLogModal from '../components/ActivityLogModal';
import BulkImportModal from '../components/BulkImportModal';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterTeamMember, setFilterTeamMember] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [expandedContacts, setExpandedContacts] = useState(new Set());
  const [contactActivities, setContactActivities] = useState({});
  const [loadingActivities, setLoadingActivities] = useState({});
  const [activityModal, setActivityModal] = useState({
    isOpen: false,
    type: null,
    contactName: '',
    companyName: '',
    projectId: null,
    phoneNumber: null,
    email: null,
    linkedInProfileUrl: null
  });
  const [bulkImportModal, setBulkImportModal] = useState(false);
  const [allProjectActivities, setAllProjectActivities] = useState([]);
  const [showDoneConfirmation, setShowDoneConfirmation] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchSimilarContacts();
      fetchAllProjectActivities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/projects/${id}`);
      if (response.data.success) {
        setProject(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarContacts = async () => {
    try {
      const response = await API.get(`/projects/${id}/similar-contacts`);
      if (response.data.success) {
        setContacts(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching similar contacts:', err);
    }
  };

  const fetchAllProjectActivities = async () => {
    try {
      const response = await API.get(`/activities/project/${id}`);
      if (response.data.success) {
        setAllProjectActivities(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching project activities:', err);
    }
  };

  const fetchActivitiesForContact = async (contactId, contactEmail, contactName) => {
    if (loadingActivities[contactId]) return;
    
    try {
      setLoadingActivities(prev => ({ ...prev, [contactId]: true }));
      // Fetch activities for the project, then filter by contact email/name if available
      const response = await API.get(`/activities/project/${id}`);
      if (response.data.success) {
        let activities = response.data.data || [];
        // Filter activities by contact email or name in conversation notes
        if (contactEmail || contactName) {
          const emailLower = contactEmail?.toLowerCase() || '';
          const nameLower = contactName?.toLowerCase() || '';
          activities = activities.filter(activity => {
            const notesLower = activity.conversationNotes?.toLowerCase() || '';
            return notesLower.includes(emailLower) || notesLower.includes(nameLower);
          });
        }
        setContactActivities(prev => ({
          ...prev,
          [contactId]: activities
        }));
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoadingActivities(prev => ({ ...prev, [contactId]: false }));
    }
  };

  const toggleContactExpansion = async (contactId, contactEmail, contactName) => {
    const isExpanded = expandedContacts.has(contactId);
    
    if (isExpanded) {
      setExpandedContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    } else {
      setExpandedContacts(prev => new Set(prev).add(contactId));
      await fetchActivitiesForContact(contactId, contactEmail, contactName);
    }
  };

  const handleOpenActivityModal = (type, contact) => {
    setActivityModal({
      isOpen: true,
      type,
      contactName: contact.name || 'N/A',
      companyName: contact.company || '',
      projectId: id,
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
      phoneNumber: null,
      email: null,
      linkedInProfileUrl: null
    });
    // Refresh all project activities
    fetchAllProjectActivities();
    // Refresh activities for expanded contacts
    expandedContacts.forEach(contactId => {
      const contact = contacts.find(c => (c._id || c.name) === contactId);
      if (contact) {
        fetchActivitiesForContact(contactId, contact.email, contact.name);
      }
    });
  };

  const handleMarkProjectDone = async () => {
    try {
      setMarkingDone(true);
      const response = await API.put(`/projects/${id}`, {
        status: 'completed'
      });

      if (response.data.success) {
        // Update local project state
        setProject(prev => prev ? { ...prev, status: 'completed' } : null);
        setShowDoneConfirmation(false);
        // Optionally show success message or navigate
        alert('Project marked as completed successfully!');
      } else {
        alert('Failed to mark project as done. Please try again.');
      }
    } catch (err) {
      console.error('Error marking project as done:', err);
      alert(err.response?.data?.error || 'Failed to mark project as done. Please try again.');
    } finally {
      setMarkingDone(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
      draft: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Draft' },
      completed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Completed' },
      archived: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Archived' }
    };
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getStageBadge = (stage) => {
    const stageConfig = {
      'Qualified': { bg: 'bg-green-100', text: 'text-green-800' },
      'Proposal': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'New': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'Negotiation': { bg: 'bg-orange-100', text: 'text-orange-800' },
      'Contacted': { bg: 'bg-purple-100', text: 'text-purple-800' }
    };
    const config = stageConfig[stage] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {stage || 'New'}
      </span>
    );
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

  // Activity Summary Component
  const ContactActivitySummary = ({ contact, activities }) => {
    const calculateStats = () => {
      const callsMade = activities.filter(a => a.type === 'call').length;
      const emailsSent = activities.filter(a => a.type === 'email').length;
      const linkedInMessages = activities.filter(a => a.type === 'linkedin').length;
      const totalInteractions = activities.length;

      const engagementScore = Math.min(100, Math.max(0, totalInteractions * 10 + (totalInteractions > 0 ? 30 : 0)));

      return {
        totalInteractions,
        callsMade,
        emailsSent,
        linkedInMessages,
        engagementScore
      };
    };

    const getActivityIcon = (type) => {
      switch (type) {
        case 'call':
          return (
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          );
        case 'email':
          return (
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          );
        case 'linkedin':
          return (
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
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

    const getOutcomeLabel = (outcome) => {
      const outcomeMap = {
        'connected-had-conversation': 'Connected',
        'left-voicemail': 'Left Voicemail',
        'no-answer': 'No Answer',
        'wrong-number': 'Wrong Number',
        'not-interested': 'Not Interested',
        'email-sent-successfully': 'Sent',
        'email-bounced': 'Bounced',
        'received-reply': 'Received Reply',
        'out-of-office-response': 'Out of Office',
        'connection-request-sent': 'Connection Request Sent',
        'message-sent': 'Message Sent',
        'connection-accepted': 'Connection Accepted'
      };
      return outcomeMap[outcome] || outcome;
    };

    const stats = calculateStats();

    return (
      <div className="py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Activity Summary Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-sm font-bold text-gray-900">Activity Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Calls Made</span>
                <span className="text-xs font-semibold text-gray-900">{stats.callsMade}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Emails Sent</span>
                <span className="text-xs font-semibold text-gray-900">{stats.emailsSent}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">LinkedIn Messages</span>
                <span className="text-xs font-semibold text-gray-900">{stats.linkedInMessages}</span>
              </div>
            </div>
          </div>

          {/* Engagement Score Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-bold text-gray-900">Engagement Score</h3>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.engagementScore}</div>
              <div className="text-xs text-gray-500">out of 100</div>
            </div>
          </div>
        </div>

        {/* Interaction Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Interaction Timeline</h3>
            <button
              onClick={() => handleOpenActivityModal('call', contact)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Activity
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No activities logged yet. Click "Log Activity" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {activities
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((activity) => (
                <div key={activity._id} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {getActivityTypeLabel(activity.type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap leading-relaxed">
                      {activity.conversationNotes}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded font-medium ${
                        activity.type === 'call' ? 'bg-blue-100 text-blue-700' :
                        activity.type === 'email' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {getOutcomeLabel(activity.outcome)}
                      </span>
                      <span>by {project?.assignedTo || 'User'}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-xs text-gray-500 text-right whitespace-nowrap">
                    {formatDateTime(activity.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Filter contacts based on search and filters
  const filteredContacts = contacts.filter(contact => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (contact.name && contact.name.toLowerCase().includes(query)) ||
        (contact.company && contact.company.toLowerCase().includes(query)) ||
        (contact.email && contact.email.toLowerCase().includes(query)) ||
        (contact.firstPhone && contact.firstPhone.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Stage filter
    if (filterStage) {
      const contactStage = contact.stage || 'New';
      if (contactStage !== filterStage) return false;
    }

    // Team member filter
    if (filterTeamMember) {
      const contactAssignedTo = contact.assignedTo || project?.assignedTo || '';
      if (contactAssignedTo !== filterTeamMember) return false;
    }

    // Priority filter
    if (filterPriority) {
      const contactPriority = contact.priority || 'Medium';
      if (contactPriority !== filterPriority) return false;
    }

    // Quick filters
    if (quickFilter === 'high-priority') {
      const contactPriority = contact.priority || 'Medium';
      if (contactPriority !== 'High') return false;
    } else if (quickFilter === 'due-today') {
      // Find activities with nextActionDate due today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const contactId = contact._id || contact.name;
      const contactActivities = allProjectActivities.filter(a => {
        const notesLower = a.conversationNotes?.toLowerCase() || '';
        const contactNameLower = contact.name?.toLowerCase() || '';
        const contactEmailLower = contact.email?.toLowerCase() || '';
        return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
      });
      
      const hasDueToday = contactActivities.some(activity => {
        if (!activity.nextActionDate) return false;
        const actionDate = new Date(activity.nextActionDate);
        actionDate.setHours(0, 0, 0, 0);
        return actionDate >= today && actionDate < tomorrow;
      });
      
      if (!hasDueToday) return false;
    } else if (quickFilter === 'new-prospects') {
      const contactStage = contact.stage || 'New';
      if (contactStage !== 'New') return false;
    }

    return true;
  });

  // Calculate stats based on all contacts (not filtered)
  const stats = {
    total: contacts.length,
    active: contacts.filter(c => {
      const stage = c.stage || 'New';
      return stage === 'Qualified' || stage === 'Proposal' || stage === 'Negotiation';
    }).length,
    overdue: (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return contacts.filter(contact => {
        const contactActivities = allProjectActivities.filter(a => {
          const notesLower = a.conversationNotes?.toLowerCase() || '';
          const contactNameLower = contact.name?.toLowerCase() || '';
          const contactEmailLower = contact.email?.toLowerCase() || '';
          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
        });
        return contactActivities.some(activity => {
          if (!activity.nextActionDate) return false;
          const actionDate = new Date(activity.nextActionDate);
          return actionDate < today;
        });
      }).length;
    })(),
    thisWeek: (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return contacts.filter(contact => {
        const contactActivities = allProjectActivities.filter(a => {
          const notesLower = a.conversationNotes?.toLowerCase() || '';
          const contactNameLower = contact.name?.toLowerCase() || '';
          const contactEmailLower = contact.email?.toLowerCase() || '';
          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
        });
        return contactActivities.some(activity => {
          if (!activity.nextActionDate) return false;
          const actionDate = new Date(activity.nextActionDate);
          return actionDate >= today && actionDate < weekEnd;
        });
      }).length;
    })()
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Project not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors mt-1"
            title="Back to Projects"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Prospect Management</h1>
            <p className="text-sm text-gray-600">Track and manage prospect interactions across the entire sales pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {project?.status !== 'completed' && (
            <button 
              onClick={() => setShowDoneConfirmation(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Done
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button 
            onClick={() => setBulkImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Bulk Import
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              +12%
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Prospects</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              +8%
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.active}</div>
          <div className="text-sm text-gray-600">Active Prospects</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l5-5m0 0l-5-5m5 5H6" />
              </svg>
              -5%
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.overdue}</div>
          <div className="text-sm text-gray-600">Overdue Follow-ups</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              +15%
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{stats.thisWeek}</div>
          <div className="text-sm text-gray-600">This Week Actions</div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
        </div>

        <div className="mb-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, company, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-xs font-medium text-gray-500">Quick Filters:</div>
          <button
            onClick={() => {
              const newFilter = quickFilter === 'high-priority' ? '' : 'high-priority';
              setQuickFilter(newFilter);
              // Clear other filters when quick filter is applied
              if (newFilter === 'high-priority') {
                setFilterPriority('High');
              } else {
                setFilterPriority('');
              }
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              quickFilter === 'high-priority'
                ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-gray-400'
            }`}
          >
            High Priority
          </button>
          <button
            onClick={() => {
              const newFilter = quickFilter === 'due-today' ? '' : 'due-today';
              setQuickFilter(newFilter);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              quickFilter === 'due-today'
                ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-gray-400'
            }`}
          >
            Due Today
          </button>
          <button
            onClick={() => {
              const newFilter = quickFilter === 'new-prospects' ? '' : 'new-prospects';
              setQuickFilter(newFilter);
              // Clear stage filter when new prospects is applied
              if (newFilter === 'new-prospects') {
                setFilterStage('New');
              } else if (quickFilter === 'new-prospects') {
                setFilterStage('');
              }
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              quickFilter === 'new-prospects'
                ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-gray-400'
            }`}
          >
            New Prospects
          </button>

          <div className="ml-auto flex items-center gap-3">
            <select
              value={filterStage}
              onChange={(e) => {
                setFilterStage(e.target.value);
                // Clear new-prospects quick filter if stage changes
                if (e.target.value !== 'New' && quickFilter === 'new-prospects') {
                  setQuickFilter('');
                }
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors cursor-pointer"
            >
              <option value="">Filter by stage</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal">Proposal</option>
              <option value="Negotiation">Negotiation</option>
            </select>
            <select
              value={filterTeamMember}
              onChange={(e) => setFilterTeamMember(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors cursor-pointer"
            >
              <option value="">Filter by team member</option>
              <option value="Sarah Johnson">Sarah Johnson</option>
              <option value="Michael Chen">Michael Chen</option>
              <option value="Emily Rodriguez">Emily Rodriguez</option>
              <option value="David Kim">David Kim</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                // Clear high-priority quick filter if priority changes
                if (e.target.value !== 'High' && quickFilter === 'high-priority') {
                  setQuickFilter('');
                } else if (e.target.value === 'High') {
                  setQuickFilter('high-priority');
                }
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors cursor-pointer"
            >
              <option value="">Filter by priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || quickFilter || filterStage || filterTeamMember || filterPriority) && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Search: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {quickFilter === 'high-priority' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                High Priority
                <button
                  onClick={() => {
                    setQuickFilter('');
                    setFilterPriority('');
                  }}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {quickFilter === 'due-today' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Due Today
                <button
                  onClick={() => setQuickFilter('')}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {quickFilter === 'new-prospects' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                New Prospects
                <button
                  onClick={() => {
                    setQuickFilter('');
                    setFilterStage('');
                  }}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filterStage && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Stage: {filterStage}
                <button
                  onClick={() => setFilterStage('')}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filterTeamMember && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Team: {filterTeamMember}
                <button
                  onClick={() => setFilterTeamMember('')}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filterPriority && !quickFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Priority: {filterPriority}
                <button
                  onClick={() => setFilterPriority('')}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setQuickFilter('');
                setFilterStage('');
                setFilterTeamMember('');
                setFilterPriority('');
              }}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{filteredContacts.length}</span> of <span className="font-semibold text-gray-900">{contacts.length}</span> prospects
          {(searchQuery || quickFilter || filterStage || filterTeamMember || filterPriority) && (
            <span className="ml-2 text-gray-500">
              (filtered)
            </span>
          )}
        </p>
      </div>

      {/* Prospects Table */}
      {filteredContacts.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      Contact
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      Stage
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Interaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.map((contact) => {
                  const contactId = contact._id || contact.name;
                  const isExpanded = expandedContacts.has(contactId);
                  const activities = contactActivities[contactId] || [];
                  const isLoadingActivities = loadingActivities[contactId];
                  
                  // Get last interaction for this contact (from project activities)
                  const contactLastActivity = allProjectActivities
                    .filter(a => a.conversationNotes?.toLowerCase().includes(contact.name?.toLowerCase() || '') || 
                                 a.conversationNotes?.toLowerCase().includes(contact.email?.toLowerCase() || ''))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                  
                  // Get next action from the most recent activity
                  const nextActionActivity = allProjectActivities
                    .filter(a => a.nextActionDate && new Date(a.nextActionDate) >= new Date())
                    .sort((a, b) => new Date(a.nextActionDate) - new Date(b.nextActionDate))[0];
                  
                  // Use stage and assignedTo from project contact if available, otherwise use defaults
                  const stage = contact.stage || 'New';
                  const assignedTo = contact.assignedTo || project?.assignedTo || '-';

                  // Check if contact is from databank (has _id - MongoDB ObjectId)
                  // Contacts from databank will have _id, imported contacts might have it too if they exist in DB
                  const contactIdValue = contact._id?.toString ? contact._id.toString() : contact._id;
                  const isFromDatabank = contactIdValue && (
                    (typeof contactIdValue === 'string' && contactIdValue.length === 24) ||
                    (typeof contact._id === 'object' && contact._id !== null)
                  );
                  
                  const handleContactRowClick = (e) => {
                    // Don't navigate if clicking on expand button, action buttons, or their children
                    if (
                      e.target.closest('button') ||
                      e.target.closest('svg') ||
                      e.target.closest('a')
                    ) {
                      return;
                    }
                    
                    // Only navigate if contact is from databank and has a valid ID
                    if (isFromDatabank && contactIdValue) {
                      // Pass return path so we can navigate back to this project detail page
                      navigate(`/contacts/${contactIdValue}?returnTo=/projects/${id}`);
                    }
                  };

                  return (
                    <React.Fragment key={contactId}>
                      <tr 
                        onClick={handleContactRowClick}
                        className={`transition-colors ${
                          isFromDatabank 
                            ? 'hover:bg-gray-50 cursor-pointer' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleContactExpansion(contactId, contact.email, contact.name);
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-all"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            <svg 
                              className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? '-rotate-90' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-white">
                                {getInitials(contact.name)}
                              </span>
                            </div>
                            <div>
                              <div className={`text-sm font-semibold ${isFromDatabank ? 'text-gray-900 hover:text-blue-600' : 'text-gray-900'}`}>
                                {contact.name || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">{contact.company || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {contact.email || 'N/A'}
                          </div>
                          {contact.firstPhone ? (
                            <div className="text-xs text-gray-500">{contact.firstPhone}</div>
                          ) : (
                            <div className="text-xs text-gray-400">-</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {getStageBadge(stage)}
                        </td>
                        <td className="px-6 py-4">
                          {contactLastActivity ? (
                            <>
                              <div className="text-sm text-gray-900">{formatDate(contactLastActivity.createdAt)}</div>
                              <div className="text-xs text-gray-500">
                                {contactLastActivity.type === 'call' ? 'Call' : 
                                 contactLastActivity.type === 'email' ? 'Email' : 
                                 contactLastActivity.type === 'linkedin' ? 'LinkedIn' : 'Activity'}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm text-gray-900">-</div>
                              <div className="text-xs text-gray-500">-</div>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {nextActionActivity ? (
                            <div className="flex items-center gap-2">
                              <svg className={`w-4 h-4 ${
                                new Date(nextActionActivity.nextActionDate) < new Date() ? 'text-red-600' :
                                new Date(nextActionActivity.nextActionDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'text-orange-500' :
                                'text-gray-400'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{nextActionActivity.nextAction}</div>
                                <div className={`text-xs font-medium ${
                                  new Date(nextActionActivity.nextActionDate) < new Date() ? 'text-red-600' :
                                  new Date(nextActionActivity.nextActionDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'text-orange-600' :
                                  'text-gray-400'
                                }`}>
                                  {formatDate(nextActionActivity.nextActionDate)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">-</div>
                                <div className="text-xs text-gray-400">-</div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {assignedTo || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActivityModal('call', contact);
                              }}
                              className="p-1.5 text-black hover:opacity-70 transition-opacity" 
                              title="Call"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActivityModal('email', contact);
                              }}
                              className="p-1.5 text-black hover:opacity-70 transition-opacity" 
                              title="Email"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActivityModal('linkedin', contact);
                              }}
                              className="p-1.5 text-black hover:opacity-70 transition-opacity" 
                              title="LinkedIn"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" className="px-6 py-4 bg-gray-50">
                            {isLoadingActivities ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              </div>
                            ) : (
                              <ContactActivitySummary contact={contact} activities={activities} />
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No prospects found</h2>
            <p className="text-sm text-gray-600">No similar contacts found for this project</p>
          </div>
        </div>
      )}

      {/* Activity Log Modal */}
      <ActivityLogModal
        isOpen={activityModal.isOpen}
        onClose={handleCloseActivityModal}
        type={activityModal.type}
        contactName={activityModal.contactName}
        companyName={activityModal.companyName}
        projectId={activityModal.projectId}
        phoneNumber={activityModal.phoneNumber}
        email={activityModal.email}
        linkedInProfileUrl={activityModal.linkedInProfileUrl}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={bulkImportModal}
        onClose={() => setBulkImportModal(false)}
        projectId={id}
        onImportSuccess={() => {
          fetchSimilarContacts();
          fetchAllProjectActivities();
        }}
      />

      {/* Done Confirmation Modal */}
      {showDoneConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Mark Project as Done?</h3>
                  <p className="text-sm text-gray-600 mt-1">Are you sure you want to mark this project as completed?</p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  This action will mark the project as completed. You can still view and edit the project later.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDoneConfirmation(false)}
                  disabled={markingDone}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkProjectDone}
                  disabled={markingDone}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {markingDone ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Marking...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Done
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
