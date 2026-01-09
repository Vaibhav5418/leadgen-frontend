import React, { useState, useEffect, useMemo, useCallback, startTransition } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import ActivityLogModal from '../components/ActivityLogModal';
import BulkImportModal from '../components/BulkImportModal';
import BulkActivityLogModal from '../components/BulkActivityLogModal';

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
  const [filterMatchType, setFilterMatchType] = useState('');
  const [matchStats, setMatchStats] = useState(null);
  const [expandedContacts, setExpandedContacts] = useState(new Set());
  const [contactActivities, setContactActivities] = useState({});
  const [loadingActivities, setLoadingActivities] = useState({});
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
  const [bulkImportModal, setBulkImportModal] = useState(false);
  const [allProjectActivities, setAllProjectActivities] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [showProspectSuggestions, setShowProspectSuggestions] = useState(false);
  const [bulkActivityModal, setBulkActivityModal] = useState({
    isOpen: false,
    type: null
  });
  const [editingContactInfo, setEditingContactInfo] = useState({});
  const [savingContactInfo, setSavingContactInfo] = useState({});
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (id) {
      // Fetch project first, then contacts and activities in parallel
      fetchProject().then(() => {
        // Only fetch imported contacts initially (not suggestions)
        // Fetch activities
        fetchAllProjectActivities().catch(err => {
          console.error('Error fetching activities:', err);
        });
        // Fetch only imported contacts (not suggestions from databank)
        fetchImportedContacts().catch(err => {
          console.error('Error fetching imported contacts:', err);
        });
      });
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

  // Fetch only imported contacts (contacts already linked to project)
  const fetchImportedContacts = async () => {
    try {
      const response = await API.get(`/projects/${id}/project-contacts`);
      if (response.data.success) {
        setContacts(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching imported contacts:', err);
    }
  };

  // Fetch similar contacts from databank (including suggestions)
  const fetchSimilarContacts = async () => {
    try {
      const response = await API.get(`/projects/${id}/similar-contacts`);
      if (response.data.success) {
        setContacts(response.data.data || []);
        if (response.data.matchStats) {
          setMatchStats(response.data.matchStats);
        }
      }
    } catch (err) {
      console.error('Error fetching similar contacts:', err);
    }
  };

  // Toggle prospect suggestions
  const handleToggleProspectSuggestions = async () => {
    const newState = !showProspectSuggestions;
    setShowProspectSuggestions(newState);
    
    if (newState) {
      // Fetch suggestions from databank
      await fetchSimilarContacts();
    } else {
      // Show only imported contacts
      await fetchImportedContacts();
    }
  };

  const fetchAllProjectActivities = async () => {
    try {
      const response = await API.get(`/activities/project/${id}?limit=1000`); // Limit activities
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
    const contactIdValue = contact._id?.toString ? contact._id.toString() : contact._id;
    setActivityModal({
      isOpen: true,
      type,
      contactName: contact.name || 'N/A',
      companyName: contact.company || '',
      projectId: id,
      contactId: contactIdValue || null,
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
    // Refresh all project activities (this will update the stage display automatically)
    fetchAllProjectActivities();
    // Refresh contacts to get updated stage from ProjectContact
    if (showProspectSuggestions) {
      fetchSimilarContacts();
    } else {
      fetchImportedContacts();
    }
    // Refresh activities for expanded contacts
    expandedContacts.forEach(contactId => {
      const contact = contacts.find(c => (c._id || c.name) === contactId);
      if (contact) {
        fetchActivitiesForContact(contactId, contact.email, contact.name);
      }
    });
  };

  const handleCloseBulkActivityModal = () => {
    setBulkActivityModal({
      isOpen: false,
      type: null
    });
    // Clear selection after bulk logging
    setSelectedContacts(new Set());
    // Refresh all project activities (this will update the stage display automatically)
    fetchAllProjectActivities();
    // Refresh contacts to get updated stage from ProjectContact
    if (showProspectSuggestions) {
      fetchSimilarContacts();
    } else {
      fetchImportedContacts();
    }
    // Refresh activities for expanded contacts
    expandedContacts.forEach(contactId => {
      const contact = contacts.find(c => (c._id || c.name) === contactId);
      if (contact) {
        fetchActivitiesForContact(contactId, contact.email, contact.name);
      }
    });
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
      'CIP': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'No Reply': { bg: 'bg-gray-100', text: 'text-gray-800' },
      'Not Interested': { bg: 'bg-red-100', text: 'text-red-800' },
      'Meeting Proposed': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'Meeting Scheduled': { bg: 'bg-cyan-100', text: 'text-cyan-800' },
      'In-Person Meeting': { bg: 'bg-indigo-100', text: 'text-indigo-800' },
      'Meeting Completed': { bg: 'bg-green-100', text: 'text-green-800' },
      'SQL': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
      'Tech Discussion': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'WON': { bg: 'bg-green-200', text: 'text-green-900', border: 'border-2 border-green-400' },
      'Lost': { bg: 'bg-red-200', text: 'text-red-900', border: 'border-2 border-red-400' },
      'Low Potential - Open': { bg: 'bg-orange-100', text: 'text-orange-800' },
      'Potential Future': { bg: 'bg-teal-100', text: 'text-teal-800' },
      // Legacy stages for backward compatibility
      'New': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'Contacted': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'Qualified': { bg: 'bg-green-100', text: 'text-green-800' },
      'Proposal': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'Negotiation': { bg: 'bg-orange-100', text: 'text-orange-800' }
    };
    const config = stageConfig[stage] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text} ${config.border || ''}`}>
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

  // Pre-compute activity lookups for better performance
  const activityLookups = useMemo(() => {
    const lookups = {
      byContactId: new Map(),
      lastActivityByContactId: new Map(),
      nextActionByContactId: new Map(),
      latestLinkedInStatusByContactId: new Map()
    };
    
    const now = new Date();
    allProjectActivities.forEach(activity => {
      // Index by contactId
      if (activity.contactId) {
        const contactIdStr = activity.contactId.toString();
        if (!lookups.byContactId.has(contactIdStr)) {
          lookups.byContactId.set(contactIdStr, []);
        }
        lookups.byContactId.get(contactIdStr).push(activity);
        
        // Track last activity
        const existing = lookups.lastActivityByContactId.get(contactIdStr);
        if (!existing || new Date(activity.createdAt) > new Date(existing.createdAt)) {
          lookups.lastActivityByContactId.set(contactIdStr, activity);
        }
        
        // Track next action
        if (activity.nextActionDate && new Date(activity.nextActionDate) >= now) {
          const existing = lookups.nextActionByContactId.get(contactIdStr);
          if (!existing || new Date(activity.nextActionDate) < new Date(existing.nextActionDate)) {
            lookups.nextActionByContactId.set(contactIdStr, activity);
          }
        }
        
        // Track latest LinkedIn activity status (for automatic stage display)
        if (activity.type === 'linkedin' && activity.status) {
          const existing = lookups.latestLinkedInStatusByContactId.get(contactIdStr);
          if (!existing || new Date(activity.createdAt) > new Date(existing.createdAt)) {
            lookups.latestLinkedInStatusByContactId.set(contactIdStr, activity.status);
          }
        }
      }
    });
    
    return lookups;
  }, [allProjectActivities]);

  // Memoize filtered contacts to avoid recalculating on every render
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
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

    // Stage filter - check both LinkedIn status and contact.stage
    if (filterStage) {
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      const latestLinkedInStatus = contactIdStr ? activityLookups.latestLinkedInStatusByContactId.get(contactIdStr) : null;
      const contactStage = latestLinkedInStatus || contact.stage || 'New';
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
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      const latestLinkedInStatus = contactIdStr ? activityLookups.latestLinkedInStatusByContactId.get(contactIdStr) : null;
      const contactStage = latestLinkedInStatus || contact.stage || 'New';
      if (contactStage !== 'New') return false;
    }

      return true;
    });
  }, [contacts, searchQuery, quickFilter, filterStage, filterTeamMember, filterPriority, filterMatchType, allProjectActivities, project]);

  // Memoize select all checked state
  const isAllSelected = useMemo(() => {
    if (filteredContacts.length === 0) return false;
    return filteredContacts.every(c => selectedContacts.has((c._id || c.name).toString()));
  }, [filteredContacts, selectedContacts]);

  // Optimized select all handler - uses functional update to avoid closure issues
  const handleSelectAll = useCallback((e) => {
    const shouldSelect = e.target.checked;
    startTransition(() => {
      setSelectedContacts(prev => {
        const newSet = new Set(prev);
        // Get current filtered contact IDs once
        filteredContacts.forEach(c => {
          const contactId = (c._id || c.name).toString();
          if (shouldSelect) {
            newSet.add(contactId);
          } else {
            newSet.delete(contactId);
          }
        });
        return newSet;
      });
    });
  }, [filteredContacts]);

  // Optimized individual checkbox handler
  const handleContactSelect = useCallback((contactId, checked) => {
    startTransition(() => {
      setSelectedContacts(prev => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(contactId.toString());
        } else {
          newSet.delete(contactId.toString());
        }
        return newSet;
      });
    });
  }, []);

  // Optimized clear selection handler
  const handleClearSelection = useCallback(() => {
    startTransition(() => {
      setSelectedContacts(new Set());
    });
  }, []);

  // Handle remove prospects
  const handleRemoveProspects = async () => {
    if (selectedContacts.size === 0) return;

    setRemoving(true);
    try {
      const contactIdsArray = Array.from(selectedContacts);
      const response = await API.delete(`/projects/${id}/project-contacts`, {
        data: { contactIds: contactIdsArray }
      });

      if (response.data.success) {
        // Clear selection
        setSelectedContacts(new Set());
        setShowRemoveConfirmation(false);
        
        // Refresh contacts list
        if (showProspectSuggestions) {
          await fetchSimilarContacts();
        } else {
          await fetchImportedContacts();
        }
        
        // Show success message (you can add a toast notification here if needed)
        console.log(`Successfully removed ${response.data.data.deletedCount} prospect(s)`);
      }
    } catch (err) {
      console.error('Error removing prospects:', err);
      alert(err.response?.data?.error || 'Failed to remove prospects');
    } finally {
      setRemoving(false);
    }
  };

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
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button 
            onClick={handleToggleProspectSuggestions}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
              showProspectSuggestions
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Prospect Suggestion
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
              <option value="">Filter by status</option>
              <option value="CIP">CIP</option>
              <option value="No Reply">No Reply</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Meeting Proposed">Meeting Proposed</option>
              <option value="Meeting Scheduled">Meeting Scheduled</option>
              <option value="In-Person Meeting">In-Person Meeting</option>
              <option value="Meeting Completed">Meeting Completed</option>
              <option value="SQL">SQL</option>
              <option value="Tech Discussion">Tech Discussion</option>
              <option value="WON">WON</option>
              <option value="Lost">Lost</option>
              <option value="Low Potential - Open">Low Potential - Open</option>
              <option value="Potential Future">Potential Future</option>
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
            {filterMatchType && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Match: {filterMatchType === 'exact' ? 'Exact' : filterMatchType === 'good' ? 'Good' : filterMatchType === 'similar' ? 'Similar' : filterMatchType === 'loose' ? 'Loose' : 'Imported'}
                <button
                  onClick={() => setFilterMatchType('')}
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
                setFilterMatchType('');
              }}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results Count and Match Stats */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredContacts.length}</span> of <span className="font-semibold text-gray-900">{contacts.length}</span> prospects
            {(searchQuery || quickFilter || filterStage || filterTeamMember || filterPriority || filterMatchType) && (
              <span className="ml-2 text-gray-500">
                (filtered)
              </span>
            )}
          </p>
          {matchStats && (
            <div className="flex items-center gap-2 flex-wrap">
              {matchStats.imported > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-md border border-purple-200">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  {matchStats.imported} Imported
                </span>
              )}
              {matchStats.exact > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-md border border-green-200">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {matchStats.exact} Exact
                </span>
              )}
              {matchStats.good > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md border border-blue-200">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  {matchStats.good} Good
                </span>
              )}
              {matchStats.similar > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-md border border-yellow-200">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  {matchStats.similar} Similar
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar - Shows when prospects are selected */}
      {selectedContacts.size > 0 && (
        <div className="mb-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-5 shadow-xl animate-slide-down backdrop-blur-sm relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-pulse"></div>
          </div>
          
          {/* Content */}
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            {/* Left Section - Selection Info */}
            <div className="flex items-center gap-4">
              {/* Animated Badge */}
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300 ring-4 ring-blue-200 ring-opacity-50 animate-bounce-subtle">
                  <span className="text-white font-bold text-lg">{selectedContacts.size}</span>
                </div>
                {/* Pulse effect */}
                <div className="absolute inset-0 bg-blue-600 rounded-2xl animate-ping opacity-20"></div>
              </div>
              
              {/* Text Content */}
              <div className="flex flex-col">
                <p className="text-base font-bold text-gray-900 tracking-tight">
                  {selectedContacts.size} {selectedContacts.size === 1 ? 'prospect' : 'prospects'} selected
                </p>
                <p className="text-xs text-gray-600 font-medium mt-0.5">
                  Choose an activity type to log for all selected prospects
                </p>
              </div>
            </div>

            {/* Right Section - Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Log Call Button */}
              <button
                onClick={() => setBulkActivityModal({ isOpen: true, type: 'call' })}
                className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white text-sm font-bold rounded-xl hover:from-green-600 hover:via-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 overflow-hidden"
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shimmer"></div>
                <svg className="w-5 h-5 relative z-10 transform group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="relative z-10">Log Call</span>
              </button>

              {/* Log Email Button */}
              <button
                onClick={() => setBulkActivityModal({ isOpen: true, type: 'email' })}
                className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-600 text-white text-sm font-bold rounded-xl hover:from-blue-600 hover:via-blue-700 hover:to-cyan-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 overflow-hidden"
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shimmer"></div>
                <svg className="w-5 h-5 relative z-10 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="relative z-10">Log Email</span>
              </button>

              {/* Log LinkedIn Button */}
              <button
                onClick={() => setBulkActivityModal({ isOpen: true, type: 'linkedin' })}
                className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white text-sm font-bold rounded-xl hover:from-blue-800 hover:via-indigo-800 hover:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 overflow-hidden"
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shimmer"></div>
                <svg className="w-5 h-5 relative z-10 transform group-hover:scale-110 transition-transform duration-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                <span className="relative z-10">Log LinkedIn</span>
              </button>

              {/* Remove Button */}
              <button
                onClick={() => setShowRemoveConfirmation(true)}
                className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 via-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:from-red-600 hover:via-red-700 hover:to-rose-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 overflow-hidden"
              >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shimmer"></div>
                <svg className="w-5 h-5 relative z-10 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="relative z-10">Remove</span>
              </button>

              {/* Clear Button */}
              <button
                onClick={handleClearSelection}
                className="group relative inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 transform animate-fade-in-up">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Remove Prospects?</h3>
                <p className="text-sm text-gray-600 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to remove <span className="font-bold text-gray-900">{selectedContacts.size}</span> {selectedContacts.size === 1 ? 'prospect' : 'prospects'} from this project? They will be removed from the project but will remain in the databank.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRemoveConfirmation(false)}
                disabled={removing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveProspects}
                disabled={removing}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {removing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Removing...
                  </>
                ) : (
                  'Remove'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prospects Table */}
      {filteredContacts.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                    {/* Expand button column */}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[20%]">
                    <div className="flex items-center gap-2">
                      Contact
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[18%]">
                    Contact Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[12%]">
                    <div className="flex items-center gap-2">
                      Stage
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[15%]">
                    Last Interaction
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[18%]">
                    Next Action
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[13%]">
                    Assigned To
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[12%]">
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
                  
                  // Get contact ID for filtering
                  const contactIdValue = contact._id?.toString ? contact._id.toString() : contact._id;
                  
                  // Get last interaction and next action using pre-computed lookups (much faster)
                  let contactLastActivity = null;
                  let nextActionActivity = null;
                  let latestLinkedInStatus = null;
                  
                  if (contactIdValue) {
                    // Fast lookup by contactId
                    contactLastActivity = activityLookups.lastActivityByContactId.get(contactIdValue.toString()) || null;
                    nextActionActivity = activityLookups.nextActionByContactId.get(contactIdValue.toString()) || null;
                    latestLinkedInStatus = activityLookups.latestLinkedInStatusByContactId.get(contactIdValue.toString()) || null;
                  }
                  
                  // Fallback to name/email matching only if contactId lookup failed
                  if (!contactLastActivity || !nextActionActivity) {
                    const contactNameLower = contact.name?.toLowerCase() || '';
                    const contactEmailLower = contact.email?.toLowerCase() || '';
                    
                    if (!contactLastActivity && (contactNameLower || contactEmailLower)) {
                      contactLastActivity = allProjectActivities
                        .filter(a => {
                          const notesLower = a.conversationNotes?.toLowerCase() || '';
                          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
                        })
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                    }
                    
                    if (!nextActionActivity && (contactNameLower || contactEmailLower)) {
                      const now = new Date();
                      nextActionActivity = allProjectActivities
                        .filter(a => {
                          if (!a.nextActionDate || new Date(a.nextActionDate) < now) return false;
                          const notesLower = a.conversationNotes?.toLowerCase() || '';
                          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
                        })
                        .sort((a, b) => new Date(a.nextActionDate) - new Date(b.nextActionDate))[0];
                    }
                  }
                  
                  // Determine the stage to display - automatically fetch from latest LinkedIn activity status
                  // If no LinkedIn status exists, fall back to contact.stage from database, then default to 'New'
                  const displayStage = latestLinkedInStatus || contact.stage || 'New';
                  const assignedTo = contact.assignedTo || project?.assignedTo || '-';

                  // Check if contact is from databank (has _id - MongoDB ObjectId)
                  // Contacts from databank will have _id, imported contacts might have it too if they exist in DB
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
                      // Navigate to contact activity history page
                      navigate(`/contacts/${contactIdValue}/activities?projectId=${id}&returnTo=/projects/${id}`);
                    }
                  };

                  return (
                    <React.Fragment key={contactId}>
                      <tr 
                        onClick={handleContactRowClick}
                        className={`transition-all duration-150 ${
                          isFromDatabank 
                            ? 'hover:bg-blue-50 cursor-pointer' 
                            : 'hover:bg-gray-50'
                        } ${isExpanded ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(contactId.toString())}
                            onChange={(e) => handleContactSelect(contactId, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
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
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                              <span className="text-sm font-semibold text-white">
                                {getInitials(contact.name)}
                              </span>
                            </div>
                            <div>
                              <div className={`text-sm font-semibold ${isFromDatabank ? 'text-gray-900 hover:text-blue-600' : 'text-gray-900'}`}>
                                {contact.name || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">{contact.company || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {contact.email ? (
                              <div className="text-sm text-gray-900 font-medium flex items-center gap-1">
                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {contact.email}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">No email</div>
                            )}
                            {contact.firstPhone ? (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {contact.firstPhone}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">No phone</div>
                            )}
                            {contact.personLinkedinUrl || contact.companyLinkedinUrl ? (
                              <div className="text-xs text-blue-600 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                                <a href={contact.personLinkedinUrl || contact.companyLinkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                                  LinkedIn
                                </a>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">No LinkedIn</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStageBadge(displayStage)}
                          {latestLinkedInStatus && (
                            <div className="text-xs text-gray-400 mt-1">
                              From LinkedIn activity
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {contactLastActivity ? (
                            <div>
                              <div className="text-sm text-gray-900 font-medium">{formatDate(contactLastActivity.createdAt)}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {contactLastActivity.type === 'call' ? 'Call' : 
                                 contactLastActivity.type === 'email' ? 'Email' : 
                                 contactLastActivity.type === 'linkedin' ? 'LinkedIn' : 'Activity'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">-</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {nextActionActivity ? (
                            <div className="flex items-center gap-2">
                              <svg className={`w-4 h-4 flex-shrink-0 ${
                                new Date(nextActionActivity.nextActionDate) < new Date() ? 'text-red-600' :
                                new Date(nextActionActivity.nextActionDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'text-orange-500' :
                                'text-gray-400'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{nextActionActivity.nextAction}</div>
                                <div className={`text-xs font-medium mt-0.5 ${
                                  new Date(nextActionActivity.nextActionDate) < new Date() ? 'text-red-600' :
                                  new Date(nextActionActivity.nextActionDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'text-orange-600' :
                                  'text-gray-500'
                                }`}>
                                  {formatDate(nextActionActivity.nextActionDate)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">-</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                          {assignedTo || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActivityModal('call', contact);
                              }}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                              title="Log Call"
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
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                              title="Log Email"
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
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                              title="Log LinkedIn"
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
                          <td colSpan="8" className="px-6 py-4 bg-blue-50 border-t-2 border-blue-200">
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
        contactId={activityModal.contactId}
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
          if (showProspectSuggestions) {
            fetchSimilarContacts();
          } else {
            fetchImportedContacts();
          }
          fetchAllProjectActivities();
        }}
      />

      <BulkActivityLogModal
        isOpen={bulkActivityModal.isOpen}
        onClose={handleCloseBulkActivityModal}
        type={bulkActivityModal.type}
        selectedContacts={selectedContacts}
        projectId={id}
        contacts={contacts}
      />
    </div>
  );
}
