import React, { useState, useEffect, useMemo, useCallback, startTransition, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import ActivityLogModal from '../components/ActivityLogModal';
import BulkImportModal from '../components/BulkImportModal';
import BulkActivityLogModal from '../components/BulkActivityLogModal';

// Helper function to get the activity date (prioritize activity-specific dates over createdAt)
const getActivityDate = (activity) => {
  if (activity.type === 'call' && activity.callDate) {
    return new Date(activity.callDate);
  }
  if (activity.type === 'email' && activity.emailDate) {
    return new Date(activity.emailDate);
  }
  if (activity.type === 'linkedin' && activity.linkedinDate) {
    return new Date(activity.linkedinDate);
  }
  // Fallback to createdAt if activity-specific date is not available
  return new Date(activity.createdAt);
};

// Helper function to get the import date from a contact
// Uses the ObjectId timestamp (first 8 hex characters) to get creation date
const getContactImportDate = (contact) => {
  if (!contact._id) return null;
  
  try {
    // If _id is an ObjectId, extract timestamp
    const idStr = contact._id.toString ? contact._id.toString() : String(contact._id);
    if (idStr.length >= 8) {
      // ObjectId timestamp is in the first 8 hex characters
      const timestamp = parseInt(idStr.substring(0, 8), 16) * 1000; // Convert to milliseconds
      return new Date(timestamp);
    }
  } catch (e) {
    console.error('Error extracting import date from contact ID:', e);
  }
  
  // Fallback: if contact has createdAt, use it
  if (contact.createdAt) {
    return new Date(contact.createdAt);
  }
  
  return null;
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterActionDate, setFilterActionDate] = useState('');
  const [filterActionDateFrom, setFilterActionDateFrom] = useState('');
  const [filterActionDateTo, setFilterActionDateTo] = useState('');
  const [filterLastInteraction, setFilterLastInteraction] = useState('');
  const [filterLastInteractionFrom, setFilterLastInteractionFrom] = useState('');
  const [filterLastInteractionTo, setFilterLastInteractionTo] = useState('');
  const [filterImportDate, setFilterImportDate] = useState('');
  const [filterImportDateFrom, setFilterImportDateFrom] = useState('');
  const [filterImportDateTo, setFilterImportDateTo] = useState('');
  const [filterNoActivity, setFilterNoActivity] = useState(false);
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
    linkedInProfileUrl: null,
    lastActivity: null
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
  const [deletedContactIds, setDeletedContactIds] = useState(new Set()); // Track deleted contact IDs to prevent reappearance

  // Debounce search query for better performance
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    if (id) {
      // Fetch project first, then contacts and activities in parallel
      fetchProject().then(() => {
        // Fetch contacts and activities in parallel for better performance
        Promise.all([
        fetchAllProjectActivities().catch(err => {
          console.error('Error fetching activities:', err);
          }),
        fetchImportedContacts().catch(err => {
          console.error('Error fetching imported contacts:', err);
          })
        ]);
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
      // Fetch all prospects by setting a high limit
      const response = await API.get(`/projects/${id}/project-contacts?limit=10000`);
      if (response.data.success) {
        const contactsData = response.data.data || [];
        
        // Deduplicate contacts by _id (contact ID) - ensure each contact appears only once
        // This fixes the issue where the same prospect appears multiple times with different activity dates
        const contactsMap = new Map();
        contactsData.forEach(contact => {
          const contactId = contact._id?.toString ? contact._id.toString() : String(contact._id);
          if (!contactId) return; // Skip contacts without IDs
          
          const existing = contactsMap.get(contactId);
          if (!existing) {
            // First occurrence - add it
            contactsMap.set(contactId, contact);
          } else {
            // Duplicate found - prefer the one with projectContactId (imported) over activity-based
            // If both are same type, keep the first one encountered
            const existingHasProjectContact = existing.projectContactId !== null && existing.projectContactId !== undefined;
            const newHasProjectContact = contact.projectContactId !== null && contact.projectContactId !== undefined;
            
            if (newHasProjectContact && !existingHasProjectContact) {
              // New one is imported (has projectContactId), existing is activity-based - replace
              contactsMap.set(contactId, contact);
            }
            // Otherwise keep existing (first one wins, or both are same type)
          }
        });
        
        // Convert map back to array - this ensures each contact appears only once
        let uniqueContacts = Array.from(contactsMap.values());
        
        // Also filter out any contacts that were previously deleted (prevent reappearance)
        if (deletedContactIds.size > 0) {
          const beforeFilter = uniqueContacts.length;
          uniqueContacts = uniqueContacts.filter(contact => {
            if (!contact._id) return true;
            const contactIdStr = contact._id.toString ? contact._id.toString() : String(contact._id);
            return !deletedContactIds.has(contactIdStr);
          });
          if (beforeFilter !== uniqueContacts.length) {
            console.log(`Filtered out ${beforeFilter - uniqueContacts.length} previously deleted contact(s) from refresh`);
          }
        }
        
        setContacts(uniqueContacts);
        
        // Log if duplicates were found and removed
        if (contactsData.length !== uniqueContacts.length) {
          console.log(`Removed ${contactsData.length - uniqueContacts.length} duplicate contact(s) - same contact appeared multiple times`);
        }
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
        let contactsData = response.data.data || [];
        
        // Filter out any contacts that were previously deleted (prevent reappearance)
        if (deletedContactIds.size > 0) {
          const beforeFilter = contactsData.length;
          contactsData = contactsData.filter(contact => {
            if (!contact._id) return true;
            const contactIdStr = contact._id.toString ? contact._id.toString() : String(contact._id);
            return !deletedContactIds.has(contactIdStr);
          });
          if (beforeFilter !== contactsData.length) {
            console.log(`Filtered out ${beforeFilter - contactsData.length} previously deleted contact(s) from similar contacts`);
          }
        }
        
        setContacts(contactsData);
        if (response.data.matchStats) {
          setMatchStats(response.data.matchStats);
        }
        // If no ICP is defined, show message and disable suggestions
        if (response.data.hasICP === false) {
          setShowProspectSuggestions(false);
          // Show message if user tried to enable suggestions
          if (showProspectSuggestions) {
            alert(response.data.message || 'No ICP defined for this project. Please add an ICP definition to get suggestions.');
          }
          return false; // Return false to indicate ICP is not available
        }
        return true;
      }
    } catch (err) {
      console.error('Error fetching similar contacts:', err);
      return false;
    }
  };

  // Check if project has ICP defined (must have at least one meaningful criteria)
  // Exclude default company size values (0-1000) as they're not meaningful
  const hasMeaningfulCompanySize = project?.icpDefinition?.companySizeMin !== undefined && 
                                   project?.icpDefinition?.companySizeMax !== undefined &&
                                   !(project.icpDefinition.companySizeMin === 0 && project.icpDefinition.companySizeMax === 1000);
  
  // Check if at least one ICP criteria is defined and non-empty
  const hasTargetIndustries = project?.icpDefinition?.targetIndustries && 
                              Array.isArray(project.icpDefinition.targetIndustries) && 
                              project.icpDefinition.targetIndustries.length > 0;
  
  const hasTargetJobTitles = project?.icpDefinition?.targetJobTitles && 
                             Array.isArray(project.icpDefinition.targetJobTitles) && 
                             project.icpDefinition.targetJobTitles.length > 0;
  
  const hasGeographies = project?.icpDefinition?.geographies && 
                         Array.isArray(project.icpDefinition.geographies) && 
                         project.icpDefinition.geographies.length > 0;
  
  const hasKeywords = project?.icpDefinition?.keywords && 
                      Array.isArray(project.icpDefinition.keywords) && 
                      project.icpDefinition.keywords.length > 0;
  
  // hasICP is true only if at least one meaningful criteria exists
  const hasICP = hasTargetIndustries || hasTargetJobTitles || hasGeographies || hasKeywords || hasMeaningfulCompanySize;

  // Disable suggestions if ICP is removed while suggestions are enabled
  useEffect(() => {
    if (showProspectSuggestions && !hasICP) {
      setShowProspectSuggestions(false);
      fetchImportedContacts().catch(err => {
        console.error('Error fetching imported contacts:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasICP, showProspectSuggestions]);

  // Toggle prospect suggestions
  const handleToggleProspectSuggestions = async () => {
    // Don't allow toggling if no ICP is defined
    if (!hasICP) {
      alert('No ICP (Ideal Customer Profile) is defined for this project. Please add an ICP definition in project settings to get suggestions.');
      return;
    }

    const newState = !showProspectSuggestions;
    setShowProspectSuggestions(newState);
    
    if (newState) {
      // Fetch suggestions from databank
      const success = await fetchSimilarContacts();
      if (!success || !hasICP) {
        // If fetch failed or no ICP, revert the state and show message
        setShowProspectSuggestions(false);
        if (!hasICP) {
          alert('No ICP (Ideal Customer Profile) is defined for this project. Please add an ICP definition in project settings to get suggestions.');
        }
      }
    } else {
      // Show only imported contacts
      await fetchImportedContacts();
    }
  };

  const fetchAllProjectActivities = async () => {
    try {
      const response = await API.get(`/activities/project/${id}?limit=10000`); // Increased limit to ensure all activities are fetched
      if (response.data.success) {
        const activities = response.data.data || [];
        setAllProjectActivities(activities);
        // Debug: Log activities with status to verify they're being fetched
        const activitiesWithStatus = activities.filter(a => a.status);
        if (activitiesWithStatus.length > 0) {
          console.log(`Found ${activitiesWithStatus.length} activities with status out of ${activities.length} total activities`);
        }
      }
    } catch (err) {
      console.error('Error fetching project activities:', err);
    }
  };

  // Pre-compute activity lookups for better performance (must be defined before fetchActivitiesForContact)
  const activityLookups = useMemo(() => {
    const lookups = {
      byContactId: new Map(),
      lastActivityByContactId: new Map(),
      nextActionByContactId: new Map(),
      latestActivityStatusByContactId: new Map() // Changed from latestLinkedInStatusByContactId to track all activity types
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
        
        // Track last activity - use activity-specific date (callDate, emailDate, linkedinDate) or createdAt
        const existing = lookups.lastActivityByContactId.get(contactIdStr);
        const activityDate = getActivityDate(activity);
        if (!existing) {
          lookups.lastActivityByContactId.set(contactIdStr, activity);
        } else {
          const existingDate = getActivityDate(existing);
          if (activityDate > existingDate) {
            lookups.lastActivityByContactId.set(contactIdStr, activity);
          }
        }
        
        // Track next action
        if (activity.nextActionDate && new Date(activity.nextActionDate) >= now) {
          const existing = lookups.nextActionByContactId.get(contactIdStr);
          if (!existing || new Date(activity.nextActionDate) < new Date(existing.nextActionDate)) {
            lookups.nextActionByContactId.set(contactIdStr, activity);
          }
        }
        
        // Track latest activity status (for all activity types - call, email, linkedin)
        // This determines the stage based on the most recent activity status from Activity History
        // Only track activities that have a status - find the most recent one with a status
        // Use activity-specific date (callDate, emailDate, linkedinDate) to determine most recent status
        if (activity.status && activity.status.trim() !== '') {
          const existing = lookups.latestActivityStatusByContactId.get(contactIdStr);
          // Get the activity date (prioritize activity-specific dates over createdAt)
          const activityDate = getActivityDate(activity);
          // Only update if this activity is more recent than the existing one
          if (!existing) {
            lookups.latestActivityStatusByContactId.set(contactIdStr, {
              status: activity.status,
              createdAt: activityDate,
              activityDate: activityDate
            });
          } else {
            const existingDate = existing.activityDate ? new Date(existing.activityDate) : new Date(existing.createdAt);
            if (activityDate > existingDate) {
              lookups.latestActivityStatusByContactId.set(contactIdStr, {
                status: activity.status,
                createdAt: activityDate,
                activityDate: activityDate
              });
            }
          }
        }
      }
    });
    
    return lookups;
  }, [allProjectActivities]);

  // Optimized: Use cached activities instead of making API calls
  const fetchActivitiesForContact = useCallback(async (contactId, contactEmail, contactName) => {
    if (loadingActivities[contactId]) return;
    
    const contactIdStr = contactId?.toString ? contactId.toString() : contactId;
    if (!contactIdStr) return;
    
    try {
      setLoadingActivities(prev => ({ ...prev, [contactId]: true }));
      
      // First, try to get from cached activities (much faster)
      // Filter cached activities by projectId to ensure project-specific activities
      const allCachedActivities = activityLookups.byContactId.get(contactIdStr) || [];
      const cachedActivities = allCachedActivities.filter(act => 
        act.projectId && act.projectId.toString() === id
      );
      
      if (cachedActivities.length > 0) {
        // Use cached data - no API call needed
        setContactActivities(prev => ({
          ...prev,
          [contactId]: cachedActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }));
        setLoadingActivities(prev => ({ ...prev, [contactId]: false }));
        return;
      }
      
      // Only make API call if not in cache (should be rare)
      try {
        // Include projectId in query to ensure we only get activities for this specific project
        const response = await API.get(`/activities/contact/${contactIdStr}?projectId=${id}`);
        if (response.data.success) {
          const activities = response.data.data || [];
          setContactActivities(prev => ({
            ...prev,
            [contactId]: activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          }));
        }
      } catch (apiErr) {
        // If API fails (404 or other error), try fallback to project activities
        // Ensure we only use activities from the current project
        console.warn(`API call failed for contact ${contactIdStr}, using cached activities:`, apiErr.message);
        const fallbackActivities = allProjectActivities.filter(activity => {
          // First, ensure activity belongs to current project
          const activityProjectId = activity.projectId?.toString ? activity.projectId.toString() : activity.projectId;
          if (activityProjectId !== id) return false; // Skip activities from other projects
          
              if (activity.contactId) {
                const activityContactIdStr = activity.contactId.toString ? activity.contactId.toString() : activity.contactId;
                if (activityContactIdStr === contactIdStr) return true;
              }
              // Fallback to notes matching only if contactId doesn't match
          if (contactEmail || contactName) {
            const emailLower = contactEmail?.toLowerCase() || '';
            const nameLower = contactName?.toLowerCase() || '';
              const notesLower = activity.conversationNotes?.toLowerCase() || '';
              return notesLower.includes(emailLower) || notesLower.includes(nameLower);
          }
          return false;
        });
          setContactActivities(prev => ({
            ...prev,
          [contactId]: fallbackActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          }));
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoadingActivities(prev => ({ ...prev, [contactId]: false }));
    }
  }, [loadingActivities, activityLookups, allProjectActivities]);

  // Optimized: Use useCallback and startTransition for smooth expansion
  const toggleContactExpansion = useCallback(async (contactId, contactEmail, contactName) => {
    const isExpanded = expandedContacts.has(contactId);
    
    if (isExpanded) {
      startTransition(() => {
      setExpandedContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
        });
      });
    } else {
      startTransition(() => {
      setExpandedContacts(prev => new Set(prev).add(contactId));
      });
      // Fetch activities asynchronously - don't block UI
      fetchActivitiesForContact(contactId, contactEmail, contactName).catch(err => {
        console.error('Error fetching activities:', err);
      });
    }
  }, [expandedContacts, fetchActivitiesForContact]);

  const handleOpenActivityModal = (type, contact) => {
    // Ensure contactId is always a string for Map lookup
    const contactIdValue = contact._id ? (contact._id.toString ? contact._id.toString() : String(contact._id)) : null;
    
    // Get the most recent activity for this contact
    let lastActivity = null;
    let detectedType = type; // Default to the passed type
    
    if (contactIdValue) {
      lastActivity = activityLookups.lastActivityByContactId.get(contactIdValue) || null;
      
      // If we have a last activity, use its type instead of the passed type
      if (lastActivity && lastActivity.type) {
        detectedType = lastActivity.type;
      }
    }
    
    setActivityModal({
      isOpen: true,
      type: detectedType,
      contactName: contact.name || 'N/A',
      companyName: contact.company || '',
      projectId: id,
      contactId: contactIdValue || null,
      phoneNumber: contact.firstPhone || null,
      email: contact.email || null,
      linkedInProfileUrl: contact.personLinkedinUrl || contact.companyLinkedinUrl || null,
      lastActivity: lastActivity || null // Pass the last activity data
    });
  };

  const handleCloseActivityModal = async () => {
    setActivityModal({
      isOpen: false,
      type: null,
      contactName: '',
      companyName: '',
      projectId: null,
      contactId: null,
      phoneNumber: null,
      email: null,
      linkedInProfileUrl: null,
      lastActivity: null
    });
    // Refresh all project activities first (this will update the status display automatically)
    // Wait for activities to be fetched before refreshing contacts
    await fetchAllProjectActivities();
    // Small delay to ensure activities state is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    // Refresh contacts to get updated stage from ProjectContact
    if (showProspectSuggestions) {
      await fetchSimilarContacts();
    } else {
      await fetchImportedContacts();
    }
    // Refresh activities for expanded contacts
    expandedContacts.forEach(contactId => {
      const contact = contacts.find(c => (c._id || c.name) === contactId);
      if (contact) {
        fetchActivitiesForContact(contactId, contact.email, contact.name);
      }
    });
  };

  const handleCloseBulkActivityModal = async () => {
    setBulkActivityModal({
      isOpen: false,
      type: null
    });
    // Clear selection after bulk logging
    setSelectedContacts(new Set());
    // Refresh all project activities first (this will update the status display automatically)
    // Wait for activities to be fetched before refreshing contacts
    await fetchAllProjectActivities();
    // Small delay to ensure activities state is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    // Refresh contacts to get updated stage from ProjectContact
    if (showProspectSuggestions) {
      await fetchSimilarContacts();
    } else {
      await fetchImportedContacts();
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
            <div className="text-center py-8 text-gray-500 text-sm transition-opacity duration-300">
              No activities logged yet. Click "Log Activity" to get started.
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {activities
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((activity, index) => (
                <div 
                  key={activity._id} 
                  className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 transition-all duration-300 hover:bg-gray-50 rounded-lg px-2 -mx-2 py-1"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
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

  // Memoize filtered contacts to avoid recalculating on every render
  // Use debouncedSearchQuery for better performance
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
    // Search filter (using debounced query)
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      const matchesSearch = 
        (contact.name && contact.name.toLowerCase().includes(query)) ||
        (contact.company && contact.company.toLowerCase().includes(query)) ||
        (contact.email && contact.email.toLowerCase().includes(query)) ||
        (contact.firstPhone && contact.firstPhone.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Status filter - check latest activity status and contact.stage
    if (filterStatus) {
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      const latestStatusData = contactIdStr ? activityLookups.latestActivityStatusByContactId.get(contactIdStr) : null;
      const latestStatus = latestStatusData?.status || null;
      const contactStatus = latestStatus || contact.stage || 'New';
      if (contactStatus !== filterStatus) return false;
    }

    // Action Date filter (Next Action Date)
    if (filterActionDate || filterActionDateFrom || filterActionDateTo) {
      const contactId = contact._id || contact.name;
      const contactIdStr = contact._id?.toString ? contact._id.toString() : contact._id;
      const nextActionActivity = contactIdStr ? activityLookups.nextActionByContactId.get(contactIdStr) : null;
      
      // Handle custom date range
      if (filterActionDate === 'custom' && (filterActionDateFrom || filterActionDateTo)) {
        if (!nextActionActivity || !nextActionActivity.nextActionDate) return false;
        const actionDate = new Date(nextActionActivity.nextActionDate);
        actionDate.setHours(0, 0, 0, 0);
        
        if (filterActionDateFrom) {
          const fromDate = new Date(filterActionDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (actionDate < fromDate) return false;
        }
        
        if (filterActionDateTo) {
          const toDate = new Date(filterActionDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (actionDate > toDate) return false;
        }
      } else if (filterActionDate && filterActionDate !== 'custom') {
        // Handle preset date ranges
        if (!nextActionActivity || !nextActionActivity.nextActionDate) return false;
        const actionDate = new Date(nextActionActivity.nextActionDate);
        actionDate.setHours(0, 0, 0, 0);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        switch (filterActionDate) {
          case 'today':
            if (actionDate < today || actionDate >= tomorrow) return false;
            break;
          case 'this-week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            if (actionDate < weekStart || actionDate >= weekEnd) return false;
            break;
          case 'this-month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            if (actionDate < monthStart || actionDate >= monthEnd) return false;
            break;
          default:
            break;
        }
      }
    }

    // Last Interaction Date filter
    if (filterLastInteraction || filterLastInteractionFrom || filterLastInteractionTo) {
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      const contactLastActivity = contactIdStr ? activityLookups.lastActivityByContactId.get(contactIdStr) : null;
      
      // Handle custom date range
      if (filterLastInteraction === 'custom' && (filterLastInteractionFrom || filterLastInteractionTo)) {
        if (!contactLastActivity) return false;
        const interactionDate = getActivityDate(contactLastActivity);
        interactionDate.setHours(0, 0, 0, 0);
        
        if (filterLastInteractionFrom) {
          const fromDate = new Date(filterLastInteractionFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (interactionDate < fromDate) return false;
        }
        
        if (filterLastInteractionTo) {
          const toDate = new Date(filterLastInteractionTo);
          toDate.setHours(23, 59, 59, 999);
          if (interactionDate > toDate) return false;
        }
      } else if (filterLastInteraction && filterLastInteraction !== 'custom') {
        // Handle preset date ranges
        if (!contactLastActivity) return false;
        const interactionDate = getActivityDate(contactLastActivity);
        interactionDate.setHours(0, 0, 0, 0);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        switch (filterLastInteraction) {
          case 'today':
            if (interactionDate < today || interactionDate >= tomorrow) return false;
            break;
          case 'this-week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            if (interactionDate < weekStart || interactionDate >= weekEnd) return false;
            break;
          case 'this-month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            if (interactionDate < monthStart || interactionDate >= monthEnd) return false;
            break;
          default:
            break;
        }
      }
    }

    // Import Date filter - filter by when prospect was imported/created
    if (filterImportDate || filterImportDateFrom || filterImportDateTo) {
      const importDate = getContactImportDate(contact);
      
      if (!importDate) {
        // If no import date available, exclude from results
        return false;
      }
      
      // Handle custom date range
      if (filterImportDate === 'custom' && (filterImportDateFrom || filterImportDateTo)) {
        const contactImportDate = new Date(importDate);
        contactImportDate.setHours(0, 0, 0, 0);
        
        if (filterImportDateFrom) {
          const fromDate = new Date(filterImportDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (contactImportDate < fromDate) return false;
        }
        
        if (filterImportDateTo) {
          const toDate = new Date(filterImportDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (contactImportDate > toDate) return false;
        }
      } else if (filterImportDate && filterImportDate !== 'custom') {
        // Handle preset date ranges
        const contactImportDate = new Date(importDate);
        contactImportDate.setHours(0, 0, 0, 0);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        switch (filterImportDate) {
          case 'today':
            if (contactImportDate < today || contactImportDate >= tomorrow) return false;
            break;
          case 'yesterday':
            if (contactImportDate < yesterday || contactImportDate >= today) return false;
            break;
          default:
            break;
        }
      }
    }

    // No Activity filter - show only prospects with no last interaction
    if (filterNoActivity) {
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      const contactLastActivity = contactIdStr ? activityLookups.lastActivityByContactId.get(contactIdStr) : null;
      
      // If there's any activity in the lookup, exclude this contact
      if (contactLastActivity) return false;
      
      // Also check if there are any activities for this contact in allProjectActivities
      // This handles cases where contactId might not match exactly
      const hasAnyActivity = allProjectActivities.some(activity => {
        if (!activity.contactId) return false;
        const activityContactIdStr = activity.contactId.toString ? activity.contactId.toString() : activity.contactId;
        if (activityContactIdStr === contactIdStr) return true;
        
        // Fallback: check by email or name in conversation notes
        if (!contactIdStr) {
          const contactEmail = contact.email?.toLowerCase() || '';
          const contactName = contact.name?.toLowerCase() || '';
          const notesLower = activity.conversationNotes?.toLowerCase() || '';
          const activityEmail = activity.email?.toLowerCase() || '';
          return (contactEmail && (notesLower.includes(contactEmail) || activityEmail === contactEmail)) ||
                 (contactName && notesLower.includes(contactName));
        }
        return false;
      });
      
      // If any activity is found, exclude this contact
      if (hasAnyActivity) return false;
    }

    // Quick filters
    if (quickFilter === 'due-today') {
      // Find activities with nextActionDate due today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const contactId = contact._id || contact.name;
      const contactIdStr = contact._id?.toString ? contact._id.toString() : contact._id;
      // Filter activities by contactId and ensure they belong to current project
      const contactActivities = allProjectActivities.filter(a => {
        // Ensure activity belongs to current project
        const activityProjectId = a.projectId?.toString ? a.projectId.toString() : a.projectId;
        if (activityProjectId !== id) return false; // Skip activities from other projects
        // Prioritize contactId matching for data isolation
        if (contactIdStr && a.contactId) {
          const activityContactIdStr = a.contactId.toString ? a.contactId.toString() : a.contactId;
          if (activityContactIdStr === contactIdStr) return true;
        }
        // Fallback to notes matching only if contactId is not available
        if (!contactIdStr || !a.contactId) {
          const notesLower = a.conversationNotes?.toLowerCase() || '';
          const contactNameLower = contact.name?.toLowerCase() || '';
          const contactEmailLower = contact.email?.toLowerCase() || '';
          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
        }
        return false;
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
      const latestStatusData = contactIdStr ? activityLookups.latestActivityStatusByContactId.get(contactIdStr) : null;
      const latestStatus = latestStatusData?.status || null;
      const contactStatus = latestStatus || contact.stage || 'New';
      if (contactStatus !== 'New') return false;
    }

      return true;
    });
  }, [contacts, debouncedSearchQuery, quickFilter, filterStatus, filterActionDate, filterActionDateFrom, filterActionDateTo, filterLastInteraction, filterLastInteractionFrom, filterLastInteractionTo, filterImportDate, filterImportDateFrom, filterImportDateTo, filterNoActivity, filterMatchType, allProjectActivities, project, activityLookups, id]);

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
        // Verify deletion was successful
        const deletedCount = response.data.data?.deletedCount || 0;
        if (deletedCount === 0) {
          alert('No prospects were removed. They may have already been deleted.');
          setRemoving(false);
          return;
        }
        
        // Clear selection
        setSelectedContacts(new Set());
        setShowRemoveConfirmation(false);
        
        // Remove deleted contacts from local state immediately for better UX
        // Normalize all IDs to strings for comparison - handle both string and ObjectId formats
        const contactIdsSet = new Set();
        contactIdsArray.forEach(id => {
          const idStr = String(id);
          contactIdsSet.add(idStr);
          // Also add normalized versions for robust matching
          if (id && typeof id === 'object' && id.toString) {
            contactIdsSet.add(id.toString());
          }
        });
        
        // Track deleted contact IDs to prevent them from reappearing in background refresh
        const deletedContactIdsSet = new Set(contactIdsSet);
        setDeletedContactIds(prev => {
          const newSet = new Set(prev);
          contactIdsSet.forEach(id => newSet.add(id));
          return newSet;
        });
        
        setContacts(prevContacts => {
          const filtered = prevContacts.filter(contact => {
            if (!contact._id) return true; // Keep contacts without IDs (shouldn't happen, but safe)
            
            // Try multiple ID formats for robust matching
            const contactIdStr = contact._id.toString ? contact._id.toString() : String(contact._id);
            const contactIdObj = contact._id;
            
            // Check if this contact should be removed
            if (contactIdsSet.has(contactIdStr)) return false;
            if (contactIdObj && contactIdsSet.has(String(contactIdObj))) return false;
            
            return true;
          });
          
          console.log(`Removed ${prevContacts.length - filtered.length} contact(s) from UI`);
          return filtered;
        });
        
        // Also remove from expanded contacts if any were expanded
        setExpandedContacts(prev => {
          const newSet = new Set(prev);
          contactIdsSet.forEach(idStr => {
            newSet.delete(idStr);
          });
          return newSet;
        });
        
        // Clear activities for deleted contacts
        setContactActivities(prev => {
          const newActivities = { ...prev };
          contactIdsSet.forEach(idStr => {
            delete newActivities[idStr];
          });
          return newActivities;
        });
        
        // Remove activities from allProjectActivities for deleted contacts
        setAllProjectActivities(prevActivities => {
          return prevActivities.filter(activity => {
            if (!activity.contactId) return true;
            const activityContactId = activity.contactId.toString ? activity.contactId.toString() : String(activity.contactId);
            return !contactIdsSet.has(activityContactId);
          });
        });
        
        // Don't refresh immediately - we've already updated local state
        // Only refresh in background after a delay, but filter out deleted contacts
        setTimeout(async () => {
          try {
            // Refresh contacts from server
            if (showProspectSuggestions) {
              await fetchSimilarContacts();
            } else {
              await fetchImportedContacts();
            }
            
            // After refresh, ensure deleted contacts are still removed (in case they came back)
            setContacts(prevContacts => {
              const filtered = prevContacts.filter(contact => {
                if (!contact._id) return true;
                const contactIdStr = contact._id.toString ? contact._id.toString() : String(contact._id);
                return !deletedContactIdsSet.has(contactIdStr);
              });
              
              if (prevContacts.length !== filtered.length) {
                console.log(`Removed ${prevContacts.length - filtered.length} contact(s) that reappeared after refresh`);
              }
              return filtered;
            });
            
            await fetchAllProjectActivities();
          } catch (err) {
            // Silently handle refresh errors - local state is already updated
            console.error('Background refresh after deletion:', err);
          }
        }, 1000); // Increased delay to ensure backend deletion is complete
        
        // Show success message
        console.log(`Successfully removed ${deletedCount} prospect(s)`);
      }
    } catch (err) {
      console.error('Error removing prospects:', err);
      alert(err.response?.data?.error || 'Failed to remove prospects');
    } finally {
      setRemoving(false);
    }
  };

  // Optimized stats calculation using activityLookups for better performance
  const stats = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    let overdueCount = 0;
    let thisWeekCount = 0;
    
    contacts.forEach(contact => {
        const contactIdStr = contact._id?.toString ? contact._id.toString() : contact._id;
      const contactActivities = contactIdStr ? (activityLookups.byContactId.get(contactIdStr) || []) : [];
      
      // Check for overdue actions
      const hasOverdue = contactActivities.some(activity => {
          if (!activity.nextActionDate) return false;
          const actionDate = new Date(activity.nextActionDate);
          return actionDate < today;
        });
      if (hasOverdue) overdueCount++;
      
      // Check for this week actions
      const hasThisWeek = contactActivities.some(activity => {
          if (!activity.nextActionDate) return false;
          const actionDate = new Date(activity.nextActionDate);
          return actionDate >= today && actionDate < weekEnd;
        });
      if (hasThisWeek) thisWeekCount++;
    });
    
    return {
      total: contacts.length,
      active: contacts.filter(c => {
        const stage = c.stage || 'New';
        return stage === 'Qualified' || stage === 'Proposal' || stage === 'Negotiation';
      }).length,
      overdue: overdueCount,
      thisWeek: thisWeekCount
    };
  }, [contacts, activityLookups]);

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
        <div className="flex items-center gap-3 flex-wrap justify-end">
            <button
            onClick={() => navigate(`/prospects/dashboard?projectId=${id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors font-medium text-sm shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            Prospect Analytics
            </button>
          <button 
            onClick={handleToggleProspectSuggestions}
            disabled={!hasICP}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
              !hasICP
                ? 'bg-gray-100 border border-gray-300 text-gray-400 cursor-not-allowed'
                : showProspectSuggestions
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title={!hasICP ? 'No ICP defined. Add an ICP definition to get suggestions.' : 'Show prospect suggestions based on ICP'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Prospect Suggestion
            {!hasICP && (
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
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
                setFilterStatus('New');
              } else if (quickFilter === 'new-prospects') {
                setFilterStatus('');
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
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
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
              value={filterActionDate}
              onChange={(e) => {
                setFilterActionDate(e.target.value);
                if (e.target.value !== 'custom') {
                  setFilterActionDateFrom('');
                  setFilterActionDateTo('');
                }
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors cursor-pointer"
            >
              <option value="">Action Date</option>
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            {filterActionDate === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filterActionDateFrom}
                  onChange={(e) => {
                    setFilterActionDateFrom(e.target.value);
                    if (e.target.value && filterActionDateTo && new Date(e.target.value) > new Date(filterActionDateTo)) {
                      setFilterActionDateTo(e.target.value);
                    }
                  }}
                  max={filterActionDateTo || undefined}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors"
                  placeholder="From"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={filterActionDateTo}
                  onChange={(e) => {
                    setFilterActionDateTo(e.target.value);
                    if (e.target.value && filterActionDateFrom && new Date(e.target.value) < new Date(filterActionDateFrom)) {
                      setFilterActionDateFrom(e.target.value);
                    }
                  }}
                  min={filterActionDateFrom || undefined}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors"
                  placeholder="To"
                />
              </div>
            )}
            <select
              value={filterLastInteraction}
              onChange={(e) => {
                setFilterLastInteraction(e.target.value);
                if (e.target.value !== 'custom') {
                  setFilterLastInteractionFrom('');
                  setFilterLastInteractionTo('');
                }
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors cursor-pointer"
            >
              <option value="">Last Interaction</option>
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            {filterLastInteraction === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filterLastInteractionFrom}
                  onChange={(e) => {
                    setFilterLastInteractionFrom(e.target.value);
                    if (e.target.value && filterLastInteractionTo && new Date(e.target.value) > new Date(filterLastInteractionTo)) {
                      setFilterLastInteractionTo(e.target.value);
                    }
                  }}
                  max={filterLastInteractionTo || undefined}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors"
                  placeholder="From"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={filterLastInteractionTo}
                  onChange={(e) => {
                    setFilterLastInteractionTo(e.target.value);
                    if (e.target.value && filterLastInteractionFrom && new Date(e.target.value) < new Date(filterLastInteractionFrom)) {
                      setFilterLastInteractionFrom(e.target.value);
                    }
                  }}
                  min={filterLastInteractionFrom || undefined}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors"
                  placeholder="To"
                />
              </div>
            )}
            <select
              value={filterImportDate}
              onChange={(e) => {
                setFilterImportDate(e.target.value);
                if (e.target.value !== 'custom') {
                  setFilterImportDateFrom('');
                  setFilterImportDateTo('');
                }
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors cursor-pointer"
            >
              <option value="">Import Date</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="custom">Custom Range</option>
            </select>
            {filterImportDate === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filterImportDateFrom}
                  onChange={(e) => {
                    setFilterImportDateFrom(e.target.value);
                    if (e.target.value && filterImportDateTo && new Date(e.target.value) > new Date(filterImportDateTo)) {
                      setFilterImportDateTo(e.target.value);
                    }
                  }}
                  max={filterImportDateTo || undefined}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors"
                  placeholder="From"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={filterImportDateTo}
                  onChange={(e) => {
                    setFilterImportDateTo(e.target.value);
                    if (e.target.value && filterImportDateFrom && new Date(e.target.value) < new Date(filterImportDateFrom)) {
                      setFilterImportDateFrom(e.target.value);
                    }
                  }}
                  min={filterImportDateFrom || undefined}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-gray-400 transition-colors"
                  placeholder="To"
                />
              </div>
            )}
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={filterNoActivity}
                onChange={(e) => setFilterNoActivity(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-700">No Activity</span>
            </label>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || quickFilter || filterStatus || filterActionDate || filterActionDateFrom || filterActionDateTo || filterLastInteraction || filterLastInteractionFrom || filterLastInteractionTo || filterImportDate || filterImportDateFrom || filterImportDateTo || filterNoActivity || filterMatchType) && (
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
                    setFilterStatus('');
                  }}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filterStatus && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Status: {filterStatus}
                <button
                  onClick={() => setFilterStatus('')}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {(filterActionDate || filterActionDateFrom || filterActionDateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Action Date: {filterActionDate === 'custom' && (filterActionDateFrom || filterActionDateTo)
                  ? `${filterActionDateFrom ? formatDate(filterActionDateFrom) : '...'} to ${filterActionDateTo ? formatDate(filterActionDateTo) : '...'}`
                  : filterActionDate === 'today' ? 'Today'
                  : filterActionDate === 'this-week' ? 'This Week'
                  : filterActionDate === 'this-month' ? 'This Month'
                  : filterActionDate}
                <button
                  onClick={() => {
                    setFilterActionDate('');
                    setFilterActionDateFrom('');
                    setFilterActionDateTo('');
                  }}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {(filterLastInteraction || filterLastInteractionFrom || filterLastInteractionTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Last Interaction: {filterLastInteraction === 'custom' && (filterLastInteractionFrom || filterLastInteractionTo)
                  ? `${filterLastInteractionFrom ? formatDate(filterLastInteractionFrom) : '...'} to ${filterLastInteractionTo ? formatDate(filterLastInteractionTo) : '...'}`
                  : filterLastInteraction === 'today' ? 'Today'
                  : filterLastInteraction === 'this-week' ? 'This Week'
                  : filterLastInteraction === 'this-month' ? 'This Month'
                  : filterLastInteraction}
                <button
                  onClick={() => {
                    setFilterLastInteraction('');
                    setFilterLastInteractionFrom('');
                    setFilterLastInteractionTo('');
                  }}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {(filterImportDate || filterImportDateFrom || filterImportDateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                Import Date: {filterImportDate === 'custom' && (filterImportDateFrom || filterImportDateTo)
                  ? `${filterImportDateFrom ? formatDate(filterImportDateFrom) : '...'} to ${filterImportDateTo ? formatDate(filterImportDateTo) : '...'}`
                  : filterImportDate === 'today' ? 'Today'
                  : filterImportDate === 'yesterday' ? 'Yesterday'
                  : filterImportDate}
                <button
                  onClick={() => {
                    setFilterImportDate('');
                    setFilterImportDateFrom('');
                    setFilterImportDateTo('');
                  }}
                  className="hover:text-blue-900"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filterNoActivity && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                No Activity
                <button
                  onClick={() => setFilterNoActivity(false)}
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
                setFilterStatus('');
                setFilterActionDate('');
                setFilterActionDateFrom('');
                setFilterActionDateTo('');
                setFilterLastInteraction('');
                setFilterLastInteractionFrom('');
                setFilterLastInteractionTo('');
                setFilterImportDate('');
                setFilterImportDateFrom('');
                setFilterImportDateTo('');
                setFilterNoActivity(false);
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
            {(searchQuery || quickFilter || filterStatus || filterActionDate || filterActionDateFrom || filterActionDateTo || filterLastInteraction || filterLastInteractionFrom || filterLastInteractionTo || filterImportDate || filterImportDateFrom || filterImportDateTo || filterNoActivity || filterMatchType) && (
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

      {/* ICP Recommendations Summary - Shows when suggestions are enabled */}
      {showProspectSuggestions && hasICP && project?.icpDefinition && (
        <div className="mb-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-2 border-indigo-200 rounded-2xl p-5 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">ICP-Based Recommendations</h3>
                  <p className="text-sm text-gray-600 mt-0.5">Showing prospects from databank that match your project's Ideal Customer Profile</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {project.icpDefinition.targetIndustries && project.icpDefinition.targetIndustries.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Target Industries</div>
                    <div className="text-sm font-medium text-gray-900">
                      {project.icpDefinition.targetIndustries.slice(0, 2).join(', ')}
                      {project.icpDefinition.targetIndustries.length > 2 && ` +${project.icpDefinition.targetIndustries.length - 2} more`}
                    </div>
                  </div>
                )}
                {project.icpDefinition.targetJobTitles && project.icpDefinition.targetJobTitles.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Target Job Titles</div>
                    <div className="text-sm font-medium text-gray-900">
                      {project.icpDefinition.targetJobTitles.slice(0, 2).join(', ')}
                      {project.icpDefinition.targetJobTitles.length > 2 && ` +${project.icpDefinition.targetJobTitles.length - 2} more`}
                    </div>
                  </div>
                )}
                {project.icpDefinition.companySizeMin !== undefined && project.icpDefinition.companySizeMax !== undefined && (
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company Size</div>
                    <div className="text-sm font-medium text-gray-900">
                      {project.icpDefinition.companySizeMin.toLocaleString()} - {project.icpDefinition.companySizeMax.toLocaleString()} employees
                    </div>
                  </div>
                )}
                {project.icpDefinition.geographies && project.icpDefinition.geographies.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Geographies</div>
                    <div className="text-sm font-medium text-gray-900">
                      {project.icpDefinition.geographies.slice(0, 2).join(', ')}
                      {project.icpDefinition.geographies.length > 2 && ` +${project.icpDefinition.geographies.length - 2} more`}
                    </div>
                  </div>
                )}
              </div>

              {matchStats && (
                <div className="mt-4 flex items-center gap-4 flex-wrap">
                  <div className="text-xs text-gray-600 font-medium">
                    Recommendations: 
                    <span className="ml-2 inline-flex items-center gap-2">
                      {matchStats.exact > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full font-semibold">
                          {matchStats.exact} Exact
                        </span>
                      )}
                      {matchStats.good > 0 && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
                          {matchStats.good} Good
                        </span>
                      )}
                      {matchStats.similar > 0 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
                          {matchStats.similar} Similar
                        </span>
                      )}
                      {matchStats.loose > 0 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full font-semibold">
                          {matchStats.loose} Loose
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                      Status
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
                  
                  // Get contact ID for filtering (define before using)
                  const contactIdValue = contact._id?.toString ? contact._id.toString() : contact._id;
                  
                  // Get last interaction and next action using pre-computed lookups (much faster)
                  let contactLastActivity = null;
                  let nextActionActivity = null;
                  let latestStatusData = null;
                  
                  if (contactIdValue) {
                    const contactIdStr = contactIdValue.toString ? contactIdValue.toString() : String(contactIdValue);
                    // Fast lookup by contactId
                    contactLastActivity = activityLookups.lastActivityByContactId.get(contactIdStr) || null;
                    nextActionActivity = activityLookups.nextActionByContactId.get(contactIdStr) || null;
                    latestStatusData = activityLookups.latestActivityStatusByContactId.get(contactIdStr) || null;
                  }
                  let latestStatus = latestStatusData?.status || null;
                  
                  // Fallback to name/email matching only if contactId lookup failed AND contactId is not available
                  // This ensures data isolation - only use fallback when absolutely necessary
                  if ((!contactLastActivity || !nextActionActivity || !latestStatusData) && !contactIdValue) {
                    const contactNameLower = contact.name?.toLowerCase() || '';
                    const contactEmailLower = contact.email?.toLowerCase() || '';
                    
                    if (!contactLastActivity && (contactNameLower || contactEmailLower)) {
                      contactLastActivity = allProjectActivities
                        .filter(a => {
                          // Only use notes matching if contactId is not set in activity
                          if (a.contactId) return false; // Skip if activity has contactId (should be matched by contactId)
                          const notesLower = a.conversationNotes?.toLowerCase() || '';
                          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
                        })
                        .sort((a, b) => getActivityDate(b) - getActivityDate(a))[0];
                    }
                    
                    if (!nextActionActivity && (contactNameLower || contactEmailLower)) {
                      const now = new Date();
                      nextActionActivity = allProjectActivities
                        .filter(a => {
                          if (!a.nextActionDate || new Date(a.nextActionDate) < now) return false;
                          // Only use notes matching if contactId is not set in activity
                          if (a.contactId) return false; // Skip if activity has contactId (should be matched by contactId)
                          const notesLower = a.conversationNotes?.toLowerCase() || '';
                          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
                        })
                        .sort((a, b) => new Date(a.nextActionDate) - new Date(b.nextActionDate))[0];
                    }
                    
                    // Fallback for status: find most recent activity with status by name/email matching
                    if (!latestStatusData && (contactNameLower || contactEmailLower)) {
                      const activitiesWithStatus = allProjectActivities
                        .filter(a => {
                          // Only use notes matching if contactId is not set in activity
                          if (a.contactId) return false;
                          if (!a.status || a.status.trim() === '') return false;
                          const notesLower = a.conversationNotes?.toLowerCase() || '';
                          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
                        })
                        .sort((a, b) => getActivityDate(b) - getActivityDate(a));
                      
                      if (activitiesWithStatus.length > 0) {
                        latestStatus = activitiesWithStatus[0].status;
                      }
                    }
                  }
                  
                  // Determine the status to display - prioritize latest activity status over database stage
                  // Always use the most recent activity status if available, otherwise use contact.stage, then default to 'New'
                  const displayStatus = latestStatus || contact.stage || 'New';
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className={`text-sm font-semibold ${isFromDatabank ? 'text-gray-900 hover:text-blue-600' : 'text-gray-900'}`}>
                                  {contact.name || 'N/A'}
                                </div>
                                {/* Recommendation Badge - Show only for suggestions (not imported) */}
                                {!contact.isImported && contact.recommendationReasons && contact.recommendationReasons.length > 0 && (
                                  <div className="group relative">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                      contact.matchType === 'exact' ? 'bg-green-100 text-green-800' :
                                      contact.matchType === 'good' ? 'bg-blue-100 text-blue-800' :
                                      contact.matchType === 'similar' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                      </svg>
                                      {contact.matchScore}% Match
                                    </span>
                                    {/* Recommendation Tooltip */}
                                    <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                                      <div className="absolute -top-2 left-4 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
                                      <div className="relative">
                                        <h4 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                          </svg>
                                          Recommended Based on ICP
                                        </h4>
                                        <div className="space-y-2">
                                          {contact.recommendationReasons.map((reason, idx) => (
                                            <div key={idx} className="text-xs text-gray-700 bg-gray-50 rounded p-2 border-l-2 border-blue-500">
                                              <div className="font-semibold text-gray-900 mb-1 capitalize">
                                                {reason.type === 'industry' && '🏭 Industry Match'}
                                                {reason.type === 'jobTitle' && '💼 Job Title Match'}
                                                {reason.type === 'companySize' && '📊 Company Size Match'}
                                                {reason.type === 'geography' && '🌍 Location Match'}
                                                {reason.type === 'keywords' && '🔑 Keywords Match'}
                                              </div>
                                              <div className="text-gray-600">{reason.message}</div>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-gray-200">
                                          <div className="text-xs text-gray-500">
                                            <span className="font-semibold">Match Score:</span> {contact.matchScore}% ({contact.matchType})
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
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
                          {getStageBadge(displayStatus)}
                          {latestStatus && latestStatus !== contact.stage && (
                            <div className="text-xs text-gray-400 mt-1">
                              From latest activity
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {contactLastActivity ? (
                            <div>
                              <div className="text-sm text-gray-900 font-medium">
                                {formatDate(getActivityDate(contactLastActivity))}
                              </div>
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
                        <tr className="animate-fade-in">
                          <td colSpan="8" className="px-6 py-4 bg-blue-50 border-t-2 border-blue-200 transition-all duration-300">
                            {isLoadingActivities ? (
                              <div className="flex items-center justify-center py-8 animate-fade-in">
                                <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                  <span className="text-xs text-gray-500">Loading activities...</span>
                                </div>
                              </div>
                            ) : (
                              <div className="animate-fade-in-up">
                              <ContactActivitySummary contact={contact} activities={activities} />
                              </div>
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
        lastActivity={activityModal.lastActivity}
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
