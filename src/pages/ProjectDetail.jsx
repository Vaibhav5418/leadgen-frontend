import React, { useState, useEffect, useMemo, useCallback, startTransition, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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

// Normalize to start-of-day (local) for date-only comparison — avoids timezone issues
// when e.g. nextActionDate is stored as UTC midnight and "today" should count as current.
const toDateOnly = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Avoid noisy logs in production
const devLog = (...args) => {
  try {
    // Vite injects import.meta.env.DEV
    if (import.meta?.env?.DEV) console.log(...args);
  } catch (_) {
    // ignore
  }
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

// Simple in-memory cache for heavy project detail data (per browser tab)
// Keyed by projectId so second visits are much faster.
const projectDetailCache = {};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL params
  const [project, setProject] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef(null);
  const hasInitializedSearchEffect = useRef(false);
  const hasInitializedFilterEffect = useRef(false);
  const [quickFilter, setQuickFilter] = useState(searchParams.get('quickFilter') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('filterStatus') || '');
  const [filterActionDate, setFilterActionDate] = useState(searchParams.get('filterActionDate') || '');
  const [filterActionDateFrom, setFilterActionDateFrom] = useState(searchParams.get('filterActionDateFrom') || '');
  const [filterActionDateTo, setFilterActionDateTo] = useState(searchParams.get('filterActionDateTo') || '');
  const [filterLastInteraction, setFilterLastInteraction] = useState(searchParams.get('filterLastInteraction') || '');
  const [filterLastInteractionFrom, setFilterLastInteractionFrom] = useState(searchParams.get('filterLastInteractionFrom') || '');
  const [filterLastInteractionTo, setFilterLastInteractionTo] = useState(searchParams.get('filterLastInteractionTo') || '');
  const [filterImportDate, setFilterImportDate] = useState(searchParams.get('filterImportDate') || '');
  const [filterImportDateFrom, setFilterImportDateFrom] = useState(searchParams.get('filterImportDateFrom') || '');
  const [filterImportDateTo, setFilterImportDateTo] = useState(searchParams.get('filterImportDateTo') || '');
  const [filterNoActivity, setFilterNoActivity] = useState(searchParams.get('filterNoActivity') === 'true');
  const [filterMatchType, setFilterMatchType] = useState(searchParams.get('filterMatchType') || '');
  const [filterKpi, setFilterKpi] = useState(null); // { channel: 'linkedin'|'call'|'email', metric: string }
  const [selectedPipeline, setSelectedPipeline] = useState('linkedin'); // 'linkedin' | 'call' | 'email'
  const [kpiProspectModal, setKpiProspectModal] = useState({
    isOpen: false,
    filter: null // { channel: 'linkedin'|'call'|'email', metric: string }
  });

  // Keep KPI filter state in URL so returning from Activity History preserves the KPI view
  const openKpiProspectModal = useCallback((filter) => {
    setKpiProspectModal({ isOpen: true, filter });
    setFilterKpi(filter);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('kpiChannel', filter.channel);
    newParams.set('kpiMetric', filter.metric);
    newParams.set('kpiOpen', '1');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeKpiProspectModal = useCallback(() => {
    setKpiProspectModal({ isOpen: false, filter: null });
    setFilterKpi(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('kpiChannel');
    newParams.delete('kpiMetric');
    newParams.delete('kpiOpen');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);
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
  const [kpiMetrics, setKpiMetrics] = useState(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [sortBy, setSortBy] = useState(null); // 'name' | null
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const statusFilterRef = useRef(null);

  // Determine enabled activity types based on project channels
  const enabledActivityTypes = useMemo(() => {
    if (!project?.channels) return ['call', 'email', 'linkedin']; // Default to all if no channels defined
    
    const enabled = [];
    if (project.channels.coldCalling) enabled.push('call');
    if (project.channels.coldEmail) enabled.push('email');
    if (project.channels.linkedInOutreach) enabled.push('linkedin');
    
    // If no channels are enabled, default to all (for backward compatibility)
    return enabled.length > 0 ? enabled : ['call', 'email', 'linkedin'];
  }, [project?.channels]);

  // Calculate follow-up counts for LinkedIn and Email (backend provides for calls via KPI).
  // Use one next action per contact per type (earliest nextActionDate) so each contact is counted at most once.
  // Bucket by next action date: today, tomorrow, missed (based on nextActionDate).
  const linkedinEmailFollowups = useMemo(() => {
    if (!allProjectActivities || allProjectActivities.length === 0) {
      return { linkedin: { today: 0, tomorrow: 0, missed: 0 }, email: { today: 0, tomorrow: 0, missed: 0 } };
    }

    const todayStart = toDateOnly(new Date());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrowStart = new Date(tomorrowStart);
    dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

    const earliestByContactByType = { linkedin: new Map(), email: new Map() };

    allProjectActivities.forEach(activity => {
      if (!activity.nextActionDate || !activity.contactId) return;
      const contactIdStr = activity.contactId.toString ? activity.contactId.toString() : activity.contactId;
      const d = toDateOnly(activity.nextActionDate);

      if (activity.type === 'linkedin') {
        const m = earliestByContactByType.linkedin;
        const existing = m.get(contactIdStr);
        if (!existing || d < existing) m.set(contactIdStr, d);
      } else if (activity.type === 'email') {
        const m = earliestByContactByType.email;
        const existing = m.get(contactIdStr);
        if (!existing || d < existing) m.set(contactIdStr, d);
      }
    });

    const countBuckets = (m) => {
      let today = 0, tomorrow = 0, missed = 0;
      m.forEach((d) => {
        if (d >= todayStart && d < tomorrowStart) today += 1;
        else if (d >= tomorrowStart && d < dayAfterTomorrowStart) tomorrow += 1;
        else if (d < todayStart) missed += 1;
      });
      return { today, tomorrow, missed };
    };

    return {
      linkedin: countBuckets(earliestByContactByType.linkedin),
      email: countBuckets(earliestByContactByType.email)
    };
  }, [allProjectActivities]);

  // Auto-select first enabled pipeline if current selection is not enabled
  useEffect(() => {
    if (enabledActivityTypes.length > 0 && !enabledActivityTypes.includes(selectedPipeline)) {
      setSelectedPipeline(enabledActivityTypes[0]);
    }
  }, [enabledActivityTypes, selectedPipeline]);

  // Close status filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target)) {
        setShowStatusFilter(false);
      }
    };

    if (showStatusFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusFilter]);

  // Debounce search query for better performance
  // Initialize debounced search query from URL params on mount and when URL changes
  // This ensures search filter works when returning from Activity History
  useEffect(() => {
    const searchParam = searchParams.get('search') || '';
    // Only update if it's different to avoid unnecessary re-renders
    // Update both searchQuery and debouncedSearchQuery immediately when URL changes
    // (e.g., when returning from Activity History)
    if (searchParam !== searchQuery) {
      // Clear any pending debounce timeout to avoid conflicts
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      setSearchQuery(searchParam);
      // Set debouncedSearchQuery immediately (skip debounce) when coming from URL
      setDebouncedSearchQuery(searchParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Run when searchParams changes (e.g., when returning from Activity History)

  useEffect(() => {
    // Skip debounce if searchQuery matches the URL param (means it was set from URL, not user typing)
    const urlSearchParam = searchParams.get('search') || '';
    if (searchQuery === urlSearchParam && searchQuery === debouncedSearchQuery) {
      // Already in sync, no need to debounce
      return;
    }
    
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
  }, [searchQuery, searchParams, debouncedSearchQuery]);

  useEffect(() => {
    if (id) {
      // Only reset filters when landing fresh. If returning from Activity History (returnTo)
      // or restoring a KPI view (kpiChannel/kpiMetric), keep state.
      const hasAnyUrlState =
        !!searchParams.get('returnTo') ||
        !!searchParams.get('page') ||
        !!searchParams.get('kpiChannel') ||
        !!searchParams.get('kpiMetric') ||
        searchParams.get('kpiOpen') === '1';

      if (!hasAnyUrlState) {
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
        setFilterKpi(null);
        setKpiProspectModal({ isOpen: false, filter: null });

        // Clear filter URL params (fresh landing)
        setSearchParams(new URLSearchParams(), { replace: true });
      }
      
      const cacheEntry = projectDetailCache[id];

      if (cacheEntry) {
        // Serve cached data for instant second loads
        if (cacheEntry.project) setProject(cacheEntry.project);
        if (cacheEntry.kpiMetrics) setKpiMetrics(cacheEntry.kpiMetrics);
        if (cacheEntry.contacts) setContacts(cacheEntry.contacts);
        if (cacheEntry.allProjectActivities) setAllProjectActivities(cacheEntry.allProjectActivities);
        setLoading(false);
      }

      // Always refresh in background to keep data up to date
      fetchProject().then(() => {
        // Get page from URL params or default to 1
        const pageFromUrl = searchParams.get('page');
        const initialPage = pageFromUrl ? parseInt(pageFromUrl, 10) : 1;
        
        // Update contactsPage state to match URL
        if (initialPage !== contactsPage) {
          setContactsPage(initialPage);
        }
        
        // Fetch contacts, activities, and KPI metrics in parallel for better performance
        Promise.all([
        fetchAllProjectActivities().catch(err => {
          console.error('Error fetching activities:', err);
          }),
          fetchImportedContacts(initialPage).catch(err => {
          console.error('Error fetching imported contacts:', err);
          }),
          fetchKpiMetrics().catch(err => {
            console.error('Error fetching KPI metrics:', err);
          })
        ]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Restore KPI modal + filter from URL params (so Back returns to the same KPI view)
  useEffect(() => {
    if (!id) return;
    const kpiChannel = searchParams.get('kpiChannel');
    const kpiMetric = searchParams.get('kpiMetric');
    const kpiOpen = searchParams.get('kpiOpen') === '1';

    if (kpiChannel && kpiMetric) {
      const nextFilter = { channel: kpiChannel, metric: kpiMetric };
      setFilterKpi(nextFilter);
      if (kpiOpen) {
        setKpiProspectModal({ isOpen: true, filter: nextFilter });
      } else {
        // If params exist but modal shouldn't be open, ensure modal is closed
        setKpiProspectModal(prev => prev.isOpen ? { isOpen: false, filter: null } : prev);
      }
    } else {
      // Clear KPI state if params are removed from URL
      setFilterKpi(null);
      setKpiProspectModal({ isOpen: false, filter: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams]);

  // True when any filter or search is active — we fetch all contacts and paginate client-side over filtered results
  // Must be defined before useEffect hooks that use it
  const hasFiltersOrSearch = useMemo(() => !!(
    debouncedSearchQuery ||
    quickFilter ||
    filterStatus ||
    filterActionDate ||
    filterActionDateFrom ||
    filterActionDateTo ||
    filterLastInteraction ||
    filterLastInteractionFrom ||
    filterLastInteractionTo ||
    filterImportDate ||
    filterImportDateFrom ||
    filterImportDateTo ||
    filterNoActivity ||
    filterMatchType ||
    filterKpi
  ), [debouncedSearchQuery, quickFilter, filterStatus, filterActionDate, filterActionDateFrom, filterActionDateTo, filterLastInteraction, filterLastInteractionFrom, filterLastInteractionTo, filterImportDate, filterImportDateFrom, filterImportDateTo, filterNoActivity, filterMatchType, filterKpi]);

  // When search query changes, fetch matching contacts
  useEffect(() => {
    if (!id) return;

    // Skip the first run so we don't override page restored from URL
    if (!hasInitializedSearchEffect.current) {
      hasInitializedSearchEffect.current = true;
      return;
    }

    // Reset to page 1 when search actually changes
    setContactsPage(1);

    // Update URL to remove page param when search changes
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });

    // Fetch contacts with search query (backend handles filtering)
    fetchImportedContacts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, id]);

  // Restore page from URL params when URL changes (e.g., returning from navigation)
  useEffect(() => {
    if (!id) return;
    
    const pageParam = searchParams.get('page');
    const pageNum = pageParam ? parseInt(pageParam, 10) : 1;
    
    if (pageNum !== contactsPage && pageNum >= 1) {
      const timeoutId = setTimeout(() => {
        if (pageNum !== contactsPage) {
          setContactsPage(pageNum);
          // Only fetch when using API pagination (no filters/search)
          if (!hasFiltersOrSearch) {
            fetchImportedContacts(pageNum);
          }
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('page'), id, searchParams, hasFiltersOrSearch]);

  // When filters (non-search) change: refetch all or page 1, reset to page 1, clear page param.
  // Also refetch when debouncedSearchQuery changes (e.g., when returning from Activity History with search param)
  useEffect(() => {
    if (!id) return;
    if (!hasInitializedFilterEffect.current) {
      hasInitializedFilterEffect.current = true;
      return;
    }
    setContactsPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    setSearchParams(newParams, { replace: true });
    fetchImportedContacts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickFilter, filterStatus, filterActionDate, filterActionDateFrom, filterActionDateTo, filterLastInteraction, filterLastInteractionFrom, filterLastInteractionTo, filterImportDate, filterImportDateFrom, filterImportDateTo, filterNoActivity, filterMatchType, filterKpi, debouncedSearchQuery, id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/projects/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setProject(data);
        projectDetailCache[id] = {
          ...(projectDetailCache[id] || {}),
          project: data,
        };
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Having trouble loading the project. Refresh the page and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch KPI metrics for the project
  const fetchKpiMetrics = async () => {
    try {
      setLoadingKpi(true);
      const response = await API.get(`/projects/${id}/kpi-metrics`);
      if (response.data.success) {
        const data = response.data.data;
        setKpiMetrics(data);
        projectDetailCache[id] = {
          ...(projectDetailCache[id] || {}),
          kpiMetrics: data,
        };
      }
    } catch (err) {
      console.error('Error fetching KPI metrics:', err);
    } finally {
      setLoadingKpi(false);
    }
  };

  // Pagination state - initialize from URL params
  const [contactsPage, setContactsPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsTotalPages, setContactsTotalPages] = useState(1);
  const CONTACTS_PER_PAGE = 50; // Load 50 contacts per page

  // Fetch only imported contacts (contacts already linked to project) with pagination
  const fetchImportedContacts = async (page = 1) => {
    try {
      setLoading(true);
      
      // When filters or search active: fetch all, then paginate over filtered results client-side
      // Otherwise: normal API pagination
      const limit = hasFiltersOrSearch ? 10000 : CONTACTS_PER_PAGE;
      const fetchPage = hasFiltersOrSearch ? 1 : page;
      const searchParam = debouncedSearchQuery ? `&search=${encodeURIComponent(debouncedSearchQuery)}` : '';
      
      const response = await API.get(`/projects/${id}/project-contacts?page=${fetchPage}&limit=${limit}${searchParam}`);
      if (response.data.success) {
        const contactsData = response.data.data || [];
        const pagination = response.data.pagination || {};
        
        // Update pagination info
        setContactsTotal(pagination.total || contactsData.length);
        setContactsTotalPages(pagination.totalPages || 1);
        setContactsPage(page);
        
        // Deduplicate contacts by _id (contact ID) - ensure each contact appears only once
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
            const existingHasProjectContact = existing.projectContactId !== null && existing.projectContactId !== undefined;
            const newHasProjectContact = contact.projectContactId !== null && contact.projectContactId !== undefined;
            
            if (newHasProjectContact && !existingHasProjectContact) {
              // New one is imported (has projectContactId), existing is activity-based - replace
              contactsMap.set(contactId, contact);
            }
          }
        });
        
        // Convert map back to array - this ensures each contact appears only once
        let uniqueContacts = Array.from(contactsMap.values());
        
        // Also filter out any contacts that were previously deleted (prevent reappearance)
        if (deletedContactIds.size > 0) {
          uniqueContacts = uniqueContacts.filter(contact => {
            if (!contact._id) return true;
            const contactIdStr = contact._id.toString ? contact._id.toString() : String(contact._id);
            return !deletedContactIds.has(contactIdStr);
          });
        }
        
        setContacts(uniqueContacts);
        
        if (page === 1 && !debouncedSearchQuery) {
          projectDetailCache[id] = {
            ...(projectDetailCache[id] || {}),
            contacts: uniqueContacts,
          };
        }
      }
    } catch (err) {
      console.error('Error fetching imported contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle page change - update URL params; only fetch when not filtering (API pagination)
  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || newPage === contactsPage) return;
    const newParams = new URLSearchParams(searchParams);
    if (newPage === 1) {
      newParams.delete('page');
    } else {
      newParams.set('page', newPage.toString());
    }
    setSearchParams(newParams, { replace: true });
    setContactsPage(newPage);
    if (!hasFiltersOrSearch) {
      fetchImportedContacts(newPage);
    }
  }, [contactsPage, hasFiltersOrSearch, searchParams, setSearchParams]);

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
            devLog(`Filtered out ${beforeFilter - contactsData.length} previously deleted contact(s) from similar contacts`);
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

  // Sync filter states to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    
    // Only add params that have values
    if (searchQuery) params.set('search', searchQuery);
    if (quickFilter) params.set('quickFilter', quickFilter);
    if (filterStatus) params.set('filterStatus', filterStatus);
    if (filterActionDate) params.set('filterActionDate', filterActionDate);
    if (filterActionDateFrom) params.set('filterActionDateFrom', filterActionDateFrom);
    if (filterActionDateTo) params.set('filterActionDateTo', filterActionDateTo);
    if (filterLastInteraction) params.set('filterLastInteraction', filterLastInteraction);
    if (filterLastInteractionFrom) params.set('filterLastInteractionFrom', filterLastInteractionFrom);
    if (filterLastInteractionTo) params.set('filterLastInteractionTo', filterLastInteractionTo);
    if (filterImportDate) params.set('filterImportDate', filterImportDate);
    if (filterImportDateFrom) params.set('filterImportDateFrom', filterImportDateFrom);
    if (filterImportDateTo) params.set('filterImportDateTo', filterImportDateTo);
    if (filterNoActivity) params.set('filterNoActivity', 'true');
    if (filterMatchType) params.set('filterMatchType', filterMatchType);
    
    // Update URL without causing a navigation
    setSearchParams(params, { replace: true });
  }, [searchQuery, quickFilter, filterStatus, filterActionDate, filterActionDateFrom, filterActionDateTo, 
      filterLastInteraction, filterLastInteractionFrom, filterLastInteractionTo, 
      filterImportDate, filterImportDateFrom, filterImportDateTo, filterNoActivity, filterMatchType, setSearchParams]);

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
      // Fetch activities for KPI filtering
      // Limit to 5000 for better performance - should cover most projects
      const response = await API.get(`/activities/project/${id}?limit=5000`);
      if (response.data.success) {
        const activities = response.data.data || [];
        setAllProjectActivities(activities);
        projectDetailCache[id] = {
          ...(projectDetailCache[id] || {}),
          allProjectActivities: activities,
        };
        // Refresh KPI metrics when activities are updated
        fetchKpiMetrics();
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
        
        // Track next action: prefer earliest future-or-today; if none, use most recent overdue
        if (activity.nextActionDate) {
          const actionDate = toDateOnly(activity.nextActionDate);
          const todayStart = toDateOnly(now);
          const existing = lookups.nextActionByContactId.get(contactIdStr);
          const existingDate = existing ? toDateOnly(existing.nextActionDate) : null;
          const existingIsOverdue = existingDate != null && existingDate < todayStart;

          if (actionDate >= todayStart) {
            // Future or today — always prefer over overdue; among future keep earliest
            if (!existing || existingIsOverdue || existingDate > actionDate) {
              lookups.nextActionByContactId.set(contactIdStr, activity);
            }
          } else {
            // Overdue — use only when no future/today exists; keep most recent overdue
            if (!existing) {
              lookups.nextActionByContactId.set(contactIdStr, activity);
            } else if (existingIsOverdue && actionDate > existingDate) {
              lookups.nextActionByContactId.set(contactIdStr, activity);
            }
          }
        }
        
        // Track latest activity status (for all activity types - call, email, linkedin)
        // This determines the stage based on the most recent activity status from Activity History
        // For call activities, use callStatus; for others, use status
        // Use activity-specific date (callDate, emailDate, linkedinDate) to determine most recent status
        let activityStatus = null;
        if (activity.type === 'call' && activity.callStatus && activity.callStatus.trim() !== '') {
          // For call activities, use callStatus
          activityStatus = activity.callStatus;
        } else if (activity.status && activity.status.trim() !== '') {
          // For email and LinkedIn activities, use status
          activityStatus = activity.status;
        }
        
        if (activityStatus) {
          const existing = lookups.latestActivityStatusByContactId.get(contactIdStr);
          // Get the activity date (prioritize activity-specific dates over createdAt)
          const activityDate = getActivityDate(activity);
          // Only update if this activity is more recent than the existing one
          if (!existing) {
            lookups.latestActivityStatusByContactId.set(contactIdStr, {
              status: activityStatus,
              createdAt: activityDate,
              activityDate: activityDate
            });
          } else {
            const existingDate = existing.activityDate ? new Date(existing.activityDate) : new Date(existing.createdAt);
            if (activityDate > existingDate) {
              lookups.latestActivityStatusByContactId.set(contactIdStr, {
                status: activityStatus,
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

  const handleCloseActivityModal = async (shouldNavigateBack = false) => {
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
      // Call statuses
      'Ring': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'Busy': { bg: 'bg-orange-100', text: 'text-orange-800' },
      'Call Back': { bg: 'bg-amber-100', text: 'text-amber-800' },
      'Hang Up': { bg: 'bg-red-100', text: 'text-red-800' },
      'Switch Off': { bg: 'bg-gray-100', text: 'text-gray-800' },
      'Invalid': { bg: 'bg-red-100', text: 'text-red-800' },
      'Future': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'Existing': { bg: 'bg-indigo-100', text: 'text-indigo-800' },
      'Interested': { bg: 'bg-green-100', text: 'text-green-800' },
      'Not Interested': { bg: 'bg-red-100', text: 'text-red-800' },
      'Details Shared': { bg: 'bg-cyan-100', text: 'text-cyan-800' },
      'Demo Booked': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'Demo Completed': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
      // Email and LinkedIn statuses
      'CIP': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'No Reply': { bg: 'bg-gray-100', text: 'text-gray-800' },
      'Out of Office': { bg: 'bg-gray-100', text: 'text-gray-800' },
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
      'Wrong Person': { bg: 'bg-red-100', text: 'text-red-800' },
      'Bounce': { bg: 'bg-red-100', text: 'text-red-800' },
      'Opt-Out': { bg: 'bg-red-100', text: 'text-red-800' },
      // Legacy stages for backward compatibility
      'New': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'Contacted': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'Qualified': { bg: 'bg-green-100', text: 'text-green-800' },
      'Proposal': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'Negotiation': { bg: 'bg-orange-100', text: 'text-orange-800' }
    };
    const config = stageConfig[stage] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    return (
      <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${config.bg} ${config.text} ${config.border || ''}`}>
        {stage || 'New'}
      </span>
    );
  };

  const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    // Handle both Date objects and date strings
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateInput) => {
    if (!dateInput) return 'N/A';
    // Handle both Date objects and date strings
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';
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
                .sort((a, b) => getActivityDate(b) - getActivityDate(a))
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
                    {activity.conversationNotes && (() => {
                      // Remove contact information block if present
                      const notes = activity.conversationNotes.replace(/\[Contact:.*?\|.*?Email:.*?\|.*?Phone:.*?\|.*?LinkedIn:.*?\]/g, '').trim();
                      // Also remove standalone contact info blocks
                      const cleanedNotes = notes.replace(/\[Contact:.*?\]/g, '').trim();
                      return cleanedNotes ? (
                    <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap leading-relaxed">
                          {cleanedNotes}
                    </p>
                      ) : null;
                    })()}
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
                    {formatDateTime(getActivityDate(activity))}
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
  // Note: Search is now handled server-side, so backend already returns filtered results
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
    // Search is handled server-side, so we don't need to filter here
    // Backend already returns only matching contacts when search query is provided

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
          case 'tomorrow':
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
            if (actionDate < tomorrow || actionDate >= dayAfterTomorrow) return false;
            break;
          case 'this-week':
            // Calculate week start (Monday) and end (Sunday)
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6 days from Monday
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);
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
          case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (interactionDate < yesterday || interactionDate >= today) return false;
            break;
          case 'this-week':
            // Calculate week start (Monday) and end (Sunday)
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6 days from Monday
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);
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

    // KPI filter - filter by channel and metric type
    if (filterKpi) {
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      const contactActivities = allProjectActivities.filter(a => {
        const activityProjectId = a.projectId?.toString ? a.projectId.toString() : a.projectId;
        if (activityProjectId !== id) return false;
        
        if (contactIdStr && a.contactId) {
          const activityContactIdStr = a.contactId.toString ? a.contactId.toString() : a.contactId;
          if (activityContactIdStr === contactIdStr) return true;
        }
        
        // Fallback to notes matching
        if (!contactIdStr || !a.contactId) {
          const notesLower = a.conversationNotes?.toLowerCase() || '';
          const contactNameLower = contact.name?.toLowerCase() || '';
          const contactEmailLower = contact.email?.toLowerCase() || '';
          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
        }
        return false;
      });

      let hasMatchingActivity = false;
      
      if (filterKpi.channel === 'linkedin') {
        // Backend uses type: 'linkedin'
        const linkedinActivities = contactActivities.filter(a => a.type === 'linkedin');
        if (filterKpi.metric === 'connectionSent') {
          hasMatchingActivity = linkedinActivities.some(a => a.lnRequestSent === true || a.lnRequestSent === 'Yes');
        } else if (filterKpi.metric === 'accepted') {
          hasMatchingActivity = linkedinActivities.some(a => a.connected === true || a.connected === 'Yes');
        } else if (filterKpi.metric === 'followUps') {
          hasMatchingActivity = linkedinActivities.length > 1;
        } else if (filterKpi.metric === 'cip') {
          hasMatchingActivity = linkedinActivities.some(a => 
            a.status && (a.status === 'CIP' || a.status === 'Conversations in Progress')
          );
        } else if (filterKpi.metric === 'meetingProposed') {
          hasMatchingActivity = linkedinActivities.some(a => a.status === 'Meeting Proposed');
        } else if (filterKpi.metric === 'scheduled') {
          hasMatchingActivity = linkedinActivities.some(a => a.status === 'Meeting Scheduled');
        } else if (filterKpi.metric === 'completed') {
          hasMatchingActivity = linkedinActivities.some(a => a.status === 'Meeting Completed');
        } else if (filterKpi.metric === 'sql') {
          hasMatchingActivity = contact.stage === 'SQL';
        } else if (filterKpi.metric === 'win') {
          hasMatchingActivity = contact.stage === 'WON';
        }
        // Legacy metrics
        else if (filterKpi.metric === 'connectionRequestsSent') {
          hasMatchingActivity = linkedinActivities.some(a => a.lnRequestSent === true || a.lnRequestSent === 'Yes');
        } else if (filterKpi.metric === 'connectionAcceptanceRate') {
          hasMatchingActivity = linkedinActivities.some(a => a.connected === true || a.connected === 'Yes');
        } else if (filterKpi.metric === 'messagesSent') {
          hasMatchingActivity = linkedinActivities.some(a => a.status && a.status !== '');
        } else if (filterKpi.metric === 'messageReplyRate') {
          hasMatchingActivity = linkedinActivities.some(a => 
            a.status && ['Meeting Proposed', 'Meeting Scheduled', 'Meeting Completed', 'SQL', 'Tech Discussion'].includes(a.status)
          );
        } else if (filterKpi.metric === 'meetingsBooked') {
          hasMatchingActivity = linkedinActivities.some(a => 
            a.status && ['Meeting Scheduled', 'Meeting Completed', 'In-Person Meeting'].includes(a.status)
          );
        }
      } else if (filterKpi.channel === 'call') {
        // Backend uses type: 'call' and callStatus field (not status)
        const callActivities = contactActivities.filter(a => a.type === 'call');
        if (filterKpi.metric === 'allProspects') {
          // Show all prospects (no filtering)
          hasMatchingActivity = true;
        } else if (filterKpi.metric === 'callsAttempted') {
          // All call activities
          hasMatchingActivity = callActivities.length > 0;
        } else if (filterKpi.metric === 'totalCalls') {
          // Total Calls = total call activities (backend: callsMade)
          hasMatchingActivity = callActivities.length > 0;
        } else if (filterKpi.metric === 'callsConnected') {
          // Calls that were answered (not Ring, Busy, Switch Off, Invalid, Hang Up)
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up'].includes(a.callStatus)
          );
        } else if (filterKpi.metric === 'decisionMakerReached') {
          // Calls that reached decision maker (answered and not Not Interested)
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up', 'Not Interested'].includes(a.callStatus)
          );
        } else if (filterKpi.metric === 'interested') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Interested');
        } else if (filterKpi.metric === 'notInterested') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Not Interested');
        } else if (filterKpi.metric === 'detailsShared') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Details Shared');
        } else if (filterKpi.metric === 'demoBooked') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Demo Booked');
        } else if (filterKpi.metric === 'demoCompleted') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Demo Completed');
        } else if (filterKpi.metric === 'sql') {
          // Check project contact stage
          hasMatchingActivity = contact.stage === 'SQL';
        } else if (filterKpi.metric === 'won') {
          // Check project contact stage
          hasMatchingActivity = contact.stage === 'WON';
        } else if (filterKpi.metric === 'callsMade') {
          // Legacy support
          hasMatchingActivity = callActivities.length > 0;
        } else if (filterKpi.metric === 'callAnswerRate') {
          // Legacy support
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up'].includes(a.callStatus)
          );
        } else if (filterKpi.metric === 'callInterestedRate') {
          // Legacy support
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && ['Interested', 'Details Shared', 'Demo Booked', 'Demo Completed'].includes(a.callStatus)
          );
        } else if (filterKpi.metric === 'meetingsBooked') {
          // Legacy support
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && ['Demo Booked', 'Demo Completed'].includes(a.callStatus)
          );
        }
      } else if (filterKpi.channel === 'email') {
        // Backend uses type: 'email'
        const emailActivities = contactActivities.filter(a => a.type === 'email');
        if (filterKpi.metric === 'emailsSent') {
          // Backend counts all email activities
          hasMatchingActivity = emailActivities.length > 0;
        } else if (filterKpi.metric === 'accepted') {
          // Accepted: emails that were opened (not bounced, opt-out, or no reply)
          hasMatchingActivity = emailActivities.some(a => 
            a.status && a.status !== 'Bounce' && a.status !== 'Opt-Out' && a.status !== 'No Reply'
          );
        } else if (filterKpi.metric === 'followups') {
          // Followups: contacts with more than 1 email activity
          hasMatchingActivity = emailActivities.length > 1;
        } else if (filterKpi.metric === 'cip') {
          // CIP: Conversations in Progress
          hasMatchingActivity = emailActivities.some(a => 
            a.status && (a.status === 'CIP' || a.status === 'Conversations in Progress')
          );
        } else if (filterKpi.metric === 'meetingProposed') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Meeting Proposed');
        } else if (filterKpi.metric === 'scheduled') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Meeting Scheduled');
        } else if (filterKpi.metric === 'completed') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Meeting Completed');
        } else if (filterKpi.metric === 'sql') {
          // SQL: check project contact stage
          hasMatchingActivity = contact.stage === 'SQL';
        } else if (filterKpi.metric === 'emailBounce') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Bounce');
        }
        // Legacy metrics (for backward compatibility)
        else if (filterKpi.metric === 'emailOpenRate') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && a.status !== 'Bounce' && a.status !== 'Opt-Out' && a.status !== 'No Reply'
          );
        } else if (filterKpi.metric === 'emailReplyRate') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && ['Meeting Proposed', 'Meeting Scheduled', 'Meeting Completed', 'SQL', 'Tech Discussion'].includes(a.status)
          );
        } else if (filterKpi.metric === 'meetingsBooked') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && ['Meeting Scheduled', 'Meeting Completed', 'In-Person Meeting'].includes(a.status)
          );
        }
      }
      
      if (!hasMatchingActivity) return false;
    }

    // Quick filters
    if (quickFilter === 'due-today') {
      // Find activities with nextActionDate due today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      
      // Check all activities for this contact to find any action due today
      const contactActivities = contactIdStr ? (activityLookups.byContactId.get(contactIdStr) || []) : [];
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
    }).sort((a, b) => {
      // Apply sorting if sortBy is set
      if (sortBy === 'name') {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        if (sortOrder === 'asc') {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      }
      return 0;
    });
  }, [contacts, debouncedSearchQuery, quickFilter, filterStatus, filterActionDate, filterActionDateFrom, filterActionDateTo, filterLastInteraction, filterLastInteractionFrom, filterLastInteractionTo, filterImportDate, filterImportDateFrom, filterImportDateTo, filterNoActivity, filterMatchType, filterKpi, allProjectActivities, project, activityLookups, id, sortBy, sortOrder]);

  // When filters/search active: paginate over filtered results (slice). Otherwise use filteredContacts as-is (one API page).
  const { paginatedFilteredContacts, filteredTotal, filteredTotalPages } = useMemo(() => {
    const total = filteredContacts.length;
    const totalPages = Math.max(1, Math.ceil(total / CONTACTS_PER_PAGE));
    if (hasFiltersOrSearch) {
      const start = (contactsPage - 1) * CONTACTS_PER_PAGE;
      const slice = filteredContacts.slice(start, start + CONTACTS_PER_PAGE);
      return { paginatedFilteredContacts: slice, filteredTotal: total, filteredTotalPages: totalPages };
    }
    return {
      paginatedFilteredContacts: filteredContacts,
      filteredTotal: contactsTotal,
      filteredTotalPages: contactsTotalPages
    };
  }, [filteredContacts, hasFiltersOrSearch, contactsPage, contactsTotal, contactsTotalPages]);

  // State to store all contacts for KPI filtering (not paginated)
  const [allContactsForKpi, setAllContactsForKpi] = useState([]);
  const [loadingAllContactsForKpi, setLoadingAllContactsForKpi] = useState(false);

  // Fetch all contacts for KPI filtering (without pagination)
  const fetchAllContactsForKpi = useCallback(async () => {
    try {
      setLoadingAllContactsForKpi(true);
      setAllContactsForKpi([]); // Clear previous data
      
      // Fetch all contacts by requesting a very high limit
      // The backend default is 10000, so we'll use that
      const response = await API.get(`/projects/${id}/project-contacts?page=1&limit=10000`);
      if (response.data.success) {
        const contactsData = response.data.data || [];
        const pagination = response.data.pagination || {};
        const total = pagination.total || contactsData.length;
        
        // If we got fewer contacts than the total, we need to fetch more pages
        let allContactsData = [...contactsData];
        
        if (contactsData.length < total && total > 10000) {
          // If total is more than 10000, we need to fetch additional pages
          const totalPages = Math.ceil(total / 10000);
          const additionalPages = [];
          
          for (let page = 2; page <= totalPages; page++) {
            try {
              const pageResponse = await API.get(`/projects/${id}/project-contacts?page=${page}&limit=10000`);
              if (pageResponse.data.success) {
                additionalPages.push(...(pageResponse.data.data || []));
              }
            } catch (pageErr) {
              console.error(`Error fetching page ${page} for KPI:`, pageErr);
            }
          }
          
          allContactsData = [...contactsData, ...additionalPages];
        }
        
        // Deduplicate contacts by _id (contact ID) - ensure each contact appears only once
        const contactsMap = new Map();
        
        allContactsData.forEach(contact => {
          const contactId = contact._id?.toString ? contact._id.toString() : String(contact._id);
          if (!contactId) return; // Skip contacts without IDs
          
          const existing = contactsMap.get(contactId);
          if (!existing) {
            // First occurrence - add it
            contactsMap.set(contactId, contact);
          } else {
            // Duplicate found - prefer the one with projectContactId (imported) over activity-based
            const existingHasProjectContact = existing.projectContactId !== null && existing.projectContactId !== undefined;
            const newHasProjectContact = contact.projectContactId !== null && contact.projectContactId !== undefined;
            
            if (newHasProjectContact && !existingHasProjectContact) {
              // New one is imported (has projectContactId), existing is activity-based - replace
              contactsMap.set(contactId, contact);
            }
          }
        });
        
        // Convert map back to array - this ensures each contact appears only once
        const uniqueContacts = Array.from(contactsMap.values());
        setAllContactsForKpi(uniqueContacts);
      }
    } catch (err) {
      console.error('Error fetching all contacts for KPI:', err);
      setAllContactsForKpi([]);
    } finally {
      setLoadingAllContactsForKpi(false);
    }
  }, [id]);

  // Function to get filtered prospects based on KPI filter - OPTIMIZED
  const getKpiFilteredProspects = useCallback((kpiFilter) => {
    if (!kpiFilter) return [];
    
    try {
      // Always use allContactsForKpi if available (it contains all contacts, not just paginated ones)
      // Only fall back to contacts if allContactsForKpi hasn't been loaded yet
      const contactsToFilter = allContactsForKpi.length > 0 ? allContactsForKpi : contacts;
      
      return contactsToFilter.filter(contact => {
        try {
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      
      // Use activityLookups for O(1) lookup instead of filtering all activities
      const allCachedActivities = contactIdStr ? (activityLookups.byContactId.get(contactIdStr) || []) : [];
      
      // Filter by projectId to ensure project-specific activities
      const contactActivities = allCachedActivities.filter(a => {
        const activityProjectId = a.projectId?.toString ? a.projectId.toString() : a.projectId;
        return activityProjectId === id;
      });
      
      // Fallback to notes matching only if no contactId match (should be rare)
      if (contactActivities.length === 0 && (!contactIdStr || contactIdStr === '')) {
        // Try to find activities by notes matching (fallback)
        const fallbackActivities = allProjectActivities.filter(a => {
          const activityProjectId = a.projectId?.toString ? a.projectId.toString() : a.projectId;
          if (activityProjectId !== id) return false;
          
          const notesLower = a.conversationNotes?.toLowerCase() || '';
          const contactNameLower = contact.name?.toLowerCase() || '';
          const contactEmailLower = contact.email?.toLowerCase() || '';
          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
        });
        
        if (fallbackActivities.length === 0) {
          return false; // No activities found for this contact
        }
        
        // Use fallback activities for this check
        const fallbackLinkedinActivities = fallbackActivities.filter(a => a.type === 'linkedin');
        const fallbackCallActivities = fallbackActivities.filter(a => a.type === 'call');
        const fallbackEmailActivities = fallbackActivities.filter(a => a.type === 'email');
        
        let hasMatchingActivity = false;
        
        if (kpiFilter.channel === 'linkedin') {
          if (kpiFilter.metric === 'connectionSent') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.lnRequestSent === true || a.lnRequestSent === 'Yes');
          } else if (kpiFilter.metric === 'accepted') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.connected === true || a.connected === 'Yes');
          } else if (kpiFilter.metric === 'followUps') {
            hasMatchingActivity = fallbackLinkedinActivities.length > 1;
          } else if (kpiFilter.metric === 'followups' || kpiFilter.metric === 'todayFollowups' || kpiFilter.metric === 'tomorrowFollowups' || kpiFilter.metric === 'missedFollowups') {
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            hasMatchingActivity = fallbackLinkedinActivities.some(a => {
              if (!a.nextActionDate) return false;
              try {
                const d = new Date(a.nextActionDate);
                if (isNaN(d.getTime())) return false; // Invalid date
                d.setHours(0, 0, 0, 0);
                if (kpiFilter.metric === 'followups') {
                  // Show all follow-ups (today, tomorrow, or missed)
                  return true;
                } else if (kpiFilter.metric === 'todayFollowups') {
                  return d >= today && d < tomorrow;
                } else if (kpiFilter.metric === 'tomorrowFollowups') {
                  return d >= tomorrow && d < dayAfterTomorrow;
                } else if (kpiFilter.metric === 'missedFollowups') {
                  return d < today;
                }
                return false;
              } catch (dateError) {
                console.error('Error parsing nextActionDate for LinkedIn activity:', dateError, a);
                return false;
              }
            });
          } else if (kpiFilter.metric === 'cip') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => 
              a.status && (a.status === 'CIP' || a.status === 'Conversations in Progress')
            );
          } else if (kpiFilter.metric === 'meetingProposed') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.status === 'Meeting Proposed');
          } else if (kpiFilter.metric === 'scheduled') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.status === 'Meeting Scheduled');
          } else if (kpiFilter.metric === 'completed') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.status === 'Meeting Completed');
          } else if (kpiFilter.metric === 'sql') {
            hasMatchingActivity = contact.stage === 'SQL';
          } else if (kpiFilter.metric === 'win') {
            hasMatchingActivity = contact.stage === 'WON';
          }
          // Legacy metrics
          else if (kpiFilter.metric === 'connectionRequestsSent') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.lnRequestSent === true || a.lnRequestSent === 'Yes');
          } else if (kpiFilter.metric === 'connectionAcceptanceRate') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.connected === true || a.connected === 'Yes');
          } else if (kpiFilter.metric === 'messagesSent') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => a.status && a.status !== '');
          } else if (kpiFilter.metric === 'messageReplyRate') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => 
              a.status && ['Meeting Proposed', 'Meeting Scheduled', 'Meeting Completed', 'SQL', 'Tech Discussion'].includes(a.status)
            );
          } else if (kpiFilter.metric === 'meetingsBooked') {
            hasMatchingActivity = fallbackLinkedinActivities.some(a => 
              a.status && ['Meeting Scheduled', 'Meeting Completed', 'In-Person Meeting'].includes(a.status)
            );
          }
        } else if (kpiFilter.channel === 'call') {
          if (kpiFilter.metric === 'allProspects') {
            hasMatchingActivity = true;
          } else if (kpiFilter.metric === 'callsAttempted') {
            hasMatchingActivity = fallbackCallActivities.length > 0;
          } else if (kpiFilter.metric === 'callsConnected') {
            hasMatchingActivity = fallbackCallActivities.some(a => 
              a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up'].includes(a.callStatus)
            );
          } else if (kpiFilter.metric === 'decisionMakerReached') {
            hasMatchingActivity = fallbackCallActivities.some(a => 
              a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up', 'Not Interested'].includes(a.callStatus)
            );
          } else if (kpiFilter.metric === 'interested') {
            hasMatchingActivity = fallbackCallActivities.some(a => a.callStatus === 'Interested');
          } else if (kpiFilter.metric === 'notInterested') {
            hasMatchingActivity = fallbackCallActivities.some(a => a.callStatus === 'Not Interested');
          } else if (kpiFilter.metric === 'detailsShared') {
            hasMatchingActivity = fallbackCallActivities.some(a => a.callStatus === 'Details Shared');
          } else if (kpiFilter.metric === 'demoBooked') {
            hasMatchingActivity = fallbackCallActivities.some(a => a.callStatus === 'Demo Booked');
          } else if (kpiFilter.metric === 'demoCompleted') {
            hasMatchingActivity = fallbackCallActivities.some(a => a.callStatus === 'Demo Completed');
          } else if (kpiFilter.metric === 'sql') {
            hasMatchingActivity = contact.stage === 'SQL';
          } else if (kpiFilter.metric === 'won') {
            hasMatchingActivity = contact.stage === 'WON';
          } else if (kpiFilter.metric === 'followups' || kpiFilter.metric === 'todayFollowups' || kpiFilter.metric === 'tomorrowFollowups' || kpiFilter.metric === 'missedFollowups') {
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            hasMatchingActivity = fallbackCallActivities.some(a => {
              if (!a.nextActionDate) return false;
              try {
                const d = new Date(a.nextActionDate);
                if (isNaN(d.getTime())) return false; // Invalid date
                d.setHours(0, 0, 0, 0);
                if (kpiFilter.metric === 'followups') {
                  // Show all follow-ups (today, tomorrow, or missed)
                  return true;
                } else if (kpiFilter.metric === 'todayFollowups') {
                  return d >= today && d < tomorrow;
                } else if (kpiFilter.metric === 'tomorrowFollowups') {
                  return d >= tomorrow && d < dayAfterTomorrow;
                } else if (kpiFilter.metric === 'missedFollowups') {
                  return d < today;
                }
                return false;
              } catch (dateError) {
                console.error('Error parsing nextActionDate for Call activity:', dateError, a);
                return false;
              }
            });
          }
        } else if (kpiFilter.channel === 'email') {
          if (kpiFilter.metric === 'followups' || kpiFilter.metric === 'todayFollowups' || kpiFilter.metric === 'tomorrowFollowups' || kpiFilter.metric === 'missedFollowups') {
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            hasMatchingActivity = fallbackEmailActivities.some(a => {
              if (!a.nextActionDate) return false;
              try {
                const d = new Date(a.nextActionDate);
                if (isNaN(d.getTime())) return false; // Invalid date
                d.setHours(0, 0, 0, 0);
                if (kpiFilter.metric === 'followups') {
                  // Show all follow-ups (today, tomorrow, or missed)
                  return true;
                } else if (kpiFilter.metric === 'todayFollowups') {
                  return d >= today && d < tomorrow;
                } else if (kpiFilter.metric === 'tomorrowFollowups') {
                  return d >= tomorrow && d < dayAfterTomorrow;
                } else if (kpiFilter.metric === 'missedFollowups') {
                  return d < today;
                }
                return false;
              } catch (dateError) {
                console.error('Error parsing nextActionDate for Email activity:', dateError, a);
                return false;
              }
            });
          } else if (kpiFilter.metric === 'emailsSent') {
            hasMatchingActivity = fallbackEmailActivities.length > 0;
          } else if (kpiFilter.metric === 'accepted') {
            hasMatchingActivity = fallbackEmailActivities.some(a => 
              a.status && a.status !== 'Bounce' && a.status !== 'Opt-Out' && a.status !== 'No Reply'
            );
          } else if (kpiFilter.metric === 'cip') {
            hasMatchingActivity = fallbackEmailActivities.some(a => 
              a.status && (a.status === 'CIP' || a.status === 'Conversations in Progress')
            );
          } else if (kpiFilter.metric === 'meetingProposed') {
            hasMatchingActivity = fallbackEmailActivities.some(a => a.status === 'Meeting Proposed');
          } else if (kpiFilter.metric === 'scheduled') {
            hasMatchingActivity = fallbackEmailActivities.some(a => a.status === 'Meeting Scheduled');
          } else if (kpiFilter.metric === 'completed') {
            hasMatchingActivity = fallbackEmailActivities.some(a => a.status === 'Meeting Completed');
          } else if (kpiFilter.metric === 'sql') {
            hasMatchingActivity = contact.stage === 'SQL';
          } else if (kpiFilter.metric === 'emailBounce') {
            hasMatchingActivity = fallbackEmailActivities.some(a => a.status === 'Bounce');
          }
          // Legacy metrics (for backward compatibility)
          else if (kpiFilter.metric === 'emailOpenRate') {
            hasMatchingActivity = fallbackEmailActivities.some(a => 
              a.status && a.status !== 'Bounce' && a.status !== 'Opt-Out' && a.status !== 'No Reply'
            );
          } else if (kpiFilter.metric === 'emailReplyRate') {
            hasMatchingActivity = fallbackEmailActivities.some(a => 
              a.status && ['Meeting Proposed', 'Meeting Scheduled', 'Meeting Completed', 'SQL', 'Tech Discussion'].includes(a.status)
            );
          } else if (kpiFilter.metric === 'meetingsBooked') {
            hasMatchingActivity = fallbackEmailActivities.some(a => 
              a.status && ['Meeting Scheduled', 'Meeting Completed', 'In-Person Meeting'].includes(a.status)
            );
          }
        }
        
        return hasMatchingActivity;
      }

      let hasMatchingActivity = false;
      
      if (kpiFilter.channel === 'linkedin') {
        // Backend uses type: 'linkedin'
        const linkedinActivities = contactActivities.filter(a => a.type === 'linkedin');
        if (kpiFilter.metric === 'connectionSent') {
          // Backend checks: lnRequestSent === true or 'Yes'
          hasMatchingActivity = linkedinActivities.some(a => a.lnRequestSent === true || a.lnRequestSent === 'Yes');
        } else if (kpiFilter.metric === 'accepted') {
          // Backend checks: connected === true or 'Yes'
          hasMatchingActivity = linkedinActivities.some(a => a.connected === true || a.connected === 'Yes');
        } else if (kpiFilter.metric === 'followUps') {
          // Backend checks: more than 1 LinkedIn activity for this contact
          hasMatchingActivity = linkedinActivities.length > 1;
        } else if (kpiFilter.metric === 'cip') {
          // Backend checks: status === 'CIP' or 'Conversations in Progress'
          hasMatchingActivity = linkedinActivities.some(a => 
            a.status && (a.status === 'CIP' || a.status === 'Conversations in Progress')
          );
        } else if (kpiFilter.metric === 'meetingProposed') {
          // Backend checks: status === 'Meeting Proposed'
          hasMatchingActivity = linkedinActivities.some(a => a.status === 'Meeting Proposed');
        } else if (kpiFilter.metric === 'scheduled') {
          // Backend checks: status === 'Meeting Scheduled'
          hasMatchingActivity = linkedinActivities.some(a => a.status === 'Meeting Scheduled');
        } else if (kpiFilter.metric === 'completed') {
          // Backend checks: status === 'Meeting Completed'
          hasMatchingActivity = linkedinActivities.some(a => a.status === 'Meeting Completed');
        } else if (kpiFilter.metric === 'sql') {
          // Check project contact stage
          hasMatchingActivity = contact.stage === 'SQL';
        } else if (kpiFilter.metric === 'win') {
          // Check project contact stage
          hasMatchingActivity = contact.stage === 'WON';
        } else if (kpiFilter.metric === 'followups' || kpiFilter.metric === 'todayFollowups' || kpiFilter.metric === 'tomorrowFollowups' || kpiFilter.metric === 'missedFollowups') {
          const now = new Date();
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfterTomorrow = new Date(tomorrow);
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

          hasMatchingActivity = linkedinActivities.some(a => {
            if (!a.nextActionDate) return false;
            try {
              const d = new Date(a.nextActionDate);
              if (isNaN(d.getTime())) return false; // Invalid date
              d.setHours(0, 0, 0, 0);
              if (kpiFilter.metric === 'followups') {
                // Show all follow-ups (today, tomorrow, or missed)
                return true;
              } else if (kpiFilter.metric === 'todayFollowups') {
                return d >= today && d < tomorrow;
              } else if (kpiFilter.metric === 'tomorrowFollowups') {
                return d >= tomorrow && d < dayAfterTomorrow;
              } else if (kpiFilter.metric === 'missedFollowups') {
                return d < today;
              }
              return false;
            } catch (dateError) {
              console.error('Error parsing nextActionDate for LinkedIn activity:', dateError, a);
              return false;
            }
          });
        }
        // Legacy metrics (for backward compatibility)
        else if (kpiFilter.metric === 'connectionRequestsSent') {
          hasMatchingActivity = linkedinActivities.some(a => a.lnRequestSent === true || a.lnRequestSent === 'Yes');
        } else if (kpiFilter.metric === 'connectionAcceptanceRate') {
          hasMatchingActivity = linkedinActivities.some(a => a.connected === true || a.connected === 'Yes');
        } else if (kpiFilter.metric === 'messagesSent') {
          hasMatchingActivity = linkedinActivities.some(a => a.status && a.status !== '');
        } else if (kpiFilter.metric === 'messageReplyRate') {
          hasMatchingActivity = linkedinActivities.some(a => 
            a.status && ['Meeting Proposed', 'Meeting Scheduled', 'Meeting Completed', 'SQL', 'Tech Discussion'].includes(a.status)
          );
        } else if (kpiFilter.metric === 'meetingsBooked') {
          hasMatchingActivity = linkedinActivities.some(a => 
            a.status && ['Meeting Scheduled', 'Meeting Completed', 'In-Person Meeting'].includes(a.status)
          );
        }
      } else if (kpiFilter.channel === 'call') {
        // Backend uses type: 'call' and callStatus field (not status)
        const callActivities = contactActivities.filter(a => a.type === 'call');
        if (kpiFilter.metric === 'allProspects') {
          // Show all prospects (no filtering)
          hasMatchingActivity = true;
        } else if (kpiFilter.metric === 'callsAttempted') {
          // All call activities
          hasMatchingActivity = callActivities.length > 0;
        } else if (kpiFilter.metric === 'totalCalls') {
          // Total Calls = total call activities (backend: callsMade)
          hasMatchingActivity = callActivities.length > 0;
        } else if (kpiFilter.metric === 'callsConnected') {
          // Calls that were answered (not Ring, Busy, Switch Off, Invalid, Hang Up)
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up'].includes(a.callStatus)
          );
        } else if (kpiFilter.metric === 'decisionMakerReached') {
          // Calls that reached decision maker (answered and not Not Interested)
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up', 'Not Interested'].includes(a.callStatus)
          );
        } else if (kpiFilter.metric === 'interested') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Interested');
        } else if (kpiFilter.metric === 'notInterested') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Not Interested');
        } else if (kpiFilter.metric === 'detailsShared') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Details Shared');
        } else if (kpiFilter.metric === 'demoBooked') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Demo Booked');
        } else if (kpiFilter.metric === 'demoCompleted') {
          hasMatchingActivity = callActivities.some(a => a.callStatus === 'Demo Completed');
        } else if (kpiFilter.metric === 'sql') {
          // Check project contact stage
          hasMatchingActivity = contact.stage === 'SQL';
        } else if (kpiFilter.metric === 'won') {
          // Check project contact stage
          hasMatchingActivity = contact.stage === 'WON';
        } else if (kpiFilter.metric === 'followups' || kpiFilter.metric === 'todayFollowups' || kpiFilter.metric === 'tomorrowFollowups' || kpiFilter.metric === 'missedFollowups') {
          // Filter by nextActionDate
          const now = new Date();
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfterTomorrow = new Date(tomorrow);
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

          hasMatchingActivity = callActivities.some(a => {
            if (!a.nextActionDate) return false;
            try {
              const d = new Date(a.nextActionDate);
              if (isNaN(d.getTime())) return false; // Invalid date
              d.setHours(0, 0, 0, 0);
              if (kpiFilter.metric === 'followups') {
                // Show all follow-ups (today, tomorrow, or missed)
                return true;
              } else if (kpiFilter.metric === 'todayFollowups') {
                return d >= today && d < tomorrow;
              } else if (kpiFilter.metric === 'tomorrowFollowups') {
                return d >= tomorrow && d < dayAfterTomorrow;
              } else if (kpiFilter.metric === 'missedFollowups') {
                return d < today;
              }
              return false;
            } catch (dateError) {
              console.error('Error parsing nextActionDate for Call activity:', dateError, a);
              return false;
            }
          });
        } else if (kpiFilter.metric === 'callsMade') {
          // Legacy support
          hasMatchingActivity = callActivities.length > 0;
        } else if (kpiFilter.metric === 'callAnswerRate') {
          // Legacy support
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && !['Ring', 'Busy', 'Switch Off', 'Invalid', 'Hang Up'].includes(a.callStatus)
          );
        } else if (kpiFilter.metric === 'callInterestedRate') {
          // Legacy support
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && ['Interested', 'Details Shared', 'Demo Booked', 'Demo Completed'].includes(a.callStatus)
          );
        } else if (kpiFilter.metric === 'meetingsBooked') {
          // Legacy support
          hasMatchingActivity = callActivities.some(a => 
            a.callStatus && ['Demo Booked', 'Demo Completed'].includes(a.callStatus)
          );
        }
      } else if (kpiFilter.channel === 'email') {
        // Backend uses type: 'email'
        const emailActivities = contactActivities.filter(a => a.type === 'email');
        if (kpiFilter.metric === 'followups' || kpiFilter.metric === 'todayFollowups' || kpiFilter.metric === 'tomorrowFollowups' || kpiFilter.metric === 'missedFollowups') {
          const now = new Date();
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfterTomorrow = new Date(tomorrow);
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

          hasMatchingActivity = emailActivities.some(a => {
            if (!a.nextActionDate) return false;
            try {
              const d = new Date(a.nextActionDate);
              if (isNaN(d.getTime())) return false; // Invalid date
              d.setHours(0, 0, 0, 0);
              if (kpiFilter.metric === 'followups') {
                // Show all follow-ups (today, tomorrow, or missed)
                return true;
              } else if (kpiFilter.metric === 'todayFollowups') {
                return d >= today && d < tomorrow;
              } else if (kpiFilter.metric === 'tomorrowFollowups') {
                return d >= tomorrow && d < dayAfterTomorrow;
              } else if (kpiFilter.metric === 'missedFollowups') {
                return d < today;
              }
              return false;
            } catch (dateError) {
              console.error('Error parsing nextActionDate for Email activity:', dateError, a);
              return false;
            }
          });
        } else if (kpiFilter.metric === 'emailsSent') {
          // Backend counts all email activities
          hasMatchingActivity = emailActivities.length > 0;
        } else if (kpiFilter.metric === 'accepted') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && a.status !== 'Bounce' && a.status !== 'Opt-Out' && a.status !== 'No Reply'
          );
        } else if (kpiFilter.metric === 'cip') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && (a.status === 'CIP' || a.status === 'Conversations in Progress')
          );
        } else if (kpiFilter.metric === 'meetingProposed') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Meeting Proposed');
        } else if (kpiFilter.metric === 'scheduled') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Meeting Scheduled');
        } else if (kpiFilter.metric === 'completed') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Meeting Completed');
        } else if (kpiFilter.metric === 'sql') {
          hasMatchingActivity = contact.stage === 'SQL';
        } else if (kpiFilter.metric === 'emailBounce') {
          hasMatchingActivity = emailActivities.some(a => a.status === 'Bounce');
        }
        // Legacy metrics (for backward compatibility)
        else if (kpiFilter.metric === 'emailOpenRate') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && a.status !== 'Bounce' && a.status !== 'Opt-Out' && a.status !== 'No Reply'
          );
        } else if (kpiFilter.metric === 'emailReplyRate') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && ['Meeting Proposed', 'Meeting Scheduled', 'Meeting Completed', 'SQL', 'Tech Discussion'].includes(a.status)
          );
        } else if (kpiFilter.metric === 'meetingsBooked') {
          hasMatchingActivity = emailActivities.some(a => 
            a.status && ['Meeting Scheduled', 'Meeting Completed', 'In-Person Meeting'].includes(a.status)
          );
        }
      }
      
      return hasMatchingActivity;
        } catch (contactError) {
          console.error('Error filtering contact for KPI:', contactError, contact);
          return false; // Exclude this contact if there's an error
        }
      });
    } catch (error) {
      console.error('Error in getKpiFilteredProspects:', error, kpiFilter);
      return []; // Return empty array on error
    }
  }, [allContactsForKpi, contacts, activityLookups, allProjectActivities, id]);

  // Fetch all contacts when KPI modal opens
  useEffect(() => {
    if (kpiProspectModal.isOpen && kpiProspectModal.filter) {
      // Refresh activities to ensure we have all of them for accurate filtering
      fetchAllProjectActivities()
        .then(() => {
          return fetchAllContactsForKpi();
        })
        .catch((error) => {
          console.error('Error fetching data for KPI modal:', error);
          // Don't close the modal on error, just log it
        });
    } else if (!kpiProspectModal.isOpen) {
      // Clear data when modal closes to free memory
      setAllContactsForKpi([]);
    }
  }, [kpiProspectModal.isOpen, kpiProspectModal.filter, fetchAllContactsForKpi]);

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
          
          devLog(`Removed ${prevContacts.length - filtered.length} contact(s) from UI`);
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
                devLog(`Removed ${prevContacts.length - filtered.length} contact(s) that reappeared after refresh`);
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
        devLog(`Successfully removed ${deletedCount} prospect(s)`);
      }
    } catch (err) {
      console.error('Error removing prospects:', err);
      alert(err.response?.data?.error || 'Couldn\'t remove those prospects. Try again in a moment.');
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
            {project && (
              <h1 className="text-3xl font-bold text-indigo-600 mb-1">{project.companyName}</h1>
            )}
            <p className="text-lg font-semibold text-gray-700">Prospect Management</p>
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
            onClick={() => navigate(`/projects/${id}/report`)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-colors font-medium text-sm shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            Report
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


      {/* KPI Pipeline Section */}
      {kpiMetrics && (
        <div className="mb-4">
          {/* Pipeline Tabs/Scroller */}
          <div className="mb-3 overflow-x-auto -mx-1 px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <style>{`
              .scrollbar-thin::-webkit-scrollbar {
                height: 6px;
              }
              .scrollbar-thin::-webkit-scrollbar-track {
                background: transparent;
              }
              .scrollbar-thin::-webkit-scrollbar-thumb {
                background-color: #cbd5e1;
                border-radius: 3px;
              }
              .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                background-color: #94a3b8;
              }
            `}</style>
            <div className="flex gap-2 min-w-max pb-2">
              {/* LinkedIn Pipeline Button - Only show if linkedInOutreach channel is enabled */}
              {enabledActivityTypes.includes('linkedin') && (
                  <div
                    onClick={() => setSelectedPipeline('linkedin')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all cursor-pointer min-w-[150px] justify-center ${
                      selectedPipeline === 'linkedin'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <span>LinkedIn Pipeline</span>
                </div>
              )}
              {/* Cold Calling Pipeline Button - Only show if coldCalling channel is enabled */}
              {enabledActivityTypes.includes('call') && (
                <div
                  onClick={() => setSelectedPipeline('call')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all cursor-pointer min-w-[150px] justify-center ${
                    selectedPipeline === 'call'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Cold Calling Pipeline</span>
                </div>
              )}
              {/* Email Pipeline Button - Only show if coldEmail channel is enabled */}
              {enabledActivityTypes.includes('email') && (
                  <div
                    onClick={() => setSelectedPipeline('email')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all cursor-pointer min-w-[150px] justify-center ${
                      selectedPipeline === 'email'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Email Pipeline</span>
                </div>
              )}
            </div>
          </div>

          {/* LinkedIn KPIs - Only show if linkedInOutreach channel is enabled */}
          {enabledActivityTypes.includes('linkedin') && selectedPipeline === 'linkedin' && kpiMetrics && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-2">
              {/* Connection Sent */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'connectionSent' })}
                className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'connectionSent' 
                    ? 'border-blue-400 ring-2 ring-blue-200' 
                    : 'border-blue-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full">Sent</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.connectionSent || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Connection Sent</div>
              </button>
              
              {/* Accepted */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'accepted' })}
                className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'accepted' 
                    ? 'border-green-400 ring-2 ring-green-200' 
                    : 'border-green-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-green-700 bg-white/70 border border-green-100 px-2 py-1 rounded-full">Accepted</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.accepted || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Accepted</div>
              </button>
              
              {/* Follow-ups */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'followUps' })}
                className={`bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'followUps' 
                    ? 'border-purple-400 ring-2 ring-purple-200' 
                    : 'border-purple-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full">Follow</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.followUps || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Follow-ups</div>
              </button>
              
              {/* CIP */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'cip' })}
                className={`bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'cip' 
                    ? 'border-cyan-400 ring-2 ring-cyan-200' 
                    : 'border-cyan-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-cyan-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-cyan-700 bg-white/70 border border-cyan-100 px-2 py-1 rounded-full">CIP</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.cip || 0}</div>
                <div className="text-xs text-gray-600 mt-1">CIP</div>
              </button>
              
              {/* Meeting Proposed */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'meetingProposed' })}
                className={`bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'meetingProposed' 
                    ? 'border-yellow-400 ring-2 ring-yellow-200' 
                    : 'border-yellow-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-yellow-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-yellow-700 bg-white/70 border border-yellow-100 px-2 py-1 rounded-full">Proposed</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.meetingProposed || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Meeting Proposed</div>
              </button>
              
              {/* Scheduled */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'scheduled' })}
                className={`bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'scheduled' 
                    ? 'border-orange-400 ring-2 ring-orange-200' 
                    : 'border-orange-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-orange-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-orange-700 bg-white/70 border border-orange-100 px-2 py-1 rounded-full">Scheduled</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.scheduled || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Scheduled</div>
              </button>
              
              {/* Completed */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'completed' })}
                className={`bg-gradient-to-br from-teal-50 to-green-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'completed' 
                    ? 'border-teal-400 ring-2 ring-teal-200' 
                    : 'border-teal-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-teal-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 bg-white/70 border border-teal-100 px-2 py-1 rounded-full">Done</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.completed || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Completed</div>
              </button>
              
              {/* SQL */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'sql' })}
                className={`bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'sql' 
                    ? 'border-indigo-400 ring-2 ring-indigo-200' 
                    : 'border-indigo-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-indigo-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700 bg-white/70 border border-indigo-100 px-2 py-1 rounded-full">SQL</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.sql || 0}</div>
                <div className="text-xs text-gray-600 mt-1">SQL</div>
              </button>
              
              {/* Win */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'linkedin', metric: 'win' })}
                className={`bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'linkedin' && filterKpi?.metric === 'win' 
                    ? 'border-emerald-400 ring-2 ring-emerald-200' 
                    : 'border-emerald-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full">WON</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.linkedin?.win || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Win</div>
              </button>
              </div>

              {/* Follow-up summary chips for LinkedIn */}
              <div className="mt-4 flex flex-wrap items-center gap-3 justify-start">
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'linkedin', metric: 'todayFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Today&apos;s Follow-ups ({linkedinEmailFollowups.linkedin.today})
                </button>
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'linkedin', metric: 'tomorrowFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Tomorrow&apos;s Follow-ups ({linkedinEmailFollowups.linkedin.tomorrow})
                </button>
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'linkedin', metric: 'missedFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Missed Follow-ups ({linkedinEmailFollowups.linkedin.missed})
                </button>
              </div>
            </div>
          )}

          {/* Call Pipeline Stages */}
          {/* Cold Calling Pipeline - Only show if coldCalling channel is enabled */}
          {enabledActivityTypes.includes('call') && selectedPipeline === 'call' && kpiMetrics && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {/* Total Calls */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'totalCalls' })}
                  className={`bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'totalCalls'
                      ? 'border-teal-400 ring-2 ring-teal-200'
                      : 'border-teal-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-teal-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h6m-6 4h6m-6 4h6m-6 4h6" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-teal-700 bg-white/70 border border-teal-100 px-2 py-1 rounded-full">Total</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.callsMade || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Total Calls</div>
                </button>

                {/* Calls Attempted */}
                <button
                onClick={() => openKpiProspectModal({ channel: 'call', metric: 'callsAttempted' })}
                  className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'callsAttempted' 
                      ? 'border-green-400 ring-2 ring-green-200' 
                      : 'border-green-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-green-700 bg-white/70 border border-green-100 px-2 py-1 rounded-full">Calls</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.callsAttempted || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Calls Attempted</div>
                </button>

                {/* Calls Connected */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'callsConnected' })}
                  className={`bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'callsConnected' 
                      ? 'border-blue-400 ring-2 ring-blue-200' 
                      : 'border-blue-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full">Connected</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.callsConnected || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Calls Connected</div>
                </button>

                {/* Decision Maker Reached */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'decisionMakerReached' })}
                  className={`bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'decisionMakerReached' 
                      ? 'border-purple-400 ring-2 ring-purple-200' 
                      : 'border-purple-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full">DM</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.decisionMakerReached || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Decision Maker Reached</div>
                </button>

                {/* Interested */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'interested' })}
                  className={`bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'interested' 
                      ? 'border-yellow-400 ring-2 ring-yellow-200' 
                      : 'border-yellow-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-yellow-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-yellow-700 bg-white/70 border border-yellow-100 px-2 py-1 rounded-full">Interest</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.interested || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Interested</div>
                </button>

                {/* Details Shared */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'detailsShared' })}
                  className={`bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'detailsShared' 
                      ? 'border-indigo-400 ring-2 ring-indigo-200' 
                      : 'border-indigo-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-indigo-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-indigo-700 bg-white/70 border border-indigo-100 px-2 py-1 rounded-full">Details</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.detailsShared || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Details Shared</div>
                </button>

                {/* Demo Booked */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'demoBooked' })}
                  className={`bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'demoBooked' 
                      ? 'border-teal-400 ring-2 ring-teal-200' 
                      : 'border-teal-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-teal-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-teal-700 bg-white/70 border border-teal-100 px-2 py-1 rounded-full">Demo</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.demoBooked || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Demo Booked</div>
                </button>

                {/* Demo Completed */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'demoCompleted' })}
                  className={`bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'demoCompleted' 
                      ? 'border-emerald-400 ring-2 ring-emerald-200' 
                      : 'border-emerald-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full">Done</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.demoCompleted || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Demo Completed</div>
                </button>

                {/* SQL */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'sql' })}
                  className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'sql' 
                      ? 'border-blue-400 ring-2 ring-blue-200' 
                      : 'border-blue-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full">SQL</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.sql || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">SQL</div>
                </button>

                {/* WON */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'won' })}
                  className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'won' 
                      ? 'border-green-400 ring-2 ring-green-200' 
                      : 'border-green-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-green-700 bg-white/70 border border-green-100 px-2 py-1 rounded-full">WON</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.won || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">WON</div>
                </button>

                {/* Not Interested */}
                <button
                  onClick={() => openKpiProspectModal({ channel: 'call', metric: 'notInterested' })}
                  className={`bg-gradient-to-br from-red-50 to-pink-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                    filterKpi?.channel === 'call' && filterKpi?.metric === 'notInterested' 
                      ? 'border-red-400 ring-2 ring-red-200' 
                      : 'border-red-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-white/80 border border-red-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-red-700 bg-white/70 border border-red-100 px-2 py-1 rounded-full">Not Interested</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpiMetrics.call?.notInterested || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">Not Interested</div>
                </button>
              </div>

              {/* Follow-up summary chips for Cold Calling */}
              <div className="mt-4 flex flex-wrap items-center gap-3 justify-start">
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'call', metric: 'todayFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Today&apos;s Follow-ups ({kpiMetrics.call?.todayFollowups || 0})
                </button>
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'call', metric: 'tomorrowFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Tomorrow&apos;s Follow-ups ({kpiMetrics.call?.tomorrowFollowups || 0})
                </button>
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'call', metric: 'missedFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Missed Follow-ups ({kpiMetrics.call?.missedFollowups || 0})
                </button>
              </div>
            </div>
          )}

          {/* Email KPIs */}
          {/* Email KPIs - Only show if coldEmail channel is enabled */}
          {enabledActivityTypes.includes('email') && selectedPipeline === 'email' && kpiMetrics && (
            <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-2">
              {/* Emails Sent */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'emailsSent' })}
                className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'emailsSent' 
                    ? 'border-blue-400 ring-2 ring-blue-200' 
                    : 'border-blue-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full">Sent</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.emailsSent || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Emails Sent</div>
              </button>
              
              {/* Accepted */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'accepted' })}
                className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'accepted' 
                    ? 'border-green-400 ring-2 ring-green-200' 
                    : 'border-green-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-green-700 bg-white/70 border border-green-100 px-2 py-1 rounded-full">Accepted</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.accepted || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Accepted</div>
              </button>
              
              {/* Followups */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'followups' })}
                className={`bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'followups' 
                    ? 'border-purple-400 ring-2 ring-purple-200' 
                    : 'border-purple-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full">Followups</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.followups || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Follow-ups</div>
              </button>
              
              {/* CIP */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'cip' })}
                className={`bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'cip' 
                    ? 'border-amber-400 ring-2 ring-amber-200' 
                    : 'border-amber-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 bg-white/70 border border-amber-100 px-2 py-1 rounded-full">CIP</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.cip || 0}</div>
                <div className="text-xs text-gray-600 mt-1">CIP</div>
              </button>
              
              {/* Meeting Proposed */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'meetingProposed' })}
                className={`bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'meetingProposed' 
                    ? 'border-teal-400 ring-2 ring-teal-200' 
                    : 'border-teal-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-teal-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 bg-white/70 border border-teal-100 px-2 py-1 rounded-full">Proposed</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.meetingProposed || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Meeting Proposed</div>
              </button>
              
              {/* Scheduled */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'scheduled' })}
                className={`bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'scheduled' 
                    ? 'border-indigo-400 ring-2 ring-indigo-200' 
                    : 'border-indigo-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-indigo-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700 bg-white/70 border border-indigo-100 px-2 py-1 rounded-full">Scheduled</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.scheduled || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Scheduled</div>
              </button>
              
              {/* Completed */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'completed' })}
                className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'completed' 
                    ? 'border-green-400 ring-2 ring-green-200' 
                    : 'border-green-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-green-700 bg-white/70 border border-green-100 px-2 py-1 rounded-full">Completed</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.completed || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Completed</div>
              </button>
              
              {/* SQL */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'sql' })}
                className={`bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'sql' 
                    ? 'border-pink-400 ring-2 ring-pink-200' 
                    : 'border-pink-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-pink-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-pink-700 bg-white/70 border border-pink-100 px-2 py-1 rounded-full">SQL</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.sql || 0}</div>
                <div className="text-xs text-gray-600 mt-1">SQL</div>
              </button>
              
              {/* Email Bounce */}
              <button
                onClick={() => openKpiProspectModal({ channel: 'email', metric: 'emailBounce' })}
                className={`bg-gradient-to-br from-red-50 to-rose-50 rounded-lg border shadow-sm p-2.5 transition-all hover:shadow-md cursor-pointer ${
                  filterKpi?.channel === 'email' && filterKpi?.metric === 'emailBounce' 
                    ? 'border-red-400 ring-2 ring-red-200' 
                    : 'border-red-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-white/80 border border-red-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-red-700 bg-white/70 border border-red-100 px-2 py-1 rounded-full">Bounce</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{kpiMetrics.email?.emailBounce || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Email Bounce</div>
              </button>
              </div>

              {/* Follow-up summary chips for Email */}
              <div className="mt-4 flex flex-wrap items-center gap-3 justify-start">
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'email', metric: 'todayFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Today&apos;s Follow-ups ({linkedinEmailFollowups.email.today})
                </button>
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'email', metric: 'tomorrowFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Tomorrow&apos;s Follow-ups ({linkedinEmailFollowups.email.tomorrow})
                </button>
                <button
                  onClick={() =>
                    openKpiProspectModal({ channel: 'email', metric: 'missedFollowups' })
                  }
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Missed Follow-ups ({linkedinEmailFollowups.email.missed})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          </div>
          {filterKpi && (
            <button
              onClick={() => setFilterKpi(null)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear KPI Filter
            </button>
          )}
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
              {/* Call-related statuses */}
              <optgroup label="Call Statuses">
                <option value="Ring">Ring</option>
                <option value="Busy">Busy</option>
                <option value="Call Back">Call Back</option>
                <option value="Hang Up">Hang Up</option>
                <option value="Switch Off">Switch Off</option>
                <option value="Invalid">Invalid</option>
                <option value="Future">Future</option>
                <option value="Existing">Existing</option>
                <option value="Interested">Interested</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Details Shared">Details Shared</option>
                <option value="Demo Booked">Demo Booked</option>
                <option value="Demo Completed">Demo Completed</option>
              </optgroup>
              {/* Email and LinkedIn statuses */}
              <optgroup label="Email & LinkedIn Statuses">
                <option value="CIP">CIP</option>
                <option value="No Reply">No Reply</option>
                <option value="Out of Office">Out of Office</option>
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
                <option value="Wrong Person">Wrong Person</option>
                <option value="Bounce">Bounce</option>
                <option value="Opt-Out">Opt-Out</option>
              </optgroup>
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
              <option value="tomorrow">Tomorrow</option>
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
              <option value="yesterday">Yesterday</option>
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
                  : filterActionDate === 'tomorrow' ? 'Tomorrow'
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
                  : filterLastInteraction === 'yesterday' ? 'Yesterday'
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
              {/* Log Call Button - Only show if coldCalling channel is enabled */}
              {enabledActivityTypes.includes('call') && (
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
              )}

              {/* Log Email Button - Only show if coldEmail channel is enabled */}
              {enabledActivityTypes.includes('email') && (
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
              )}

              {/* Log LinkedIn Button - Only show if linkedInOutreach channel is enabled */}
              {enabledActivityTypes.includes('linkedin') && (
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
              )}

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
          {/* Pagination - Above Table (based on filtered results when filters/search active) */}
          {filteredTotal > 0 && (
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
              {/* Left side - Showing count */}
              <div className="text-sm text-gray-700">
                Showing <span className="font-semibold">{(contactsPage - 1) * CONTACTS_PER_PAGE + 1}</span> to{' '}
                <span className="font-semibold">
                  {(contactsPage - 1) * CONTACTS_PER_PAGE + paginatedFilteredContacts.length}
                </span>{' '}
                of <span className="font-semibold">{filteredTotal.toLocaleString()}</span> contacts
              </div>

              {/* Right side - Pagination buttons */}
              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(contactsPage - 1)}
                  disabled={contactsPage === 1 || loading}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                {(() => {
                  const pages = [];
                  const maxVisiblePages = 5;
                  let startPage = Math.max(1, contactsPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(filteredTotalPages, startPage + maxVisiblePages - 1);
                  
                  // Adjust start if we're near the end
                  if (endPage - startPage < maxVisiblePages - 1) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }

                  // First page
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => handlePageChange(1)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <span key="ellipsis1" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                  }

                  // Page range
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => handlePageChange(i)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          i === contactsPage
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }

                  // Last page
                  if (endPage < filteredTotalPages) {
                    if (endPage < filteredTotalPages - 1) {
                      pages.push(
                        <span key="ellipsis2" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                    pages.push(
                      <button
                        key={filteredTotalPages}
                        onClick={() => handlePageChange(filteredTotalPages)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        {filteredTotalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(contactsPage + 1)}
                  disabled={contactsPage === filteredTotalPages || loading}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-12">
                    {/* Expand button column */}
                  </th>
                  <th 
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[20%] cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('name');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Contact
                      {sortBy === 'name' ? (
                        sortOrder === 'asc' ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )
                      ) : (
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[18%]">
                    Contact Info
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[12%] relative" ref={statusFilterRef}>
                    <div 
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors rounded px-1 py-0.5 -mx-1 -my-0.5"
                      onClick={() => setShowStatusFilter(!showStatusFilter)}
                    >
                      Status
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                    {showStatusFilter && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-96 overflow-y-auto">
                        <div className="p-2">
                          <button
                            onClick={() => {
                              setFilterStatus('');
                              setShowStatusFilter(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs rounded hover:bg-gray-100 ${
                              !filterStatus ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                            }`}
                          >
                            All Statuses
                          </button>
                          {['New', 'Interested', 'Not Interested', 'Details Shared', 'Demo Booked', 'Demo Completed', 'SQL', 'WON', 'Lost', 'CIP', 'No Reply', 'Meeting Proposed', 'Meeting Scheduled', 'Meeting Completed', 'Ring', 'Busy', 'Call Back', 'Hang Up', 'Switch Off', 'Invalid', 'Future', 'Existing', 'Bounce', 'Opt-Out'].map((status) => (
                            <button
                              key={status}
                              onClick={() => {
                                setFilterStatus(status);
                                setShowStatusFilter(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs rounded hover:bg-gray-100 ${
                                filterStatus === status ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[15%]">
                    Last Interaction
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[18%]">
                    Next Action
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[12%]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedFilteredContacts.map((contact) => {
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
                      const todayStart = toDateOnly(new Date());
                      const candidates = allProjectActivities.filter(a => {
                        if (!a.nextActionDate) return false;
                        // Only use notes matching if contactId is not set in activity
                        if (a.contactId) return false; // Skip if activity has contactId (should be matched by contactId)
                        const notesLower = a.conversationNotes?.toLowerCase() || '';
                        return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
                      });
                      const future = candidates.filter(a => toDateOnly(a.nextActionDate) >= todayStart)
                        .sort((a, b) => new Date(a.nextActionDate) - new Date(b.nextActionDate));
                      const overdue = candidates.filter(a => toDateOnly(a.nextActionDate) < todayStart)
                        .sort((a, b) => new Date(b.nextActionDate) - new Date(a.nextActionDate));
                      nextActionActivity = (future[0] || overdue[0]) || null;
                    }
                    
                    // Fallback for status: find most recent activity with status by name/email matching
                    if (!latestStatusData && (contactNameLower || contactEmailLower)) {
                      const activitiesWithStatus = allProjectActivities
                        .filter(a => {
                          // Only use notes matching if contactId is not set in activity
                          if (a.contactId) return false;
                          // For call activities, check callStatus; for others, check status
                          const hasStatus = (a.type === 'call' && a.callStatus && a.callStatus.trim() !== '') ||
                                           (a.status && a.status.trim() !== '');
                          if (!hasStatus) return false;
                          const notesLower = a.conversationNotes?.toLowerCase() || '';
                          return notesLower.includes(contactNameLower) || notesLower.includes(contactEmailLower);
                        })
                        .sort((a, b) => getActivityDate(b) - getActivityDate(a));
                      
                      if (activitiesWithStatus.length > 0) {
                        // Use callStatus for call activities, status for others
                        const activity = activitiesWithStatus[0];
                        latestStatus = (activity.type === 'call' && activity.callStatus) ? activity.callStatus : activity.status;
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
                      // Build return URL with current filter params
                      const currentParams = new URLSearchParams();
                      if (searchQuery) currentParams.set('search', searchQuery);
                      if (quickFilter) currentParams.set('quickFilter', quickFilter);
                      if (filterStatus) currentParams.set('filterStatus', filterStatus);
                      if (filterActionDate) currentParams.set('filterActionDate', filterActionDate);
                      if (filterActionDateFrom) currentParams.set('filterActionDateFrom', filterActionDateFrom);
                      if (filterActionDateTo) currentParams.set('filterActionDateTo', filterActionDateTo);
                      if (filterLastInteraction) currentParams.set('filterLastInteraction', filterLastInteraction);
                      if (filterLastInteractionFrom) currentParams.set('filterLastInteractionFrom', filterLastInteractionFrom);
                      if (filterLastInteractionTo) currentParams.set('filterLastInteractionTo', filterLastInteractionTo);
                      if (filterImportDate) currentParams.set('filterImportDate', filterImportDate);
                      if (filterImportDateFrom) currentParams.set('filterImportDateFrom', filterImportDateFrom);
                      if (filterImportDateTo) currentParams.set('filterImportDateTo', filterImportDateTo);
                      if (filterNoActivity) currentParams.set('filterNoActivity', 'true');
                      if (filterMatchType) currentParams.set('filterMatchType', filterMatchType);
                      // Always include current page in return URL (even if page 1)
                      currentParams.set('page', contactsPage.toString());
                      // Include KPI filter parameters if KPI modal is open
                      if (filterKpi) {
                        currentParams.set('kpiChannel', filterKpi.channel);
                        currentParams.set('kpiMetric', filterKpi.metric);
                        currentParams.set('kpiOpen', '1');
                      }
                      
                      const returnUrl = `/projects/${id}${currentParams.toString() ? '?' + currentParams.toString() : ''}`;
                      // Navigate to contact activity history page with preserved filters
                      navigate(`/contacts/${contactIdValue}/activities?projectId=${id}&returnTo=${encodeURIComponent(returnUrl)}`);
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
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(contactId.toString())}
                            onChange={(e) => handleContactSelect(contactId, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleContactExpansion(contactId, contact.email, contact.name);
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-all"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            <svg 
                              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? '-rotate-90' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
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
                        <td className="px-4 py-2.5">
                          <div className="space-y-0.5">
                            {contact.email ? (() => {
                              // Check if email contains multiple emails (comma or space separated)
                              const emailStr = String(contact.email).trim();
                              const emails = emailStr.split(/[,\s]+/).filter(e => e.trim());
                              const hasMultipleEmails = emails.length >= 2;
                              
                              return (
                                <div className="text-sm text-gray-900 font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                  {hasMultipleEmails ? `${emails[0]}....` : contact.email}
                              </div>
                              );
                            })() : (
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
                        <td className="px-4 py-2.5">
                          {getStageBadge(displayStatus)}
                        </td>
                        <td className="px-4 py-2.5">
                          {contactLastActivity ? (
                            <div>
                              <div className="text-sm text-gray-900 font-medium">
                                {formatDate(getActivityDate(contactLastActivity))}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {contactLastActivity.type === 'call' ? 'Call' : 
                                 contactLastActivity.type === 'email' ? 'Email' : 
                                 contactLastActivity.type === 'linkedin' ? 'LinkedIn' : 'Activity'}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">-</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {nextActionActivity ? (
                            <div className="flex items-center gap-1.5">
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
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {/* Log Call Button - Only show if coldCalling channel is enabled */}
                            {enabledActivityTypes.includes('call') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActivityModal('call', contact);
                              }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                              title="Log Call"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </button>
                            )}
                            {/* Log Email Button - Only show if coldEmail channel is enabled */}
                            {enabledActivityTypes.includes('email') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActivityModal('email', contact);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                              title="Log Email"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                            )}
                            {/* Log LinkedIn Button - Only show if linkedInOutreach channel is enabled */}
                            {enabledActivityTypes.includes('linkedin') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenActivityModal('linkedin', contact);
                              }}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                              title="Log LinkedIn"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                            </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="animate-fade-in">
                          <td colSpan="7" className="px-6 py-4 bg-blue-50 border-t-2 border-blue-200 transition-all duration-300">
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
            fetchImportedContacts(1, false);
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

      {/* KPI Prospect Modal */}
      {kpiProspectModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {kpiProspectModal.filter?.channel === 'linkedin' && 'LinkedIn Pipeline'}
                  {kpiProspectModal.filter?.channel === 'call' && 'Cold Calling Pipeline'}
                  {kpiProspectModal.filter?.channel === 'email' && 'Email Pipeline'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {kpiProspectModal.filter?.metric === 'connectionSent' && 'Connection Sent'}
                  {kpiProspectModal.filter?.metric === 'accepted' && 'Accepted'}
                  {(kpiProspectModal.filter?.metric === 'followUps' || kpiProspectModal.filter?.metric === 'followups') && 'Follow-ups'}
                  {kpiProspectModal.filter?.metric === 'todayFollowups' && 'Today\'s Follow-ups'}
                  {kpiProspectModal.filter?.metric === 'tomorrowFollowups' && 'Tomorrow\'s Follow-ups'}
                  {kpiProspectModal.filter?.metric === 'missedFollowups' && 'Missed Follow-ups'}
                  {kpiProspectModal.filter?.metric === 'cip' && 'CIP'}
                  {kpiProspectModal.filter?.metric === 'meetingProposed' && 'Meeting Proposed'}
                  {kpiProspectModal.filter?.metric === 'scheduled' && 'Scheduled'}
                  {kpiProspectModal.filter?.metric === 'completed' && 'Completed'}
                  {kpiProspectModal.filter?.metric === 'sql' && 'SQL'}
                  {kpiProspectModal.filter?.metric === 'win' && 'Win'}
                  {/* Legacy metrics */}
                  {kpiProspectModal.filter?.metric === 'connectionRequestsSent' && 'Connection Requests Sent'}
                  {kpiProspectModal.filter?.metric === 'connectionAcceptanceRate' && 'Connection Acceptance Rate'}
                  {kpiProspectModal.filter?.metric === 'messagesSent' && 'Messages Sent'}
                  {kpiProspectModal.filter?.metric === 'messageReplyRate' && 'Message Reply Rate'}
                  {kpiProspectModal.filter?.metric === 'allProspects' && 'All Prospects'}
                  {kpiProspectModal.filter?.metric === 'callsAttempted' && 'Calls Attempted'}
              {kpiProspectModal.filter?.metric === 'totalCalls' && 'Total Calls'}
                  {kpiProspectModal.filter?.metric === 'callsConnected' && 'Calls Connected'}
                  {kpiProspectModal.filter?.metric === 'decisionMakerReached' && 'Decision Maker Reached'}
                  {kpiProspectModal.filter?.metric === 'interested' && 'Interested'}
                  {kpiProspectModal.filter?.metric === 'detailsShared' && 'Details Shared'}
                  {kpiProspectModal.filter?.metric === 'demoBooked' && 'Demo Booked'}
                  {kpiProspectModal.filter?.metric === 'demoCompleted' && 'Demo Completed'}
                  {kpiProspectModal.filter?.metric === 'sql' && 'SQL'}
                  {kpiProspectModal.filter?.metric === 'won' && 'WON'}
                  {kpiProspectModal.filter?.metric === 'callsMade' && 'Calls Made'}
                  {kpiProspectModal.filter?.metric === 'callAnswerRate' && 'Call Answer Rate'}
                  {kpiProspectModal.filter?.metric === 'callInterestedRate' && 'Call Interested Rate'}
                  {kpiProspectModal.filter?.metric === 'emailsSent' && 'Emails Sent'}
                  {kpiProspectModal.filter?.metric === 'accepted' && 'Accepted'}
                  {kpiProspectModal.filter?.metric === 'followups' && 'Follow-ups'}
                  {kpiProspectModal.filter?.metric === 'cip' && 'CIP'}
                  {kpiProspectModal.filter?.metric === 'meetingProposed' && 'Meeting Proposed'}
                  {kpiProspectModal.filter?.metric === 'scheduled' && 'Scheduled'}
                  {kpiProspectModal.filter?.metric === 'completed' && 'Completed'}
                  {kpiProspectModal.filter?.metric === 'sql' && 'SQL'}
                  {kpiProspectModal.filter?.metric === 'emailBounce' && 'Email Bounce'}
                  {/* Legacy metrics */}
                  {kpiProspectModal.filter?.metric === 'emailOpenRate' && 'Email Open Rate'}
                  {kpiProspectModal.filter?.metric === 'emailReplyRate' && 'Email Reply Rate'}
                  {kpiProspectModal.filter?.metric === 'meetingsBooked' && 'Meetings Booked'}
                </p>
                {!loadingAllContactsForKpi && kpiProspectModal.filter && (() => {
                  try {
                    const count = getKpiFilteredProspects(kpiProspectModal.filter).length;
                    return (
                      <p className="text-xs text-gray-500 mt-1">
                        Showing all {count} prospects
                      </p>
                    );
                  } catch (error) {
                    console.error('Error getting prospect count:', error);
                    return null;
                  }
                })()}
              </div>
              <button
                onClick={closeKpiProspectModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingAllContactsForKpi ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm font-medium">Loading prospects...</p>
                </div>
              ) : (() => {
                let filteredProspects = [];
                try {
                  filteredProspects = getKpiFilteredProspects(kpiProspectModal.filter);
                } catch (filterError) {
                  console.error('Error filtering prospects for KPI modal:', filterError);
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium">Error loading prospects. Please try again.</p>
                    </div>
                  );
                }
                
                if (filteredProspects.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm font-medium">No prospects found for this metric</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">CONTACT</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">COMPANY</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">DATE</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProspects.map((contact) => {
                          const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
                          const latestActivity = contactIdStr ? activityLookups.lastActivityByContactId.get(contactIdStr) : null;
                          const latestStatusData = contactIdStr ? activityLookups.latestActivityStatusByContactId.get(contactIdStr) : null;
                          const latestStatus = latestStatusData?.status || contact.stage || 'New';
                          const activityDate = latestActivity ? getActivityDate(latestActivity) : null;
                          const formattedDate = activityDate ? activityDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : 'N/A';

                          // Check if contact is from databank (has _id - MongoDB ObjectId)
                          const isFromDatabank = contactIdStr && (
                            (typeof contactIdStr === 'string' && contactIdStr.length === 24) ||
                            (typeof contact._id === 'object' && contact._id !== null)
                          );

                          const handleKpiContactRowClick = (e) => {
                            // Don't navigate if clicking on action buttons or their children
                            if (
                              e.target.closest('button') ||
                              e.target.closest('svg') ||
                              e.target.closest('a')
                            ) {
                              return;
                            }
                            
                            // Only navigate if contact is from databank and has a valid ID
                            if (isFromDatabank && contactIdStr) {
                              // Build return URL to go back to the project detail page with current page and KPI filters
                              const currentParams = new URLSearchParams();
                              // Always include current page in return URL (even if page 1)
                              currentParams.set('page', contactsPage.toString());
                              // Include KPI filter parameters if KPI modal is open
                              if (filterKpi) {
                                currentParams.set('kpiChannel', filterKpi.channel);
                                currentParams.set('kpiMetric', filterKpi.metric);
                                currentParams.set('kpiOpen', '1');
                              }
                              const returnUrl = `/projects/${id}${currentParams.toString() ? '?' + currentParams.toString() : ''}`;
                              // Navigate to contact activity history page
                              navigate(`/contacts/${contactIdStr}/activities?projectId=${id}&returnTo=${encodeURIComponent(returnUrl)}`);
                            }
                          };

                          return (
                            <tr 
                              key={contact._id || contact.name} 
                              onClick={handleKpiContactRowClick}
                              className={`transition-colors ${
                                isFromDatabank 
                                  ? 'hover:bg-blue-50 cursor-pointer' 
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                {contact.name || 'Unknown'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                                {contact.company || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {formattedDate}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full border border-green-200">
                                  {latestStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
