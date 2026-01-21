import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import * as XLSX from 'xlsx-js-style';

export default function MonthlyReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [activities, setActivities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [reportData, setReportData] = useState({});
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'month'
  const [error, setError] = useState(null);
  const [prospectModal, setProspectModal] = useState({
    isOpen: false,
    metric: null, // e.g., 'interested', 'busy', 'detailsShared'
    period: null, // e.g., '1 Jan '26'
    channel: null, // 'call', 'linkedin', 'email'
    section: null // 'DRA', 'Cold Calling', 'Linked IN', 'Email'
  });
  const [allContactsForModal, setAllContactsForModal] = useState([]);
  const [loadingProspects, setLoadingProspects] = useState(false);

  // Simple in-memory cache for monthly report data (per browser tab)
  // Keyed by projectId so reopening the report is much faster.
  const cacheKey = id || 'unknown';
  const cachedEntryRef = React.useRef(null);

  // Determine enabled channels
  const enabledChannels = useMemo(() => {
    if (!project) return { call: false, linkedin: false, email: false };
    return {
      call: project.channels?.coldCalling || false,
      linkedin: project.channels?.linkedInOutreach || false,
      email: project.channels?.coldEmail || false
    };
  }, [project]);

  useEffect(() => {
    if (!id) return;

    // If we have a cached entry for this project, use it for instant render
    const cached = cachedEntryRef.current;
    if (cached && cached.projectId === id) {
      setProject(cached.project);
      setActivities(cached.activities);
      setContacts(cached.contacts);
      setReportData(cached.reportData || {});
      setLoading(false);
    } else {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all data in parallel for better performance
      const [projectResponse, activitiesResponse, contactsResponse] = await Promise.all([
        API.get(`/projects/${id}`),
        API.get(`/activities/project/${id}?limit=10000`),
        API.get(`/projects/${id}/project-contacts?limit=10000`)
      ]);

      let nextProject = project;
      let nextActivities = activities;
      let nextContacts = contacts;

      if (projectResponse.data.success) {
        nextProject = projectResponse.data.data;
        setProject(nextProject);
      }

      if (activitiesResponse.data.success) {
        nextActivities = activitiesResponse.data.data || [];
        setActivities(nextActivities);
      }

      if (contactsResponse.data.success) {
        nextContacts = contactsResponse.data.data || [];
        setContacts(nextContacts);
      }

      // Store raw inputs in cache; reportData itself is computed below and can be cached there too
      cachedEntryRef.current = {
        projectId: id,
        project: nextProject,
        activities: nextActivities,
        contacts: nextContacts,
        reportData,
      };
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Memoize date key functions
  const getDayKey = useCallback((date) => {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${day} ${month} '${year}`;
  }, []);

  const getMonthKey = useCallback((date) => {
    const d = new Date(date);
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${month} '${year}`;
  }, []);

  const getMonthName = useCallback((date) => {
    const d = new Date(date);
    return d.toLocaleString('default', { month: 'long' });
  }, []);

  // Group periods by month for day view
  const groupedPeriods = useMemo(() => {
    if (viewMode === 'month') {
      // For month view, just return periods as-is
      const periodSet = new Set();
      
      activities.forEach(activity => {
        const date = activity.callDate ? new Date(activity.callDate) : 
                     activity.emailDate ? new Date(activity.emailDate) : 
                     activity.linkedinDate ? new Date(activity.linkedinDate) :
                     (activity.createdAt ? new Date(activity.createdAt) : null);
        if (date && !isNaN(date.getTime())) {
          periodSet.add(getMonthKey(date));
        }
      });

      contacts.forEach(contact => {
        if (contact.createdAt) {
          periodSet.add(getMonthKey(new Date(contact.createdAt)));
        }
      });

      const sorted = Array.from(periodSet).sort((a, b) => {
        const [monthA, yearA] = a.split(" '");
        const [monthB, yearB] = b.split(" '");
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndexA = monthOrder.indexOf(monthA);
        const monthIndexB = monthOrder.indexOf(monthB);
        
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return monthIndexA - monthIndexB;
      });

      return [{ month: null, periods: sorted }];
    } else {
      // For day view, group by month
      const monthGroups = {};
      
      activities.forEach(activity => {
        const date = activity.callDate ? new Date(activity.callDate) : 
                     activity.emailDate ? new Date(activity.emailDate) : 
                     new Date(activity.createdAt);
        if (date && !isNaN(date.getTime())) {
          const dayKey = getDayKey(date);
          const monthKey = getMonthKey(date);
          const monthName = getMonthName(date);
          
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = {
              month: monthName,
              monthKey: monthKey,
              periods: []
            };
          }
          if (!monthGroups[monthKey].periods.includes(dayKey)) {
            monthGroups[monthKey].periods.push(dayKey);
          }
        }
      });

      contacts.forEach(contact => {
        if (contact.createdAt) {
          const date = new Date(contact.createdAt);
          const dayKey = getDayKey(date);
          const monthKey = getMonthKey(date);
          const monthName = getMonthName(date);
          
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = {
              month: monthName,
              monthKey: monthKey,
              periods: []
            };
          }
          if (!monthGroups[monthKey].periods.includes(dayKey)) {
            monthGroups[monthKey].periods.push(dayKey);
          }
        }
      });

      // Sort periods within each month and sort months
      Object.keys(monthGroups).forEach(monthKey => {
        monthGroups[monthKey].periods.sort((a, b) => {
          const dateA = new Date(a.replace(/(\d+) (\w+) '(\d+)/, '$2 $1, 20$3'));
          const dateB = new Date(b.replace(/(\d+) (\w+) '(\d+)/, '$2 $1, 20$3'));
          return dateA - dateB;
        });
      });

      const sortedMonths = Object.values(monthGroups).sort((a, b) => {
        const [monthA, yearA] = a.monthKey.split(" '");
        const [monthB, yearB] = b.monthKey.split(" '");
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndexA = monthOrder.indexOf(monthA);
        const monthIndexB = monthOrder.indexOf(monthB);
        
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return monthIndexA - monthIndexB;
      });

      return sortedMonths;
    }
  }, [activities, contacts, viewMode, getDayKey, getMonthKey, getMonthName]);

  // Get all periods flattened
  const allPeriods = useMemo(() => {
    return groupedPeriods.flatMap(group => group.periods);
  }, [groupedPeriods]);

  // Optimized calculation with useMemo
  const calculateReportData = useCallback(() => {
    if (activities.length === 0 && contacts.length === 0) {
      setReportData({});
      return;
    }

    setCalculating(true);
    
    const calculate = () => {
      const data = {};

      allPeriods.forEach(period => {
        data[period] = {
          dataAllocated: 0,
          dataResearch: 0,
          interested: 0,
          notInterested: 0,
          ring: 0,
          busy: 0,
          hangUp: 0,
          callBack: 0,
          switchOff: 0,
          detailsShared: 0,
          future: 0,
          invalid: 0,
          demoBooked: 0,
          followUps: 0,
          totalCalls: 0,
          freshCalls: 0,
          connectionRequestSent: 0,
          connectionAccepted: 0,
          firstMessageSent: 0,
          followupMessagesSent: 0,
          existingConnection: 0,
          conversationsInProgress: 0,
          meetingProposed: 0,
          meetingScheduled: 0,
          meetingCompleted: 0,
          emailsSent: 0,
          noReply: 0,
          outOfOffice: 0,
          wrongPerson: 0,
          bounce: 0,
          optOut: 0,
          totalResponses: 0,
          responseRate: 0
        };
      });

      // Calculate Data Allocated / Data Research
      contacts.forEach(contact => {
        if (contact.createdAt) {
          const period = viewMode === 'day' 
            ? getDayKey(new Date(contact.createdAt)) 
            : getMonthKey(new Date(contact.createdAt));
          if (data[period]) {
            data[period].dataAllocated++;
            data[period].dataResearch++;
          }
        }
      });

      // Filter activities by enabled channels
      const callActivities = enabledChannels.call ? activities.filter(a => a.type === 'call') : [];
      const linkedInActivities = enabledChannels.linkedin ? activities.filter(a => a.type === 'linkedin') : [];
      const emailActivities = enabledChannels.email ? activities.filter(a => a.type === 'email') : [];

      // Calculate Cold Calling metrics
      if (enabledChannels.call && callActivities.length > 0) {
        const contactFirstCalls = new Map();
        const contactActivitiesByPeriod = {};

        callActivities.forEach(activity => {
          const date = activity.callDate ? new Date(activity.callDate) : new Date(activity.createdAt);
          if (!date || isNaN(date.getTime())) return;

          const period = viewMode === 'day' ? getDayKey(date) : getMonthKey(date);
          if (!data[period]) return;

          const contactId = activity.contactId?.toString() || 'unknown';

          if (activity.callNumber === '1st call' && !contactFirstCalls.has(contactId)) {
            contactFirstCalls.set(contactId, period);
          }

          if (!contactActivitiesByPeriod[period]) {
            contactActivitiesByPeriod[period] = {};
          }
          if (!contactActivitiesByPeriod[period][contactId]) {
            contactActivitiesByPeriod[period][contactId] = [];
          }
          contactActivitiesByPeriod[period][contactId].push(activity);
        });

        callActivities.forEach(activity => {
          const date = activity.callDate ? new Date(activity.callDate) : new Date(activity.createdAt);
          if (!date || isNaN(date.getTime())) return;

          const period = viewMode === 'day' ? getDayKey(date) : getMonthKey(date);
          if (!data[period]) return;

          if (activity.callStatus) {
            switch (activity.callStatus) {
              case 'Interested': data[period].interested++; break;
              case 'Not Interested': data[period].notInterested++; break;
              case 'Ring': data[period].ring++; break;
              case 'Busy': data[period].busy++; break;
              case 'Hang Up': data[period].hangUp++; break;
              case 'Call Back': data[period].callBack++; break;
              case 'Switch Off': data[period].switchOff++; break;
              case 'Details Shared': data[period].detailsShared++; break;
              case 'Future': data[period].future++; break;
              case 'Invalid': data[period].invalid++; break;
              case 'Demo Booked': data[period].demoBooked++; break;
            }
          }

          data[period].totalCalls++;
        });

        // Calculate Fresh Calls and Follow Ups
        Object.keys(contactActivitiesByPeriod).forEach(period => {
          const periodData = contactActivitiesByPeriod[period];
          let freshCalls = 0;
          let followUps = 0;

          Object.keys(periodData).forEach(contactId => {
            const contactActs = periodData[contactId];
            const firstCallPeriod = contactFirstCalls.get(contactId);

            contactActs.forEach(activity => {
              if (activity.callNumber === '1st call' || (firstCallPeriod === period && !activity.callNumber)) {
                freshCalls++;
              } else {
                followUps++;
              }
            });
          });

          if (data[period]) {
            data[period].freshCalls = freshCalls;
            data[period].followUps = followUps;
          }
        });
      }

      // Calculate LinkedIn metrics
      if (enabledChannels.linkedin && linkedInActivities.length > 0) {
        // Count unique contacts per period for each metric
        const periodMetrics = {};
        allPeriods.forEach(period => {
          periodMetrics[period] = {
            connectionRequestSent: new Set(),
            connectionAccepted: new Set(),
            existingConnection: new Set(),
            conversationsInProgress: new Set(),
            meetingProposed: new Set(),
            meetingScheduled: new Set(),
            meetingCompleted: new Set(),
            firstMessageSent: new Set(),
            followupMessagesSent: new Set()
          };
        });

        // Process each LinkedIn activity once and classify by template + status
        linkedInActivities.forEach(activity => {
          // Use activity-specific date (linkedinDate) if available, otherwise use createdAt
          const activityDate = activity.linkedinDate ? new Date(activity.linkedinDate) : 
                              (activity.createdAt ? new Date(activity.createdAt) : null);
          if (!activityDate) return;
          
          const contactId = activity.contactId?.toString() || 'unknown';
          const period = viewMode === 'day'
            ? getDayKey(activityDate)
            : getMonthKey(activityDate);
          if (!periodMetrics[period]) return;

          // Connection Request Sent - count unique contacts per period
          // Include activities with lnRequestSent === 'Yes' OR introduction-message template
          // Check template field (handle empty string, null, undefined)
          const template = activity.template?.trim() || '';
          if (activity.lnRequestSent === 'Yes' || template === 'introduction-message') {
            periodMetrics[period].connectionRequestSent.add(contactId);
          }

          // Existing Connection - count unique contacts per period
          if (activity.lnRequestSent === 'Existing Connect') {
            periodMetrics[period].existingConnection.add(contactId);
          }

          // Connection Accepted - count unique contacts per period
          if (activity.connected === 'Yes') {
            periodMetrics[period].connectionAccepted.add(contactId);
          }

          // Status-based metrics - count unique contacts per period
          if (activity.status === 'CIP') {
            periodMetrics[period].conversationsInProgress.add(contactId);
          } else if (activity.status === 'Meeting Proposed') {
            periodMetrics[period].meetingProposed.add(contactId);
          } else if (activity.status === 'Meeting Scheduled') {
            periodMetrics[period].meetingScheduled.add(contactId);
          } else if (activity.status === 'Meeting Completed') {
            periodMetrics[period].meetingCompleted.add(contactId);
          }

          // Template-based metrics:
          // - Introduction Message template → First Message Sent
          // - Follow-up Message template   → Follow-up Messages Sent
          if (template === 'introduction-message') {
            periodMetrics[period].firstMessageSent.add(contactId);
          } else if (template === 'follow-up-message') {
            periodMetrics[period].followupMessagesSent.add(contactId);
          }
        });

        // Convert Sets to counts in data object
        allPeriods.forEach(period => {
          if (data[period] && periodMetrics[period]) {
            data[period].connectionRequestSent = periodMetrics[period].connectionRequestSent.size;
            data[period].connectionAccepted = periodMetrics[period].connectionAccepted.size;
            data[period].existingConnection = periodMetrics[period].existingConnection.size;
            data[period].conversationsInProgress = periodMetrics[period].conversationsInProgress.size;
            data[period].meetingProposed = periodMetrics[period].meetingProposed.size;
            data[period].meetingScheduled = periodMetrics[period].meetingScheduled.size;
            data[period].meetingCompleted = periodMetrics[period].meetingCompleted.size;
            data[period].firstMessageSent = periodMetrics[period].firstMessageSent.size;
            data[period].followupMessagesSent = periodMetrics[period].followupMessagesSent.size;
          }
        });
      }

      // Calculate Email metrics
      if (enabledChannels.email && emailActivities.length > 0) {
        emailActivities.forEach(activity => {
          if (!activity.createdAt) return;
          const period = viewMode === 'day' ? getDayKey(new Date(activity.createdAt)) : getMonthKey(new Date(activity.createdAt));
          if (!data[period]) return;

          data[period].emailsSent++;

          if (activity.status) {
            switch (activity.status) {
              case 'No Reply': data[period].noReply++; break;
              case 'Out of Office': data[period].outOfOffice++; break;
              case 'Wrong Person': data[period].wrongPerson++; break;
              case 'Bounce': data[period].bounce++; break;
              case 'Opt Out': data[period].optOut++; break;
            }
          }

          if (activity.status && activity.status !== 'No Reply' && activity.status !== 'Bounce' && activity.status !== 'Opt Out') {
            data[period].totalResponses++;
          }
        });

        allPeriods.forEach(period => {
          if (data[period] && data[period].emailsSent > 0) {
            data[period].responseRate = parseFloat(((data[period].totalResponses / data[period].emailsSent) * 100).toFixed(2));
          }
        });
      }

      setReportData(data);
      setCalculating(false);
    };

    const timeoutId = setTimeout(calculate, 0);
    return () => clearTimeout(timeoutId);
  }, [activities, contacts, viewMode, enabledChannels, allPeriods, getDayKey, getMonthKey]);

  useEffect(() => {
    calculateReportData();
  }, [calculateReportData]);

  // Build metrics array based on enabled channels
  const metrics = useMemo(() => {
    const allMetrics = [];

    if (enabledChannels.call && !enabledChannels.linkedin && !enabledChannels.email) {
      allMetrics.push(
        { key: 'dataAllocated', label: 'Data Allocated', section: 'Cold Calling', bold: false },
        { key: 'interested', label: 'Interested', section: 'Cold Calling', bold: true },
        { key: 'notInterested', label: 'Not Interested', section: 'Cold Calling', bold: true },
        { key: 'ring', label: 'Ring', section: 'Cold Calling', bold: false },
        { key: 'busy', label: 'Busy', section: 'Cold Calling', bold: false, highlight: true },
        { key: 'hangUp', label: 'Hang Up', section: 'Cold Calling', bold: false },
        { key: 'callBack', label: 'Call Back', section: 'Cold Calling', bold: false },
        { key: 'switchOff', label: 'Switch Off', section: 'Cold Calling', bold: false },
        { key: 'detailsShared', label: 'Detailed Shared', section: 'Cold Calling', bold: true, highlight: true },
        { key: 'future', label: 'Future', section: 'Cold Calling', bold: false },
        { key: 'invalid', label: 'Invalid', section: 'Cold Calling', bold: false },
        { key: 'demoBooked', label: 'Demo Booked', section: 'Cold Calling', bold: true, highlight: true, highlightDark: true },
        { key: 'followUps', label: 'Follow Ups', section: 'Cold Calling', bold: true },
        { key: 'totalCalls', label: 'Total Calls', section: 'Cold Calling', bold: true },
        { key: 'freshCalls', label: '(Fresh Calls + FollowUpS)', section: 'Cold Calling', bold: false, isFormula: true }
      );
    } else if (enabledChannels.linkedin) {
      allMetrics.push(
        { key: 'dataResearch', label: 'Data Research manually', section: 'Linked IN', bold: false },
        { key: 'connectionRequestSent', label: 'Connection Request Sent', section: 'Linked IN', bold: false },
        { key: 'connectionAccepted', label: 'Connection Accepted', section: 'Linked IN', bold: false },
        { key: 'firstMessageSent', label: 'First Message Sent', section: 'Linked IN', bold: false },
        { key: 'followupMessagesSent', label: 'Followup Messages sent', section: 'Linked IN', bold: false },
        { key: 'existingConnection', label: 'Existing Connection', section: 'Linked IN', bold: false },
        { key: 'conversationsInProgress', label: 'Conversations in Progress', section: 'Linked IN', bold: true, highlight: true },
        { key: 'meetingProposed', label: 'Meeting Proposed', section: 'Linked IN', bold: false, highlight: true },
        { key: 'meetingScheduled', label: 'Meeting Scheduled', section: 'Linked IN', bold: false, highlight: true },
        { key: 'meetingCompleted', label: 'Meeting Completed', section: 'Linked IN', bold: false, highlight: true }
      );
      
      if (enabledChannels.call) {
        allMetrics.push(
          { key: 'dataAllocated', label: 'Data Allocated', section: 'Cold Calling', bold: false },
          { key: 'interested', label: 'Interested', section: 'Cold Calling', bold: true },
          { key: 'notInterested', label: 'Not Interested', section: 'Cold Calling', bold: true },
          { key: 'ring', label: 'Ring', section: 'Cold Calling', bold: false },
          { key: 'busy', label: 'Busy', section: 'Cold Calling', bold: false, highlight: true },
          { key: 'hangUp', label: 'Hang Up', section: 'Cold Calling', bold: false },
          { key: 'callBack', label: 'Call Back', section: 'Cold Calling', bold: false },
          { key: 'switchOff', label: 'Switch Off', section: 'Cold Calling', bold: false },
          { key: 'detailsShared', label: 'Detailed Shared', section: 'Cold Calling', bold: true, highlight: true },
          { key: 'future', label: 'Future', section: 'Cold Calling', bold: false },
          { key: 'invalid', label: 'Invalid', section: 'Cold Calling', bold: false },
          { key: 'demoBooked', label: 'Demo Booked', section: 'Cold Calling', bold: true, highlight: true, highlightDark: true },
          { key: 'followUps', label: 'Follow Ups', section: 'Cold Calling', bold: true },
          { key: 'totalCalls', label: 'Total Calls', section: 'Cold Calling', bold: true }
        );
      }
      
      if (enabledChannels.email) {
        allMetrics.push(
          { key: 'emailsSent', label: 'Emails Sent', section: 'Email', bold: false },
          { key: 'noReply', label: 'No Reply', section: 'Email', bold: false },
          { key: 'outOfOffice', label: 'Out of Office', section: 'Email', bold: false },
          { key: 'wrongPerson', label: 'Wrong Person', section: 'Email', bold: false },
          { key: 'bounce', label: 'Bounce', section: 'Email', bold: false },
          { key: 'optOut', label: 'Opt Out', section: 'Email', bold: false },
          { key: 'totalResponses', label: 'Total Responses', section: 'Email', bold: true },
          { key: 'responseRate', label: 'Response Rate (%)', section: 'Email', bold: false }
        );
      }
    } else if (enabledChannels.email) {
      allMetrics.push(
        { key: 'emailsSent', label: 'Emails Sent', section: 'Email', bold: false },
        { key: 'noReply', label: 'No Reply', section: 'Email', bold: false },
        { key: 'outOfOffice', label: 'Out of Office', section: 'Email', bold: false },
        { key: 'wrongPerson', label: 'Wrong Person', section: 'Email', bold: false },
        { key: 'bounce', label: 'Bounce', section: 'Email', bold: false },
        { key: 'optOut', label: 'Opt Out', section: 'Email', bold: false },
        { key: 'totalResponses', label: 'Total Responses', section: 'Email', bold: true },
        { key: 'responseRate', label: 'Response Rate (%)', section: 'Email', bold: false }
      );
    }

    return allMetrics;
  }, [enabledChannels]);

  // Group metrics by section
  const groupedMetrics = useMemo(() => {
    const groups = {};
    metrics.forEach(metric => {
      if (!groups[metric.section]) {
        groups[metric.section] = [];
      }
      groups[metric.section].push(metric);
    });
    return groups;
  }, [metrics]);

  // Determine channel from section
  const getChannelFromSection = useCallback((section) => {
    if (section === 'Cold Calling') return 'call';
    if (section === 'Linked IN') return 'linkedin';
    if (section === 'Email') return 'email';
    return null;
  }, []);

  // Pre-index activities by period and contactId for faster lookups
  const activitiesIndex = useMemo(() => {
    const index = {
      byPeriodAndContact: new Map(), // Map<period, Map<contactId, activities[]>>
      byPeriodAndType: new Map(), // Map<period, Map<type, activities[]>>
      contactPeriods: new Map() // Map<contactId, Set<period>>
    };

    activities.forEach(a => {
      const activityProjectId = a.projectId?.toString ? a.projectId.toString() : a.projectId;
      if (activityProjectId !== id) return;

      const activityDate = a.callDate ? new Date(a.callDate) : 
                          a.emailDate ? new Date(a.emailDate) : 
                          a.linkedinDate ? new Date(a.linkedinDate) :
                          (a.createdAt ? new Date(a.createdAt) : null);
      if (!activityDate || isNaN(activityDate.getTime())) return;

      const activityPeriod = viewMode === 'day' ? getDayKey(activityDate) : getMonthKey(activityDate);
      const activityType = a.type;

      // Index by period and contactId
      if (!index.byPeriodAndContact.has(activityPeriod)) {
        index.byPeriodAndContact.set(activityPeriod, new Map());
      }
      const periodMap = index.byPeriodAndContact.get(activityPeriod);
      
      if (a.contactId) {
        const contactIdStr = a.contactId.toString ? a.contactId.toString() : a.contactId;
        if (!periodMap.has(contactIdStr)) {
          periodMap.set(contactIdStr, []);
        }
        periodMap.get(contactIdStr).push(a);

        // Track periods for each contact
        if (!index.contactPeriods.has(contactIdStr)) {
          index.contactPeriods.set(contactIdStr, new Set());
        }
        index.contactPeriods.get(contactIdStr).add(activityPeriod);
      }

      // Index by period and type
      if (!index.byPeriodAndType.has(activityPeriod)) {
        index.byPeriodAndType.set(activityPeriod, new Map());
      }
      const typeMap = index.byPeriodAndType.get(activityPeriod);
      if (!typeMap.has(activityType)) {
        typeMap.set(activityType, []);
      }
      typeMap.get(activityType).push(a);
    });

    return index;
  }, [activities, id, viewMode, getDayKey, getMonthKey]);

  // Filter prospects based on metric, period, and channel - OPTIMIZED
  const getFilteredProspects = useCallback((metric, period, channel) => {
    if (!metric || !period || !channel) return [];
    
    const contactsToFilter = allContactsForModal.length > 0 ? allContactsForModal : contacts;
    
    // Get all LinkedIn activities for first/followup message checks
    const allLinkedInActivities = activities.filter(a => a.type === 'linkedin');
    
    // Special case: show all prospects for a given period across all channels
    if (channel === 'all' && metric === 'allForPeriod') {
      return contactsToFilter.filter(contact => {
        const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
        
        // Check if contact has any activity in this period (any channel)
        const periodsForContact = activitiesIndex.contactPeriods.get(contactIdStr);
        const hasActivityInPeriod = periodsForContact ? periodsForContact.has(period) : false;
        
        // Also include contacts whose data was allocated in this period
        let allocatedInPeriod = false;
        if (contact.createdAt) {
          const contactPeriod = viewMode === 'day' 
            ? getDayKey(new Date(contact.createdAt)) 
            : getMonthKey(new Date(contact.createdAt));
          allocatedInPeriod = contactPeriod === period;
        }
        
        return hasActivityInPeriod || allocatedInPeriod;
      });
    }
    
    // Get activities for this period and channel from index
    const periodActivities = activitiesIndex.byPeriodAndType.get(period)?.get(channel) || [];
    
    // Create a Set of contactIds that have activities in this period
    const contactIdsWithActivities = new Set();
    periodActivities.forEach(a => {
      if (a.contactId) {
        const contactIdStr = a.contactId.toString ? a.contactId.toString() : a.contactId;
        contactIdsWithActivities.add(contactIdStr);
      }
    });
    
    // Filter contacts
    return contactsToFilter.filter(contact => {
      const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
      
      // Get activities for this contact in this period from index
      const contactActivities = activitiesIndex.byPeriodAndContact.get(period)?.get(contactIdStr) || [];
      
      // Filter by channel
      const channelActivities = contactActivities.filter(a => {
        if (channel === 'call' && a.type !== 'call') return false;
        if (channel === 'linkedin' && a.type !== 'linkedin') return false;
        if (channel === 'email' && a.type !== 'email') return false;
        return true;
      });
      
      // Check if activity matches the metric
      if (channel === 'call') {
        switch (metric) {
          case 'interested':
            return channelActivities.some(a => a.callStatus === 'Interested');
          case 'notInterested':
            return channelActivities.some(a => a.callStatus === 'Not Interested');
          case 'ring':
            return channelActivities.some(a => a.callStatus === 'Ring');
          case 'busy':
            return channelActivities.some(a => a.callStatus === 'Busy');
          case 'hangUp':
            return channelActivities.some(a => a.callStatus === 'Hang Up');
          case 'callBack':
            return channelActivities.some(a => a.callStatus === 'Call Back');
          case 'switchOff':
            return channelActivities.some(a => a.callStatus === 'Switch Off');
          case 'detailsShared':
            return channelActivities.some(a => a.callStatus === 'Details Shared');
          case 'future':
            return channelActivities.some(a => a.callStatus === 'Future');
          case 'invalid':
            return channelActivities.some(a => a.callStatus === 'Invalid');
          case 'demoBooked':
            return channelActivities.some(a => a.callStatus === 'Demo Booked');
          case 'dataAllocated':
            // For data allocated, check if contact was created in this period
            if (contact.createdAt) {
              const contactPeriod = viewMode === 'day' ? getDayKey(new Date(contact.createdAt)) : getMonthKey(new Date(contact.createdAt));
              return contactPeriod === period;
            }
            return false;
          default:
            return false;
        }
      } else if (channel === 'linkedin') {
        // Filter activities to only those in this period
        const periodActivities = channelActivities.filter(a => {
          if (!a.createdAt) return false;
          const activityPeriod = viewMode === 'day' ? getDayKey(new Date(a.createdAt)) : getMonthKey(new Date(a.createdAt));
          return activityPeriod === period;
        });

        if (periodActivities.length === 0) return false;

        switch (metric) {
          case 'dataResearch':
            if (contact.createdAt) {
              const contactPeriod = viewMode === 'day' ? getDayKey(new Date(contact.createdAt)) : getMonthKey(new Date(contact.createdAt));
              return contactPeriod === period;
            }
            return false;
          case 'connectionRequestSent':
            // Include activities with lnRequestSent === 'Yes' OR introduction-message template
            return periodActivities.some(a => {
              const template = a.template?.trim() || '';
              return a.lnRequestSent === 'Yes' || template === 'introduction-message';
            });
          case 'connectionAccepted':
            return periodActivities.some(a => a.connected === 'Yes');
          case 'firstMessageSent':
            // Count contacts that had an Introduction Message template in this period
            return periodActivities.some(a => {
              const template = a.template?.trim() || '';
              return template === 'introduction-message';
            });
          case 'followupMessagesSent':
            // Count contacts that had a Follow-up Message template in this period
            return periodActivities.some(a => {
              const template = a.template?.trim() || '';
              return template === 'follow-up-message';
            });
          case 'existingConnection':
            return periodActivities.some(a => a.lnRequestSent === 'Existing Connect');
          case 'conversationsInProgress':
            return periodActivities.some(a => a.status === 'CIP');
          case 'meetingProposed':
            return periodActivities.some(a => a.status === 'Meeting Proposed');
          case 'meetingScheduled':
            return periodActivities.some(a => a.status === 'Meeting Scheduled');
          case 'meetingCompleted':
            return periodActivities.some(a => a.status === 'Meeting Completed');
          default:
            return false;
        }
      } else if (channel === 'email') {
        switch (metric) {
          case 'emailsSent':
            return channelActivities.length > 0;
          case 'noReply':
            return channelActivities.some(a => a.status === 'No Reply');
          case 'outOfOffice':
            return channelActivities.some(a => a.status === 'Out of Office');
          case 'wrongPerson':
            return channelActivities.some(a => a.status === 'Wrong Person');
          case 'bounce':
            return channelActivities.some(a => a.status === 'Bounce');
          case 'optOut':
            return channelActivities.some(a => a.status === 'Opt Out');
          case 'totalResponses':
            return channelActivities.some(a => a.status && a.status !== 'No Reply' && a.status !== 'Bounce' && a.status !== 'Opt Out');
          default:
            return false;
        }
      }
      
      return false;
    });
  }, [allContactsForModal, contacts, activitiesIndex, activities, viewMode, getDayKey, getMonthKey]);

  // Fetch all contacts when modal opens - use existing contacts if available
  useEffect(() => {
    if (prospectModal.isOpen) {
      setLoadingProspects(true);
      
      // If we already have contacts loaded, use them immediately
      if (contacts.length > 0) {
        // Use existing contacts first for instant display
        setAllContactsForModal(contacts);
        setLoadingProspects(false);
        
        // Then fetch all contacts in background if needed
        if (contacts.length < 1000) { // Only fetch if we have less than 1000
          API.get(`/projects/${id}/project-contacts?limit=10000`)
            .then(response => {
              if (response.data.success) {
                setAllContactsForModal(response.data.data || []);
              }
            })
            .catch(err => {
              console.error('Error fetching contacts:', err);
            });
        }
      } else {
        // Fetch all contacts
        API.get(`/projects/${id}/project-contacts?limit=10000`)
          .then(response => {
            if (response.data.success) {
              setAllContactsForModal(response.data.data || []);
            }
          })
          .catch(err => {
            console.error('Error fetching contacts:', err);
          })
          .finally(() => {
            setLoadingProspects(false);
          });
      }
    } else {
      setAllContactsForModal([]);
    }
  }, [prospectModal.isOpen, id, contacts]);

  // Memoize filtered prospects to avoid recalculation - only calculate when modal is open
  const filteredProspectsForModal = useMemo(() => {
    if (!prospectModal.isOpen || !prospectModal.metric || !prospectModal.period || !prospectModal.channel) {
      return [];
    }
    // Use setTimeout to defer calculation and avoid blocking UI
    try {
      return getFilteredProspects(prospectModal.metric, prospectModal.period, prospectModal.channel);
    } catch (err) {
      console.error('Error filtering prospects:', err);
      return [];
    }
  }, [prospectModal.isOpen, prospectModal.metric, prospectModal.period, prospectModal.channel, getFilteredProspects]);

  // Handle number click
  const handleNumberClick = useCallback((metric, period, section) => {
    const channel = getChannelFromSection(section);
    if (!channel) return;
    
    const value = reportData[period]?.[metric.key] || 0;
    if (value === 0 || metric.isFormula) return; // Don't open modal for zero values or formulas
    
    setProspectModal({
      isOpen: true,
      metric: metric.key,
      period: period,
      channel: channel,
      section: section
    });
  }, [reportData, getChannelFromSection]);

  // Handle date header click - show all prospects for that period
  const handleDateHeaderClick = useCallback((period) => {
    // If there is no data for this period, do nothing
    const periodData = reportData[period];
    if (!periodData || Object.values(periodData).every(value => !value || value === 0)) {
      return;
    }
    
    setProspectModal({
      isOpen: true,
      metric: 'allForPeriod',
      period,
      channel: 'all',
      section: 'All Channels'
    });
  }, [reportData]);

  // Export to Excel with enhanced formatting
  const exportToExcel = useCallback(() => {
    if (allPeriods.length === 0 || !reportData) {
      alert('No data available to export');
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();
      const worksheetData = [];

      // Add title row
      const titleRow = [`Monthly Report - ${project?.companyName || 'Report'}`];
      for (let i = 0; i < allPeriods.length; i++) {
        titleRow.push('');
      }
      worksheetData.push(titleRow);

      // Add subtitle row with view mode and date
      const subtitleRow = [`${viewMode === 'day' ? 'Day' : 'Month'} View - Exported on ${new Date().toLocaleDateString()}`];
      for (let i = 0; i < allPeriods.length; i++) {
        subtitleRow.push('');
      }
      worksheetData.push(subtitleRow);

      // Add empty row for spacing
      worksheetData.push(Array(allPeriods.length + 1).fill(''));

      // Add header row
      const headerRow = ['Key Results', ...allPeriods];
      worksheetData.push(headerRow);

      // Track row positions for styling
      let currentRowIndex = 0;
      const rowStyles = [];

      // Style title row
      rowStyles[currentRowIndex] = {
        cells: Array(titleRow.length).fill({
          font: { bold: true, sz: 16, color: { rgb: '1E3A8A' } },
          fill: { fgColor: { rgb: 'FFFFFF' } }, // White background
          alignment: { horizontal: 'left', vertical: 'center' }
        }),
        merge: { s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: allPeriods.length } }
      };
      currentRowIndex++;

      // Style subtitle row
      rowStyles[currentRowIndex] = {
        cells: Array(subtitleRow.length).fill({
          font: { sz: 10, color: { rgb: '6B7280' } },
          fill: { fgColor: { rgb: 'FFFFFF' } }, // White background
          alignment: { horizontal: 'left', vertical: 'center' }
        }),
        merge: { s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: allPeriods.length } }
      };
      currentRowIndex++;

      // Empty row (no special styling)
      currentRowIndex++;

      // Style header row - white background with dark text
      rowStyles[currentRowIndex] = {
        cells: Array(headerRow.length).fill({
          font: { bold: true, color: { rgb: '1F2937' }, sz: 11 }, // Dark gray text
          fill: { fgColor: { rgb: 'FFFFFF' } }, // White background
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } }, // Light gray border
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } }
          }
        })
      };
      currentRowIndex++;

      // Count enabled channels
      const enabledChannelsCount = Object.values(enabledChannels).filter(Boolean).length;
      const sections = Object.keys(groupedMetrics);
      
      // If multiple channels, export each section as a separate table
      if (enabledChannelsCount > 1) {
        sections.forEach((section, sectionIndex) => {
          // Add section title row (only for first section or when starting a new section)
          if (sectionIndex > 0) {
            // Add empty row for spacing between tables
            worksheetData.push(Array(allPeriods.length + 1).fill(''));
            currentRowIndex++;
          }
          
          // Add section title
          const sectionTitleRow = [section];
          for (let i = 0; i < allPeriods.length; i++) {
            sectionTitleRow.push('');
          }
          worksheetData.push(sectionTitleRow);
          
          // Style section title row
          rowStyles[currentRowIndex] = {
            cells: Array(sectionTitleRow.length).fill({
              font: { bold: true, sz: 14, color: { rgb: '1E3A8A' } },
              fill: { fgColor: { rgb: 'FFFFFF' } },
              alignment: { horizontal: 'left', vertical: 'center' }
            }),
            merge: { s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: allPeriods.length } }
          };
          currentRowIndex++;
          
          // Add header row for this section
          const sectionHeaderRow = ['Key Results', ...allPeriods];
          worksheetData.push(sectionHeaderRow);
          
          // Style section header row
          rowStyles[currentRowIndex] = {
            cells: Array(sectionHeaderRow.length).fill({
              font: { bold: true, color: { rgb: '1F2937' }, sz: 11 },
              fill: { fgColor: { rgb: 'FFFFFF' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                right: { style: 'thin', color: { rgb: 'E5E7EB' } }
              }
            })
          };
          currentRowIndex++;
          
          // Process each month group for this section
          groupedPeriods.forEach((group, groupIndex) => {
            // Add month header row (only for day view)
            if (viewMode === 'day' && group.month) {
              const monthRow = [group.month];
              for (let i = 0; i < allPeriods.length; i++) {
                monthRow.push('');
              }
              worksheetData.push(monthRow);

              // Style month header row
              rowStyles[currentRowIndex] = {
                cells: Array(monthRow.length).fill({
                  font: { bold: true, sz: 12, color: { rgb: '1F2937' } },
                  fill: { fgColor: { rgb: 'FFF9C4' } },
                  alignment: { horizontal: 'center', vertical: 'center' },
                  border: {
                    top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                  }
                }),
                merge: { s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: allPeriods.length } }
              };
              currentRowIndex++;
            }

            // Add section header and metrics (only show once per month group)
            if (groupIndex === 0 || (viewMode === 'day' && groupIndex > 0 && groupedPeriods[groupIndex - 1].monthKey !== group.monthKey)) {
              // Add section header row
              const sectionRow = [section];
              for (let i = 0; i < allPeriods.length; i++) {
                sectionRow.push('');
              }
              worksheetData.push(sectionRow);

              // Style section header row
              rowStyles[currentRowIndex] = {
                cells: Array(sectionRow.length).fill({
                  font: { bold: true, sz: 11, color: { rgb: '1F2937' } },
                  fill: { fgColor: { rgb: 'FFE082' } },
                  alignment: { horizontal: 'left', vertical: 'center' },
                  border: {
                    top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                  }
                })
              };
              currentRowIndex++;

              // Add metric rows for this section
              groupedMetrics[section].forEach((metric) => {
                const metricRow = [metric.label];
                allPeriods.forEach((period) => {
                  let value = '';
                  if (metric.isFormula) {
                    value = `(${reportData[period]?.freshCalls || 0} + ${reportData[period]?.followUps || 0})`;
                  } else if (metric.key === 'responseRate') {
                    value = `${reportData[period]?.[metric.key] || 0}%`;
                  } else {
                    value = reportData[period]?.[metric.key] || 0;
                  }
                  metricRow.push(value);
                });
                worksheetData.push(metricRow);

                // Style metric row
                const bgColor = metric.highlight 
                  ? (metric.highlightDark ? 'C8E6C9' : 'E8F5E9')
                  : 'FFFFFF';
                
                rowStyles[currentRowIndex] = {
                  cells: metricRow.map((cell, colIndex) => ({
                    font: { 
                      bold: metric.bold || colIndex === 0, 
                      sz: 10,
                      color: { rgb: colIndex === 0 ? '1F2937' : '374151' }
                    },
                    fill: { fgColor: { rgb: bgColor } },
                    alignment: { 
                      horizontal: colIndex === 0 ? 'left' : 'center', 
                      vertical: 'center' 
                    },
                    border: {
                      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                      right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                    },
                    numFmt: colIndex > 0 && typeof cell === 'number' ? '0' : undefined
                  }))
                };
                currentRowIndex++;
              });
            }
          });
        });
      } else {
        // Single channel - use original logic
        groupedPeriods.forEach((group, groupIndex) => {
          // Add month header row (only for day view)
          if (viewMode === 'day' && group.month) {
            const monthRow = [group.month];
            for (let i = 0; i < allPeriods.length; i++) {
              monthRow.push('');
            }
            worksheetData.push(monthRow);

            // Style month header row (yellow background with light borders)
            rowStyles[currentRowIndex] = {
              cells: Array(monthRow.length).fill({
                font: { bold: true, sz: 12, color: { rgb: '1F2937' } },
                fill: { fgColor: { rgb: 'FFF9C4' } }, // Yellow background
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                  top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                  bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                  left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                  right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                }
              }),
              merge: { s: { r: currentRowIndex, c: 0 }, e: { r: currentRowIndex, c: allPeriods.length } }
            };
            currentRowIndex++;
          }

          // Add section headers and metrics (only show once per month group)
          if (groupIndex === 0 || (viewMode === 'day' && groupIndex > 0 && groupedPeriods[groupIndex - 1].monthKey !== group.monthKey)) {
            Object.keys(groupedMetrics).forEach((section) => {
              // Add section header row
              const sectionRow = [section];
              for (let i = 0; i < allPeriods.length; i++) {
                sectionRow.push('');
              }
              worksheetData.push(sectionRow);

              // Style section header row (amber background with light borders)
              rowStyles[currentRowIndex] = {
                cells: Array(sectionRow.length).fill({
                  font: { bold: true, sz: 11, color: { rgb: '1F2937' } },
                  fill: { fgColor: { rgb: 'FFE082' } }, // Amber background
                  alignment: { horizontal: 'left', vertical: 'center' },
                  border: {
                    top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                  }
                })
              };
              currentRowIndex++;

              // Add metric rows
              groupedMetrics[section].forEach((metric) => {
                const metricRow = [metric.label];
                allPeriods.forEach((period) => {
                  let value = '';
                  if (metric.isFormula) {
                    value = `(${reportData[period]?.freshCalls || 0} + ${reportData[period]?.followUps || 0})`;
                  } else if (metric.key === 'responseRate') {
                    value = `${reportData[period]?.[metric.key] || 0}%`;
                  } else {
                    value = reportData[period]?.[metric.key] || 0;
                  }
                  metricRow.push(value);
                });
                worksheetData.push(metricRow);

                // Style metric row - white background with subtle borders
                const bgColor = metric.highlight 
                  ? (metric.highlightDark ? 'C8E6C9' : 'E8F5E9') // Green background for highlighted metrics
                  : 'FFFFFF'; // White background
                
                rowStyles[currentRowIndex] = {
                  cells: metricRow.map((cell, colIndex) => ({
                    font: { 
                      bold: metric.bold || colIndex === 0, 
                      sz: 10,
                      color: { rgb: colIndex === 0 ? '1F2937' : '374151' } // Dark gray text
                    },
                    fill: { fgColor: { rgb: bgColor } },
                    alignment: { 
                      horizontal: colIndex === 0 ? 'left' : 'center', 
                      vertical: 'center' 
                    },
                    border: {
                      top: { style: 'thin', color: { rgb: 'E5E7EB' } }, // Light gray borders
                      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                      right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                    },
                    numFmt: colIndex > 0 && typeof cell === 'number' ? '0' : undefined
                  }))
                };
                currentRowIndex++;
              });
            });
          }
        });
      }

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Apply styles to cells and handle merges
      Object.keys(worksheet).forEach((cellAddress) => {
        if (cellAddress.startsWith('!')) return;
        
        const cell = XLSX.utils.decode_cell(cellAddress);
        const rowStyle = rowStyles[cell.r];
        
        if (rowStyle) {
          // Handle merged cells
          if (rowStyle.merge && cell.c === 0) {
            if (!worksheet['!merges']) worksheet['!merges'] = [];
            worksheet['!merges'].push(rowStyle.merge);
          }
          
          const cellStyle = rowStyle.cells[cell.c];
          if (cellStyle) {
            worksheet[cellAddress].s = cellStyle;
          }
        }
      });

      // Set column widths
      const colWidths = [{ wch: 28 }]; // Key Results column (wider for better readability)
      allPeriods.forEach(() => {
        colWidths.push({ wch: 14 }); // Period columns
      });
      worksheet['!cols'] = colWidths;

      // Set row heights
      worksheet['!rows'] = [];
      rowStyles.forEach((rowStyle, index) => {
        if (rowStyle && rowStyle.merge) {
          worksheet['!rows'][index] = { hpt: 25 }; // Taller for month headers
        } else if (index === 0) {
          worksheet['!rows'][index] = { hpt: 22 }; // Header row
        } else {
          worksheet['!rows'][index] = { hpt: 18 }; // Regular rows
        }
      });

      // Freeze first column and header row (accounting for title rows)
      worksheet['!freeze'] = { xSplit: 1, ySplit: 4, topLeftCell: 'B5', activePane: 'bottomRight', state: 'frozen' };

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

      // Generate filename
      const viewModeText = viewMode === 'day' ? 'Day' : 'Month';
      const filename = `${project?.companyName || 'Report'}_${viewModeText}_View_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Write file
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export report. Please try again.');
    }
  }, [allPeriods, reportData, groupedPeriods, groupedMetrics, viewMode, project]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-indigo-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 bg-indigo-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-6 text-lg font-semibold text-gray-700">Loading Report Data</p>
          <p className="mt-2 text-sm text-gray-500">Please wait while we fetch your analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Error Loading Report</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/projects')}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Back to Projects
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl p-8 text-center max-w-md">
          <p className="text-gray-600 mb-4">Project not found</p>
          <button
            onClick={() => navigate('/projects')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 lg:top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <button
            onClick={() => navigate(`/projects/${id}`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 mb-4 group"
          >
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Prospect Management
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Monthly Report</h1>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-indigo-600">{project.companyName}</h2>
                {project.website && (
                  <a 
                    href={project.website.startsWith('http') ? project.website : `http://${project.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {project.website}
                  </a>
                )}
              </div>
            </div>

            {/* View Mode Toggle and Export */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1.5 border border-gray-200 shadow-inner">
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewMode === 'day'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
                      : 'text-gray-700 hover:bg-white hover:text-gray-900'
                  }`}
                >
                  Day View
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewMode === 'month'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
                      : 'text-gray-700 hover:bg-white hover:text-gray-900'
                  }`}
                >
                  Month View
                </button>
              </div>
              
              {/* Export Button */}
              <button
                onClick={exportToExcel}
                disabled={allPeriods.length === 0 || calculating}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-semibold text-sm flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {calculating && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
            <p className="text-sm font-medium text-blue-800">Calculating report metrics...</p>
          </div>
        )}

        {/* Report Table */}
        {allPeriods.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">There is no data available for this period.</p>
          </div>
        ) : (() => {
          // Count enabled channels
          const enabledChannelsCount = Object.values(enabledChannels).filter(Boolean).length;
          const sections = Object.keys(groupedMetrics);
          
          // If only one channel is enabled, show single table (current behavior)
          if (enabledChannelsCount === 1) {
            return (
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border-collapse">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider border-r-2 border-gray-300 sticky left-0 bg-blue-50 z-20">
                          Key Results
                        </th>
                        {allPeriods.map((period) => (
                          <th
                            key={period}
                            onClick={() => handleDateHeaderClick(period)}
                            className="px-3 sm:px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider border-r border-gray-300 last:border-r-0 bg-blue-50 cursor-pointer hover:underline"
                          >
                            {period}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {groupedPeriods.map((group, groupIndex) => (
                        <React.Fragment key={group.monthKey || groupIndex}>
                          {/* Month Title Row (only for day view) */}
                          {viewMode === 'day' && group.month && (
                            <tr>
                              <td 
                                colSpan={allPeriods.length + 1} 
                                className="px-4 sm:px-6 py-2.5 bg-yellow-100 text-center font-bold text-sm text-gray-900 border-b-2 border-yellow-300"
                              >
                                {group.month}
                              </td>
                            </tr>
                          )}
                          
                          {/* Section Headers and Metrics - only show once per month group */}
                          {groupIndex === 0 || (viewMode === 'day' && groupIndex > 0 && groupedPeriods[groupIndex - 1].monthKey !== group.monthKey) ? (
                            Object.keys(groupedMetrics).map((section) => (
                              <React.Fragment key={`${group.monthKey || groupIndex}-${section}`}>
                                <tr className="bg-amber-50 border-y border-amber-200">
                                  <td colSpan={allPeriods.length + 1} className="px-4 sm:px-6 py-2.5 sticky left-0 bg-amber-50 z-20">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                                      <span className="text-xs font-bold text-gray-900">{section}</span>
                                    </div>
                                  </td>
                                </tr>
                                {groupedMetrics[section].map((metric) => (
                                  <tr
                                    key={`${group.monthKey || groupIndex}-${section}-${metric.key}`}
                                    className={`${
                                      metric.highlight
                                        ? metric.highlightDark 
                                          ? 'bg-green-100' 
                                          : 'bg-green-50'
                                        : 'bg-white hover:bg-gray-50'
                                    } transition-colors duration-150`}
                                  >
                                    <td className={`px-4 sm:px-6 py-3 whitespace-nowrap text-sm border-r-2 border-gray-200 sticky left-0 z-20 ${
                                      metric.highlight
                                        ? metric.highlightDark 
                                          ? 'bg-green-100' 
                                          : 'bg-green-50'
                                        : 'bg-white'
                                    } ${metric.bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                      {metric.label}
                                    </td>
                                    {allPeriods.map((period) => {
                                      const value = metric.isFormula 
                                        ? `(${reportData[period]?.freshCalls || 0} + ${reportData[period]?.followUps || 0})`
                                        : (metric.key === 'responseRate' 
                                            ? `${reportData[period]?.[metric.key] || 0}%`
                                            : (reportData[period]?.[metric.key] || 0));
                                      const isClickable = !metric.isFormula && value !== 0 && value !== '0%';
                                      
                                      return (
                                        <td
                                          key={period}
                                          onClick={() => isClickable && handleNumberClick(metric, period, section)}
                                          className={`px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-center border-r border-gray-200 last:border-r-0 ${
                                            metric.highlight
                                              ? metric.highlightDark 
                                                ? 'bg-green-100' 
                                                : 'bg-green-50'
                                              : 'bg-white'
                                          } ${
                                            metric.bold
                                              ? 'font-bold text-gray-900'
                                              : 'font-medium text-gray-700'
                                          } ${
                                            isClickable ? 'cursor-pointer hover:bg-blue-50 hover:underline' : ''
                                          }`}
                                        >
                                          {value}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))
                          ) : null}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          
          // If multiple channels are enabled, show separate tables for each channel
          return (
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section} className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border-collapse">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider border-r-2 border-gray-300 sticky left-0 bg-blue-50 z-20">
                            Key Results
                          </th>
                          {allPeriods.map((period) => (
                            <th
                              key={period}
                              onClick={() => handleDateHeaderClick(period)}
                              className="px-3 sm:px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider border-r border-gray-300 last:border-r-0 bg-blue-50 cursor-pointer hover:underline"
                            >
                              {period}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupedPeriods.map((group, groupIndex) => (
                          <React.Fragment key={group.monthKey || groupIndex}>
                            {/* Month Title Row (only for day view) */}
                            {viewMode === 'day' && group.month && (
                              <tr>
                                <td 
                                  colSpan={allPeriods.length + 1} 
                                  className="px-4 sm:px-6 py-2.5 bg-yellow-100 text-center font-bold text-sm text-gray-900 border-b-2 border-yellow-300"
                                >
                                  {group.month}
                                </td>
                              </tr>
                            )}
                            
                            {/* Section Header and Metrics - only show once per month group */}
                            {groupIndex === 0 || (viewMode === 'day' && groupIndex > 0 && groupedPeriods[groupIndex - 1].monthKey !== group.monthKey) ? (
                              <React.Fragment>
                                <tr className="bg-amber-50 border-y border-amber-200">
                                  <td colSpan={allPeriods.length + 1} className="px-4 sm:px-6 py-2.5 sticky left-0 bg-amber-50 z-20">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                                      <span className="text-xs font-bold text-gray-900">{section}</span>
                                    </div>
                                  </td>
                                </tr>
                                {groupedMetrics[section].map((metric) => (
                                  <tr
                                    key={`${group.monthKey || groupIndex}-${section}-${metric.key}`}
                                    className={`${
                                      metric.highlight
                                        ? metric.highlightDark 
                                          ? 'bg-green-100' 
                                          : 'bg-green-50'
                                        : 'bg-white hover:bg-gray-50'
                                    } transition-colors duration-150`}
                                  >
                                    <td className={`px-4 sm:px-6 py-3 whitespace-nowrap text-sm border-r-2 border-gray-200 sticky left-0 z-20 ${
                                      metric.highlight
                                        ? metric.highlightDark 
                                          ? 'bg-green-100' 
                                          : 'bg-green-50'
                                        : 'bg-white'
                                    } ${metric.bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                      {metric.label}
                                    </td>
                                    {allPeriods.map((period) => {
                                      const value = metric.isFormula 
                                        ? `(${reportData[period]?.freshCalls || 0} + ${reportData[period]?.followUps || 0})`
                                        : (metric.key === 'responseRate' 
                                            ? `${reportData[period]?.[metric.key] || 0}%`
                                            : (reportData[period]?.[metric.key] || 0));
                                      const isClickable = !metric.isFormula && value !== 0 && value !== '0%';
                                      
                                      return (
                                        <td
                                          key={period}
                                          onClick={() => isClickable && handleNumberClick(metric, period, section)}
                                          className={`px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-center border-r border-gray-200 last:border-r-0 ${
                                            metric.highlight
                                              ? metric.highlightDark 
                                                ? 'bg-green-100' 
                                                : 'bg-green-50'
                                              : 'bg-white'
                                          } ${
                                            metric.bold
                                              ? 'font-bold text-gray-900'
                                              : 'font-medium text-gray-700'
                                          } ${
                                            isClickable ? 'cursor-pointer hover:bg-blue-50 hover:underline' : ''
                                          }`}
                                        >
                                          {value}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </React.Fragment>
                            ) : null}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Prospect Modal */}
      {prospectModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {(() => {
                    if (!prospectModal.metric) return '';
                    if (prospectModal.metric === 'allForPeriod') {
                      return `All Prospects - ${prospectModal.section}`;
                    }
                    const metricDef = metrics.find(m => m.key === prospectModal.metric);
                    return `${metricDef?.label || prospectModal.metric} - ${prospectModal.section}`;
                  })()}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Period: {prospectModal.period}
                </p>
                {!loadingProspects && (
                  <p className="text-xs text-gray-500 mt-1">
                    Showing {getFilteredProspects(prospectModal.metric, prospectModal.period, prospectModal.channel).length} prospects
                  </p>
                )}
              </div>
              <button
                onClick={() => setProspectModal({ isOpen: false, metric: null, period: null, channel: null, section: null })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingProspects ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm font-medium">Loading prospects...</p>
                </div>
              ) : (() => {
                if (filteredProspectsForModal.length === 0) {
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
                        {filteredProspectsForModal.map((contact) => {
                          const contactIdStr = (contact._id?.toString ? contact._id.toString() : contact._id) || '';
                          
                          // Find the matching activity for this period using index (much faster)
                          const periodActivities = activitiesIndex.byPeriodAndContact.get(prospectModal.period)?.get(contactIdStr) || [];
                          const matchingActivity = periodActivities.find(a => {
                            // Filter by channel
                            if (prospectModal.channel === 'call' && a.type !== 'call') return false;
                            if (prospectModal.channel === 'linkedin' && a.type !== 'linkedin') return false;
                            if (prospectModal.channel === 'email' && a.type !== 'email') return false;
                            
                            // Check if it matches the metric
                            if (prospectModal.channel === 'call') {
                              const statusMap = {
                                'interested': 'Interested',
                                'notInterested': 'Not Interested',
                                'ring': 'Ring',
                                'busy': 'Busy',
                                'hangUp': 'Hang Up',
                                'callBack': 'Call Back',
                                'switchOff': 'Switch Off',
                                'detailsShared': 'Details Shared',
                                'future': 'Future',
                                'invalid': 'Invalid',
                                'demoBooked': 'Demo Booked'
                              };
                              return a.callStatus === statusMap[prospectModal.metric];
                            }
                            // For LinkedIn and Email, return first matching activity
                            return true;
                          }) || periodActivities[0]; // Fallback to first activity if no exact match
                          
                          const activityDate = matchingActivity 
                            ? (matchingActivity.callDate ? new Date(matchingActivity.callDate) : 
                               matchingActivity.emailDate ? new Date(matchingActivity.emailDate) : 
                               new Date(matchingActivity.createdAt))
                            : (contact.createdAt ? new Date(contact.createdAt) : null);
                          
                          const formattedDate = activityDate ? activityDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : 'N/A';
                          
                          const status = matchingActivity?.callStatus || matchingActivity?.status || contact.stage || 'New';

                          return (
                            <tr 
                              key={contact._id || contact.name} 
                              className="hover:bg-gray-50 transition-colors"
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
                                  {status}
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
