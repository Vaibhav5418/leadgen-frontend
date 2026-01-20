import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api/axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Lazy load chart components
const Line = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));
const Bar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
const Doughnut = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Doughnut })));
const Pie = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Pie })));

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

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

export default function ProspectDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get('projectId') || '');
  const [selectedStage, setSelectedStage] = useState(null);
  const [stageData, setStageData] = useState([]);
  const [loadingStageData, setLoadingStageData] = useState(false);
  const [notification, setNotification] = useState(null);
  const [teamTimeFilter, setTeamTimeFilter] = useState('today'); // 'today', 'last7days', 'lastMonth'
  const [teamActivityData, setTeamActivityData] = useState(null);
  const [loadingTeamActivity, setLoadingTeamActivity] = useState(false);
  const [teamMemberFunnels, setTeamMemberFunnels] = useState([]);
  const [loadingTeamFunnels, setLoadingTeamFunnels] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedStage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedStage]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedProject]);

  useEffect(() => {
    fetchTeamActivityData();
  }, [selectedProject, teamTimeFilter]);

  useEffect(() => {
    fetchTeamMemberFunnels();
  }, [selectedProject]);

  const fetchTeamMemberFunnels = async () => {
    try {
      setLoadingTeamFunnels(true);
      const params = selectedProject ? { projectId: selectedProject } : {};
      const response = await API.get('/projects/team-member-funnels', { params });
      if (response.data.success) {
        setTeamMemberFunnels(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching team member funnels:', error);
      setTeamMemberFunnels([]);
    } finally {
      setLoadingTeamFunnels(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await API.get('/projects');
      if (response.data.success) {
        setProjects(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = selectedProject ? { projectId: selectedProject } : {};
      const response = await API.get('/projects/prospect-analytics', { params });
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching prospect analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamActivityData = async () => {
    try {
      setLoadingTeamActivity(true);
      const params = {
        timeFilter: teamTimeFilter
      };
      if (selectedProject) {
        params.projectId = selectedProject;
      }
      const response = await API.get('/activities/team-performance', { params });
      if (response.data.success) {
        setTeamActivityData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching team activity data:', error);
      setTeamActivityData(null);
    } finally {
      setLoadingTeamActivity(false);
    }
  };

  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    if (projectId) {
      setSearchParams({ projectId });
    } else {
      setSearchParams({});
    }
  };

  const fetchStageData = async (stage, funnelType, funnelData) => {
    try {
      setLoadingStageData(true);
      setSelectedStage({ stage, funnelType, funnelData });
      
      // Handle Prospect Data stage - fetch all prospects with their latest activity status
      if (stage === 'prospectData') {
        if (!selectedProject) {
          setNotification({ type: 'info', message: 'Please select a project to view prospects' });
          setLoadingStageData(false);
          return;
        }
        
        // Fetch both prospects and activities in parallel
        const [prospectsResponse, activitiesResponse] = await Promise.all([
          API.get(`/projects/${selectedProject}/project-contacts`),
          API.get(`/activities/project/${selectedProject}?limit=10000`)
        ]);
        
        if (prospectsResponse.data.success) {
          const prospects = prospectsResponse.data.data || [];
          const activities = activitiesResponse.data.success ? (activitiesResponse.data.data || []) : [];
          
          // Build activity status lookup by contactId - find most recent status for each contact
          const latestStatusByContactId = new Map();
          activities.forEach(activity => {
            if (activity.contactId && activity.status && activity.status.trim() !== '') {
              const contactIdStr = activity.contactId.toString ? activity.contactId.toString() : String(activity.contactId);
              const activityDate = getActivityDate(activity);
              const existing = latestStatusByContactId.get(contactIdStr);
              
              if (!existing || activityDate > existing.activityDate) {
                latestStatusByContactId.set(contactIdStr, {
                  status: activity.status,
                  activityDate: activityDate
                });
              }
            }
          });
          
          // Map prospects with their latest status from Activity History
          setStageData(prospects.map(prospect => {
            const prospectIdStr = prospect._id?.toString ? prospect._id.toString() : String(prospect._id);
            const latestStatusData = latestStatusByContactId.get(prospectIdStr);
            // Use latest status from Activity History, fallback to database stage, then 'New'
            const displayStatus = latestStatusData?.status || prospect.stage || 'New';
            
            return {
              ...prospect,
              isProspect: true,
              displayStatus: displayStatus // Store the calculated status
            };
          }));
        }
        setLoadingStageData(false);
        return;
      }

      // Handle other stages - fetch activities
      if (!selectedProject) {
        setNotification({ type: 'info', message: 'Please select a project to view stage details' });
        setLoadingStageData(false);
        return;
      }

      const response = await API.get(`/activities/project/${selectedProject}`);
      
      if (response.data.success) {
        const activities = response.data.data || [];
        let filteredActivities = [];

        if (funnelType === 'call') {
          switch (stage) {
            // New 10-stage structure
            case 'callsAttempted':
            case 'callSent': // Legacy support
              filteredActivities = activities.filter(a => a.type === 'call' && a.callDate);
              break;
            case 'callsConnected':
            case 'accepted': // Legacy support
              const connectedStatuses = ['Interested', 'Not Interested', 'Call Back', 'Future', 'Details Shared', 'Demo Booked', 'Demo Completed', 'Existing'];
              filteredActivities = activities.filter(a => 
                a.type === 'call' && 
                a.callStatus && connectedStatuses.includes(a.callStatus)
              );
              break;
            case 'decisionMakerReached':
              const decisionMakerStatuses = ['Interested', 'Details Shared', 'Demo Booked', 'Demo Completed'];
              filteredActivities = activities.filter(a => 
                a.type === 'call' && 
                a.callStatus && decisionMakerStatuses.includes(a.callStatus)
              );
              break;
            case 'interested':
              filteredActivities = activities.filter(a => 
                a.type === 'call' && a.callStatus === 'Interested'
              );
              break;
            case 'detailsShared':
              filteredActivities = activities.filter(a => 
                a.type === 'call' && a.callStatus === 'Details Shared'
              );
              break;
            case 'demoBooked':
            case 'scheduled': // Legacy support
              filteredActivities = activities.filter(a => 
                a.type === 'call' && a.callStatus === 'Demo Booked'
              );
              break;
            case 'demoCompleted':
            case 'completed': // Legacy support
              filteredActivities = activities.filter(a => 
                a.type === 'call' && a.callStatus === 'Demo Completed'
              );
              break;
            case 'sql':
              filteredActivities = activities.filter(a => 
                a.type === 'call' && 
                (a.callStatus === 'Demo Completed' || 
                 (a.callStatus === 'Interested' && a.conversationNotes && a.conversationNotes.length > 50) ||
                 a.status === 'SQL')
              );
              break;
            // Legacy stages (for backward compatibility)
            case 'followups':
              const callCounts = {};
              activities.filter(a => a.type === 'call' && a.callDate).forEach(a => {
                const contactId = a.contactId?.toString();
                if (contactId) {
                  callCounts[contactId] = (callCounts[contactId] || 0) + 1;
                }
              });
              const followupContactIds = Object.keys(callCounts).filter(id => callCounts[id] > 1);
              filteredActivities = activities.filter(a => 
                a.type === 'call' && 
                followupContactIds.includes(a.contactId?.toString())
              );
              break;
            case 'cip':
              filteredActivities = activities.filter(a => 
                a.type === 'call' && 
                ['Interested', 'Call Back', 'Future'].includes(a.callStatus)
              );
              break;
            case 'meetingProposed':
              filteredActivities = activities.filter(a => 
                a.type === 'call' && 
                a.nextAction && (
                  a.nextAction.toLowerCase().includes('meeting') ||
                  a.nextAction.toLowerCase().includes('demo') ||
                  a.nextAction.toLowerCase().includes('call')
                )
              );
              break;
          }
        } else if (funnelType === 'email') {
          switch (stage) {
            case 'emailSent':
              filteredActivities = activities.filter(a => a.type === 'email' && a.emailDate);
              break;
            case 'accepted':
              filteredActivities = activities.filter(a => 
                a.type === 'email' && 
                ['Interested', 'Meeting Proposed', 'Meeting Scheduled'].includes(a.status)
              );
              break;
            case 'followups':
              const emailCounts = {};
              activities.filter(a => a.type === 'email' && a.emailDate).forEach(a => {
                const contactId = a.contactId?.toString();
                if (contactId) {
                  emailCounts[contactId] = (emailCounts[contactId] || 0) + 1;
                }
              });
              const emailFollowupContactIds = Object.keys(emailCounts).filter(id => emailCounts[id] > 1);
              filteredActivities = activities.filter(a => 
                a.type === 'email' && 
                emailFollowupContactIds.includes(a.contactId?.toString())
              );
              break;
            case 'cip':
              filteredActivities = activities.filter(a => 
                a.type === 'email' && a.status === 'CIP'
              );
              break;
            case 'meetingProposed':
              filteredActivities = activities.filter(a => 
                a.type === 'email' && a.status === 'Meeting Proposed'
              );
              break;
            case 'scheduled':
              filteredActivities = activities.filter(a => 
                a.type === 'email' && a.status === 'Meeting Scheduled'
              );
              break;
            case 'completed':
              filteredActivities = activities.filter(a => 
                a.type === 'email' && a.status === 'Meeting Completed'
              );
              break;
            case 'sql':
              filteredActivities = activities.filter(a => 
                a.type === 'email' && 
                ['SQL', 'Meeting Completed'].includes(a.status)
              );
              break;
          }
        } else if (funnelType === 'linkedin') {
          switch (stage) {
            case 'connectionSent':
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && 
                (a.lnRequestSent === 'Yes' || a.lnRequestSent === true)
              );
              break;
            case 'accepted':
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && 
                (a.connected === 'Yes' || a.connected === true)
              );
              break;
            case 'followups':
              const linkedinCounts = {};
              activities.filter(a => a.type === 'linkedin').forEach(a => {
                const contactId = a.contactId?.toString();
                if (contactId) {
                  linkedinCounts[contactId] = (linkedinCounts[contactId] || 0) + 1;
                }
              });
              const linkedinFollowupContactIds = Object.keys(linkedinCounts).filter(id => linkedinCounts[id] > 1);
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && 
                linkedinFollowupContactIds.includes(a.contactId?.toString())
              );
              break;
            case 'cip':
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && a.status === 'CIP'
              );
              break;
            case 'meetingProposed':
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && a.status === 'Meeting Proposed'
              );
              break;
            case 'scheduled':
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && a.status === 'Meeting Scheduled'
              );
              break;
            case 'completed':
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && a.status === 'Meeting Completed'
              );
              break;
            case 'sql':
              filteredActivities = activities.filter(a => 
                a.type === 'linkedin' && 
                ['SQL', 'Meeting Completed'].includes(a.status)
              );
              break;
          }
        }

        // Fetch contact details for activities
        const contactIds = [...new Set(filteredActivities.map(a => a.contactId).filter(Boolean))];
        const contactsMap = new Map();
        
        if (contactIds.length > 0) {
          const contactsResponse = await Promise.all(
            contactIds.slice(0, 100).map(id => 
              API.get(`/contacts/${id}`).catch(() => null)
            )
          );
          
          contactsResponse.forEach((resp, idx) => {
            if (resp?.data?.success) {
              contactsMap.set(contactIds[idx], resp.data.data);
            }
          });
        }

        const enrichedActivities = filteredActivities.map(activity => ({
          ...activity,
          contact: contactsMap.get(activity.contactId?.toString()) || null
        }));

        setStageData(enrichedActivities);
      }
    } catch (error) {
      console.error('Error fetching stage data:', error);
      setStageData([]);
    } finally {
      setLoadingStageData(false);
    }
  };

  // Determine enabled activity types based on selected project channels
  const enabledActivityTypes = useMemo(() => {
    if (!selectedProject) {
      // If no project selected, show all tabs
      return ['call', 'email', 'linkedin'];
    }
    
    // Find the selected project from projects list
    const project = projects.find(p => p._id === selectedProject);
    if (!project?.channels) {
      // If project not found or no channels defined, default to all
      return ['call', 'email', 'linkedin'];
    }
    
    const enabled = [];
    if (project.channels.coldCalling) enabled.push('call');
    if (project.channels.coldEmail) enabled.push('email');
    if (project.channels.linkedInOutreach) enabled.push('linkedin');
    
    // If no channels are enabled, default to all (for backward compatibility)
    return enabled.length > 0 ? enabled : ['call', 'email', 'linkedin'];
  }, [selectedProject, projects]);

  // Filter tabs based on enabled channels
  const filteredTabs = useMemo(() => {
    const allTabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'pipeline', label: 'Pipeline' },
      { id: 'linkedin', label: 'LinkedIn' },
      { id: 'calls', label: 'Cold Calls' },
      { id: 'email', label: 'Email' },
      { id: 'team', label: 'Team Performance' }
    ];
    
    // Always show overview, pipeline, and team
    // Filter channel-specific tabs based on enabled channels
    return allTabs.filter(tab => {
      if (['overview', 'pipeline', 'team'].includes(tab.id)) {
        return true;
      }
      if (tab.id === 'linkedin') return enabledActivityTypes.includes('linkedin');
      if (tab.id === 'calls') return enabledActivityTypes.includes('call');
      if (tab.id === 'email') return enabledActivityTypes.includes('email');
      return true;
    });
  }, [enabledActivityTypes]);

  // Auto-select a valid tab if current selection is not enabled
  useEffect(() => {
    const validTabIds = filteredTabs.map(tab => tab.id);
    if (!validTabIds.includes(activeTab)) {
      // Select first available tab
      setActiveTab(validTabIds[0] || 'overview');
    }
  }, [filteredTabs, activeTab]);

  // Skeleton loader
  const SkeletonCard = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Having trouble loading the dashboard. Refresh the page.</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const MetricCard = ({ title, value, subtitle, icon, color = 'blue', compact = false }) => {
    const colorClasses = {
      blue: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-100', icon: 'text-indigo-600', badge: 'text-blue-700 bg-white/70 border-blue-100' },
      green: { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-100', icon: 'text-emerald-600', badge: 'text-emerald-700 bg-white/70 border-emerald-100' },
      purple: { bg: 'from-purple-50 to-indigo-50', border: 'border-purple-100', icon: 'text-purple-600', badge: 'text-purple-700 bg-white/70 border-purple-100' },
      orange: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-100', icon: 'text-amber-600', badge: 'text-amber-700 bg-white/70 border-amber-100' }
    };
    const colors = colorClasses[color] || colorClasses.blue;

    if (compact) {
      return (
        <div className={`bg-gradient-to-br ${colors.bg} rounded-lg border ${colors.border} shadow-sm p-4 hover:shadow-md transition-shadow h-full`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`w-8 h-8 rounded-lg bg-white/80 border ${colors.border} flex items-center justify-center shadow-xs`}>
              {typeof icon === 'object' && icon.props ? React.cloneElement(icon, { className: 'w-4 h-4' }) : icon}
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 leading-tight mb-1">{value}</div>
          <div className="text-xs font-medium text-gray-700">{title}</div>
          {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
        </div>
      );
    }

    return (
      <div className={`bg-gradient-to-br ${colors.bg} rounded-xl border ${colors.border} shadow-sm p-6 hover:shadow-md transition-shadow`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`w-12 h-12 rounded-lg bg-white/80 border ${colors.border} flex items-center justify-center shadow-xs`}>
            {icon}
          </div>
        </div>
        <div className="text-3xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-sm text-gray-600 mt-1">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      </div>
    );
  };

  const FunnelVisualization = ({ title, data, color = 'blue', funnelType = 'call', totalProspects = null }) => {
    // Determine which stages to show based on funnel type
    let stages = [];
    
    // Ensure prospectData exists in data, use totalProspects as fallback
    if (data.prospectData === undefined && totalProspects !== null) {
      data = { ...data, prospectData: totalProspects };
    }
    
    // Updated 10-stage Cold Calling Funnel
    if (data.callsAttempted !== undefined || data.callSent !== undefined) {
      // Support both new and old data structure for backward compatibility
      stages = [
        { key: 'prospectData', label: 'Prospect Data', clickable: true },
        { key: 'callsAttempted', label: 'Calls Attempted', clickable: true },
        { key: 'callsConnected', label: 'Calls Connected', clickable: true },
        { key: 'decisionMakerReached', label: 'Decision Maker Reached', clickable: true },
        { key: 'interested', label: 'Interested', clickable: true },
        { key: 'detailsShared', label: 'Details Shared', clickable: true },
        { key: 'demoBooked', label: 'Demo Booked', clickable: true },
        { key: 'demoCompleted', label: 'Demo Completed', clickable: true },
        { key: 'sql', label: 'SQL', clickable: true }
      ];
      // Fallback to old structure if new keys don't exist
      if (data.callSent !== undefined && data.callsAttempted === undefined) {
        stages = [
          { key: 'prospectData', label: 'Prospect Data', clickable: true },
          { key: 'callSent', label: 'Call Sent', clickable: true },
          { key: 'accepted', label: 'Accepted', clickable: true },
          { key: 'followups', label: 'Followups', clickable: true },
          { key: 'cip', label: 'CIP', clickable: true },
          { key: 'meetingProposed', label: 'Meeting Proposed', clickable: true },
          { key: 'scheduled', label: 'Scheduled', clickable: true },
          { key: 'completed', label: 'Completed', clickable: true },
          { key: 'sql', label: 'SQL', clickable: true }
        ];
      }
    } else if (data.emailSent !== undefined) {
      stages = [
        { key: 'prospectData', label: 'Prospect Data', clickable: true },
        { key: 'emailSent', label: 'Email Sent', clickable: true },
        { key: 'accepted', label: 'Accepted', clickable: true },
        { key: 'followups', label: 'Followups', clickable: true },
        { key: 'cip', label: 'CIP', clickable: true },
        { key: 'meetingProposed', label: 'Meeting Proposed', clickable: true },
        { key: 'scheduled', label: 'Scheduled', clickable: true },
        { key: 'completed', label: 'Completed', clickable: true },
        { key: 'sql', label: 'SQL', clickable: true }
      ];
    } else if (data.connectionSent !== undefined) {
      stages = [
        { key: 'prospectData', label: 'Prospect Data', clickable: true },
        { key: 'connectionSent', label: 'Connection Sent', clickable: true },
        { key: 'accepted', label: 'Accepted', clickable: true },
        { key: 'followups', label: 'Followups', clickable: true },
        { key: 'cip', label: 'CIP', clickable: true },
        { key: 'meetingProposed', label: 'Meeting Proposed', clickable: true },
        { key: 'scheduled', label: 'Scheduled', clickable: true },
        { key: 'completed', label: 'Completed', clickable: true },
        { key: 'sql', label: 'SQL', clickable: true }
      ];
    }
    
    // Always include all stages that are defined - don't filter based on data presence
    // This ensures the funnel always shows the complete structure
    stages = stages.filter(s => s.key); // Only filter out stages without a key

    // Ensure prospectData is always in the data for maxValue calculation
    const maxValue = data.prospectData || (data.prospectData === 0 ? 0 : 1);
    const colorMap = {
      blue: { 
        primary: 'rgb(59, 130, 246)', 
        light: 'rgba(59, 130, 246, 0.1)', 
        border: 'rgba(59, 130, 246, 0.3)',
        hover: 'rgba(59, 130, 246, 0.2)'
      },
      green: { 
        primary: 'rgb(34, 197, 94)', 
        light: 'rgba(34, 197, 94, 0.1)', 
        border: 'rgba(34, 197, 94, 0.3)',
        hover: 'rgba(34, 197, 94, 0.2)'
      },
      purple: { 
        primary: 'rgb(168, 85, 247)', 
        light: 'rgba(168, 85, 247, 0.1)', 
        border: 'rgba(168, 85, 247, 0.3)',
        hover: 'rgba(168, 85, 247, 0.2)'
      }
    };
    const colors = colorMap[color] || colorMap.blue;

    // Calculate funnel widths - more dramatic funnel shape
    const calculateWidth = (index, total) => {
      if (index === 0) return 100; // Top is 100%
      const reductionPerStep = 10; // Reduce by 10% each step for more dramatic funnel
      const width = Math.max(15, 100 - (index * reductionPerStep)); // Minimum 15% width
      return width;
    };

    const handleStageClick = (stage) => {
      // Always allow clicking on Prospect Data
      if (stage.key === 'prospectData') {
        fetchStageData(stage.key, funnelType, data);
        return;
      }
      
      // For other stages, check if they have data
      if (stage.clickable && (data[stage.key] || 0) > 0) {
        fetchStageData(stage.key, funnelType, data);
      } else if (stage.clickable) {
        setNotification({ type: 'info', message: `No records found for ${stage.label} stage` });
        setTimeout(() => setNotification(null), 3000);
      }
    };

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow h-full">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 text-center">{title}</h3>
        <div className="flex flex-col items-center space-y-0">
          {stages.map((stage, index) => {
            // For prospectData, use the value from data or fallback to maxValue
            const value = stage.key === 'prospectData' 
              ? (data[stage.key] !== undefined ? data[stage.key] : maxValue)
              : (data[stage.key] || 0);
            const percentage = maxValue > 0 ? ((value / maxValue) * 100).toFixed(1) : 0;
            const funnelWidth = calculateWidth(index, stages.length);
            const actualWidth = maxValue > 0 ? (value / maxValue) * funnelWidth : 0;
            const isClickable = stage.clickable;
            const hasData = value > 0;
            
            return (
              <div key={stage.key} className="relative w-full flex flex-col items-center">
                {/* Funnel segment */}
                <div 
                  onClick={() => handleStageClick(stage)}
                  className={`relative transition-all duration-300 ${
                    isClickable ? 'cursor-pointer hover:scale-[1.03] group' : 'cursor-default'
                  }`}
                  style={{
                    width: `${funnelWidth}%`,
                    minHeight: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={isClickable ? (value > 0 ? `Click to view ${value} ${stage.label.toLowerCase()} records` : `Click to view ${stage.label.toLowerCase()}`) : ''}
                >
                  {/* Background funnel shape - more dramatic */}
                  <div
                    className={`absolute inset-0 transition-all duration-300 ${
                      isClickable ? 'group-hover:brightness-110 group-hover:shadow-md' : ''
                    }`}
                    style={{
                      clipPath: index === 0 
                        ? 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)' // Top: slight taper
                        : index === stages.length - 1
                        ? 'polygon(15% 0, 85% 0, 100% 100%, 0 100%)' // Bottom: narrow
                        : 'polygon(8% 0, 92% 0, 96% 100%, 4% 100%)', // Middle: funnel shape
                      backgroundColor: colors.light,
                      border: `2px solid ${colors.border}`,
                      borderBottom: index < stages.length - 1 ? 'none' : `2px solid ${colors.border}`
                    }}
                  />
                  
                  {/* Filled portion */}
                  {actualWidth > 0 && (
                    <div
                      className="absolute bottom-0 left-1/2 transform -translate-x-1/2 transition-all duration-500"
                      style={{
                        width: `${Math.max(20, (actualWidth / funnelWidth) * 100)}%`,
                        height: '100%',
                        backgroundColor: colors.primary,
                        clipPath: index === 0 
                          ? 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)'
                          : index === stages.length - 1
                          ? 'polygon(15% 0, 85% 0, 100% 100%, 0 100%)'
                          : 'polygon(8% 0, 92% 0, 96% 100%, 4% 100%)',
                        opacity: 0.85
                      }}
                    />
                  )}
                  
                  {/* Content */}
                  <div className="relative z-10 w-full px-2 py-1 text-center">
                    <div className={`text-xs font-bold mb-0.5 ${isClickable ? 'text-gray-800' : 'text-gray-600'}`}>
                      {stage.label}
                      {isClickable && (
                        <svg className="w-2.5 h-2.5 inline-block ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs font-bold text-gray-900">{value.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">({percentage}%)</span>
                    </div>
                  </div>
                </div>
                
                {/* Connector line */}
                {index < stages.length - 1 && (
                  <div 
                    className="w-0.5"
                    style={{
                      height: '4px',
                      backgroundColor: colors.primary,
                      opacity: 0.3
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="text-center">
              <div className="text-gray-600 mb-1 text-xs font-medium">Conversion</div>
              <div className="text-sm font-bold text-gray-900">
                {maxValue > 0 ? ((data.sql / maxValue) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600 mb-1 text-xs font-medium">Meetings</div>
              <div className="text-sm font-bold text-gray-900">
                {maxValue > 0 ? ((data.scheduled / maxValue) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  // If a project is selected, go back to that project's Prospect Management page
                  // Otherwise, go back to Projects list
                  if (selectedProject || analytics?.project?.id) {
                    const projectId = selectedProject || analytics.project.id;
                    navigate(`/projects/${projectId}`);
                  } else {
                    navigate('/projects');
                  }
                }}
                className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                title={selectedProject || analytics?.project?.id ? "Back to Prospect Management" : "Back to Projects"}
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Prospect Analytics Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {analytics.project 
                    ? `Analytics for ${analytics.project.companyName}`
                    : 'Comprehensive insights across all projects'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.companyName}
                  </option>
                ))}
              </select>
              {analytics.project && (
                <button
                  onClick={() => navigate(`/projects/${analytics.project.id}`)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  View Project
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-6 overflow-x-auto pb-2 border-b border-gray-200">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div 
          className="fixed top-20 right-4 z-50"
          style={{
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div className={`px-4 py-3 rounded-lg shadow-xl border-2 ${
            notification.type === 'info' 
              ? 'bg-blue-50 border-blue-200 text-blue-800' 
              : notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'info' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-sm font-medium">{notification.message}</span>
              <button
                onClick={() => setNotification(null)}
                className="ml-2 text-current opacity-70 hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-0">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <MetricCard
                title="Total Prospects"
                value={analytics.overview.totalProspects.toLocaleString()}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
                color="blue"
                compact={true}
              />
              <MetricCard
                title="Total Activities"
                value={analytics.overview.totalActivities.toLocaleString()}
                subtitle="Calls, emails & LinkedIn"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                color="green"
                compact={true}
              />
              <MetricCard
                title="Win Rate"
                value={`${analytics.pipeline.conversion.winRate}%`}
                subtitle={`${analytics.pipeline.conversion.won} won`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="purple"
                compact={true}
              />
              <MetricCard
                title="Meeting Rate"
                value={`${analytics.pipeline.conversion.meetingRate}%`}
                subtitle={`${analytics.pipeline.conversion.meetings} meetings`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                color="orange"
                compact={true}
              />
              <MetricCard
                title="SQL Rate"
                value={analytics.overview.totalProspects > 0 
                  ? `${((analytics.pipeline.conversion.sql / analytics.overview.totalProspects) * 100).toFixed(1)}%`
                  : '0%'}
                subtitle={`${analytics.pipeline.conversion.sql} SQL leads`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                color="blue"
                compact={true}
              />
              <MetricCard
                title="CIP Rate"
                value={analytics.overview.totalProspects > 0 
                  ? `${((analytics.pipeline.conversion.cip / analytics.overview.totalProspects) * 100).toFixed(1)}%`
                  : '0%'}
                subtitle={`${analytics.pipeline.conversion.cip} CIP prospects`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
                color="green"
                compact={true}
              />
              <MetricCard
                title="Avg Activities/Prospect"
                value={analytics.overview.totalProspects > 0 
                  ? (analytics.overview.totalActivities / analytics.overview.totalProspects).toFixed(1)
                  : '0'}
                subtitle="Average engagement"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                color="purple"
                compact={true}
              />
              <MetricCard
                title="Lost Deals"
                value={analytics.pipeline.conversion.lost || 0}
                subtitle="Deals lost"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                }
                color="orange"
                compact={true}
              />
            </div>

            {/* Funnel Section with Dynamic Layout */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Funnel Analytics</h3>
              <div className={`${
                enabledActivityTypes.length === 1 
                  ? 'flex justify-center' 
                  : enabledActivityTypes.length === 2
                  ? 'flex justify-center gap-6'
                  : 'overflow-x-auto'
              }`}>
                <div className={`${
                  enabledActivityTypes.length === 1
                    ? 'w-80'
                    : enabledActivityTypes.length === 2
                    ? 'flex gap-6'
                    : 'flex gap-6 min-w-max pb-2'
                }`}>
                  {/* Cold Calling Funnel - Only show if coldCalling channel is enabled */}
                  {enabledActivityTypes.includes('call') && (
                    <div className={`${
                      enabledActivityTypes.length === 1 || enabledActivityTypes.length === 2
                        ? 'w-80'
                        : 'flex-shrink-0 w-80'
                    }`}>
                      <FunnelVisualization
                        title="Cold Calling Funnel"
                        data={analytics.funnels.coldCalling}
                        color="green"
                        funnelType="call"
                        totalProspects={analytics.overview?.totalProspects}
                      />
                    </div>
                  )}
                  {/* Email Funnel - Only show if coldEmail channel is enabled */}
                  {enabledActivityTypes.includes('email') && (
                    <div className={`${
                      enabledActivityTypes.length === 1 || enabledActivityTypes.length === 2
                        ? 'w-80'
                        : 'flex-shrink-0 w-80'
                    }`}>
                      <FunnelVisualization
                        title="Email Funnel"
                        data={analytics.funnels.email}
                        color="blue"
                        funnelType="email"
                        totalProspects={analytics.overview?.totalProspects}
                      />
                    </div>
                  )}
                  {/* LinkedIn Funnel - Only show if linkedInOutreach channel is enabled */}
                  {enabledActivityTypes.includes('linkedin') && (
                    <div className={`${
                      enabledActivityTypes.length === 1 || enabledActivityTypes.length === 2
                        ? 'w-80'
                        : 'flex-shrink-0 w-80'
                    }`}>
                      <FunnelVisualization
                        title="LinkedIn Funnel"
                        data={analytics.funnels.linkedin}
                        color="purple"
                        funnelType="linkedin"
                        totalProspects={analytics.overview?.totalProspects}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activity Trends */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Trends (Last 7 Days)</h3>
                {analytics.activities.trends.labels.length > 0 ? (
                  <div className="h-64">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                      <Line
                        data={{
                          labels: analytics.activities.trends.labels,
                          datasets: [
                            // Only include Calls dataset if coldCalling channel is enabled
                            ...(enabledActivityTypes.includes('call') ? [{
                              label: 'Calls',
                              data: analytics.activities.trends.call,
                              borderColor: 'rgb(34, 197, 94)',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              tension: 0.4,
                            }] : []),
                            // Only include Emails dataset if coldEmail channel is enabled
                            ...(enabledActivityTypes.includes('email') ? [{
                              label: 'Emails',
                              data: analytics.activities.trends.email,
                              borderColor: 'rgb(59, 130, 246)',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              tension: 0.4,
                            }] : []),
                            // Only include LinkedIn dataset if linkedInOutreach channel is enabled
                            ...(enabledActivityTypes.includes('linkedin') ? [{
                              label: 'LinkedIn',
                              data: analytics.activities.trends.linkedin,
                              borderColor: 'rgb(168, 85, 247)',
                              backgroundColor: 'rgba(168, 85, 247, 0.1)',
                              tension: 0.4,
                            }] : []),
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'top' },
                          },
                          scales: {
                            y: { beginAtZero: true },
                          },
                        }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <p className="text-sm">No activity data available</p>
                  </div>
                )}
              </div>

              {/* Activity Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Distribution</h3>
                {analytics.activities.byType.length > 0 ? (
                  <div className="h-64">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                      <Doughnut
                        data={{
                          labels: analytics.activities.byType
                            .filter(a => {
                              const type = a.type.toLowerCase();
                              return (type === 'call' && enabledActivityTypes.includes('call')) ||
                                     (type === 'email' && enabledActivityTypes.includes('email')) ||
                                     (type === 'linkedin' && enabledActivityTypes.includes('linkedin'));
                            })
                            .map(a => a.type.charAt(0).toUpperCase() + a.type.slice(1)),
                          datasets: [{
                            data: analytics.activities.byType
                              .filter(a => {
                                const type = a.type.toLowerCase();
                                return (type === 'call' && enabledActivityTypes.includes('call')) ||
                                       (type === 'email' && enabledActivityTypes.includes('email')) ||
                                       (type === 'linkedin' && enabledActivityTypes.includes('linkedin'));
                              })
                              .map(a => a.count),
                            backgroundColor: [
                              ...(enabledActivityTypes.includes('call') ? ['rgb(34, 197, 94)'] : []),
                              ...(enabledActivityTypes.includes('email') ? ['rgb(59, 130, 246)'] : []),
                              ...(enabledActivityTypes.includes('linkedin') ? ['rgb(168, 85, 247)'] : []),
                            ],
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'bottom' },
                          },
                        }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <p className="text-sm">No activity data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stage Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Prospect Stage Distribution</h3>
              {analytics.prospects.stageDistribution.length > 0 ? (
                <div className="h-80">
                  <Suspense fallback={<div className="h-80 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                    <Bar
                      data={{
                        labels: analytics.prospects.stageDistribution.map(s => s.stage),
                        datasets: [{
                          label: 'Prospects',
                          data: analytics.prospects.stageDistribution.map(s => s.count),
                          backgroundColor: 'rgb(59, 130, 246)',
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          x: { beginAtZero: true },
                        },
                      }}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  <p className="text-sm">No stage data available</p>
                </div>
              )}
            </div>

            {/* Top Performers */}
            {analytics.topPerformers && analytics.topPerformers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Prospects</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prospect</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {analytics.topPerformers.map((prospect) => (
                        <tr key={prospect.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{prospect.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{prospect.company}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{prospect.activityCount}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {prospect.lastActivity ? new Date(prospect.lastActivity).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'funnels' && (
          <div className="space-y-3">
            <div className={`${
              enabledActivityTypes.length === 1
                ? 'flex justify-center'
                : enabledActivityTypes.length === 2
                ? 'grid grid-cols-1 lg:grid-cols-2 gap-3 justify-center'
                : 'grid grid-cols-1 lg:grid-cols-3 gap-3'
            }`}>
              {/* Cold Calling Funnel - Only show if coldCalling channel is enabled */}
              {enabledActivityTypes.includes('call') && (
                <FunnelVisualization
                  title="Cold Calling Funnel"
                  data={analytics.funnels.coldCalling}
                  color="green"
                  funnelType="call"
                  totalProspects={analytics.overview?.totalProspects}
                />
              )}
              {/* Email Funnel - Only show if coldEmail channel is enabled */}
              {enabledActivityTypes.includes('email') && (
                <FunnelVisualization
                  title="Email Funnel"
                  data={analytics.funnels.email}
                  color="blue"
                  funnelType="email"
                  totalProspects={analytics.overview?.totalProspects}
                />
              )}
              {/* LinkedIn Funnel - Only show if linkedInOutreach channel is enabled */}
              {enabledActivityTypes.includes('linkedin') && (
                <FunnelVisualization
                  title="LinkedIn Funnel"
                  data={analytics.funnels.linkedin}
                  color="purple"
                  funnelType="linkedin"
                  totalProspects={analytics.overview?.totalProspects}
                />
              )}
            </div>
            {selectedStage && (
              <div className="text-xs text-gray-500 text-center mt-2">
                Click on any stage above to view detailed records
              </div>
            )}
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Pipeline Analysis Header */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Pipeline Analysis</h2>
              <p className="text-sm text-gray-600">Monitor your sales pipeline and conversion metrics</p>
            </div>

            {/* Conversion Metrics */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Conversion Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Win Rate Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm">
                  <div className="text-4xl font-bold text-blue-600 mb-2">{analytics.pipeline.conversion.winRate}%</div>
                  <div className="text-base font-semibold text-gray-700 mb-1">Win Rate</div>
                  <div className="text-sm text-gray-600">
                    {analytics.pipeline.conversion.won} won / {analytics.pipeline.conversion.total} total
                  </div>
                </div>
                {/* Meeting Rate Card */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 shadow-sm">
                  <div className="text-4xl font-bold text-green-600 mb-2">{analytics.pipeline.conversion.meetingRate}%</div>
                  <div className="text-base font-semibold text-gray-700 mb-1">Meeting Rate</div>
                  <div className="text-sm text-gray-600">
                    {analytics.pipeline.conversion.meetings} meetings scheduled
                  </div>
                </div>
                {/* SQL Count Card */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-6 shadow-sm">
                  <div className="text-4xl font-bold text-orange-600 mb-2">{analytics.pipeline.conversion.sql}</div>
                  <div className="text-base font-semibold text-gray-700 mb-1">SQL Count</div>
                  <div className="text-sm text-gray-600">Sales Qualified Leads</div>
                </div>
              </div>
            </div>

            {/* Pipeline Stage Distribution Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Pipeline Stage Distribution</h3>
              {analytics.prospects.byStage && analytics.prospects.byStage.length > 0 ? (
                <div className="h-96">
                  <Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                    <Bar
                      data={{
                        labels: analytics.prospects.byStage.map(s => s.stage || s._id),
                        datasets: [{
                          label: 'Prospects',
                          data: analytics.prospects.byStage.map(s => s.count),
                          backgroundColor: 'rgb(59, 130, 246)',
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          x: { 
                            beginAtZero: true,
                            ticks: {
                              stepSize: 50
                            }
                          },
                          y: {
                            ticks: {
                              font: {
                                size: 12
                              }
                            }
                          }
                        },
                      }}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <p className="text-sm">No pipeline data available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {enabledActivityTypes.includes('linkedin') && activeTab === 'linkedin' && (() => {
          const linkedinData = analytics.funnels.linkedin || {};
          const connectionSent = linkedinData.connectionSent || 0;
          const accepted = linkedinData.accepted || 0;
          const followups = linkedinData.followups || 0;
          const scheduled = linkedinData.scheduled || 0;
          const completed = linkedinData.completed || 0;
          const acceptanceRate = connectionSent > 0 ? ((accepted / connectionSent) * 100) : 0;
          const replyRate = followups > 0 ? ((followups / connectionSent) * 100) : 0;
          
          return (
            <div className="space-y-6">
              {/* LinkedIn KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Connection Requests Sent */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full shadow-xs">
                      LinkedIn
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{connectionSent.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Connection Requests Sent</div>
                </div>

                {/* Acceptance Rate */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full shadow-xs">
                      Rate
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{acceptanceRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 mt-1">{accepted.toLocaleString()} accepted</div>
                </div>

                {/* Messages Sent */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full shadow-xs">
                      Messages
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{followups.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Messages Sent</div>
                </div>

                {/* Reply Rate */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-cyan-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-cyan-700 bg-white/70 border border-cyan-100 px-2 py-1 rounded-full shadow-xs">
                      Rate
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{replyRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 mt-1">{followups.toLocaleString()} replies</div>
                </div>

                {/* Meetings Booked */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-amber-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 bg-white/70 border border-amber-100 px-2 py-1 rounded-full shadow-xs">
                      Meetings
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{(scheduled + completed).toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Meetings Booked</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LinkedIn Funnel Overview */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">LinkedIn Funnel Overview</h3>
                  <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                    <div className="h-64">
                      <Bar
                        data={{
                          labels: ['Requests Sent', 'Accepted', 'Messages Sent', 'Replies', 'Meetings'],
                          datasets: [{
                            label: 'LinkedIn Funnel',
                            data: [
                              connectionSent,
                              accepted,
                              followups,
                              followups,
                              (scheduled + completed)
                            ],
                            backgroundColor: '#3B82F6',
                            borderColor: '#2563EB',
                            borderWidth: 1
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  return `${context.label}: ${context.parsed.y.toLocaleString()}`;
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 12
                              }
                            },
                            x: {
                              ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                font: {
                                  size: 10
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </Suspense>
                </div>

                {/* Connection Acceptance Rate */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Connection Acceptance Rate</h3>
                  <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                    <div className="h-64 flex items-center justify-center">
                      <Doughnut
                        data={{
                          labels: ['Accepted', 'Not Accepted'],
                          datasets: [{
                            label: 'Connection Requests',
                            data: [
                              accepted,
                              Math.max(0, connectionSent - accepted)
                            ],
                            backgroundColor: ['#10B981', '#EF4444'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: '60%',
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                padding: 15,
                                font: {
                                  size: 12,
                                  weight: '500'
                                },
                                usePointStyle: true,
                                pointStyle: 'circle'
                              }
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.parsed || 0;
                                  const percentage = connectionSent > 0 ? ((value / connectionSent) * 100) : 0;
                                  return `${label}: ${value.toLocaleString()} (${percentage.toFixed(1)}%)`;
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </Suspense>
                </div>
              </div>
            </div>
          );
        })()}

        {enabledActivityTypes.includes('call') && activeTab === 'calls' && (() => {
          const callData = analytics.funnels.coldCalling || {};
          const callsMade = callData.callsAttempted || 0;
          const callsConnected = callData.callsConnected || 0;
          const decisionMaker = callData.decisionMakerReached || 0;
          const interested = callData.interested || 0;
          const meetings = (callData.demoBooked || 0) + (callData.demoCompleted || 0);
          const connectRate = callsMade > 0 ? ((callsConnected / callsMade) * 100) : 0;
          
          return (
            <div className="space-y-6">
              {/* Call KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Calls Made */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full shadow-xs">
                      Calls
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{callsMade.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Calls Made</div>
                </div>

                {/* Connect Rate */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full shadow-xs">
                      Rate
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{connectRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 mt-1">{callsConnected.toLocaleString()} connected</div>
                </div>

                {/* Decision Maker Connects */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full shadow-xs">
                      Decision
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{decisionMaker.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Decision Maker Connects</div>
                </div>

                {/* Interested */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-cyan-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-cyan-700 bg-white/70 border border-cyan-100 px-2 py-1 rounded-full shadow-xs">
                      Interested
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{interested.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Interested</div>
                </div>

                {/* Meetings Booked */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-amber-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 bg-white/70 border border-amber-100 px-2 py-1 rounded-full shadow-xs">
                      Meetings
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{meetings.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Meetings Booked</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cold Call Funnel Overview */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Cold Call Funnel Overview</h3>
                  <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                    <div className="h-64">
                      <Bar
                        data={{
                          labels: ['Calls Made', 'Connected', 'Decision Maker', 'Interested', 'Meetings'],
                          datasets: [{
                            label: 'Cold Call Funnel',
                            data: [
                              callsMade,
                              callsConnected,
                              decisionMaker,
                              interested,
                              meetings
                            ],
                            backgroundColor: '#3B82F6',
                            borderColor: '#2563EB',
                            borderWidth: 1
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  return `${context.label}: ${context.parsed.y.toLocaleString()}`;
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 25
                              }
                            },
                            x: {
                              ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                font: {
                                  size: 10
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </Suspense>
                </div>

                {/* Call Connection Rate */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Call Connection Rate</h3>
                  <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                    <div className="h-64 flex items-center justify-center">
                      <Doughnut
                        data={{
                          labels: ['Connected', 'Not Connected'],
                          datasets: [{
                            label: 'Call Connections',
                            data: [
                              callsConnected,
                              Math.max(0, callsMade - callsConnected)
                            ],
                            backgroundColor: ['#10B981', '#EF4444'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: '60%',
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                padding: 15,
                                font: {
                                  size: 12,
                                  weight: '500'
                                },
                                usePointStyle: true,
                                pointStyle: 'circle'
                              }
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.parsed || 0;
                                  const percentage = callsMade > 0 ? ((value / callsMade) * 100) : 0;
                                  return `${label}: ${value.toLocaleString()} (${percentage.toFixed(1)}%)`;
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </Suspense>
                </div>
              </div>
            </div>
          );
        })()}

        {enabledActivityTypes.includes('email') && activeTab === 'email' && (() => {
          const emailData = analytics.funnels.email || {};
          const emailsSent = emailData.emailSent || 0;
          const accepted = emailData.accepted || 0;
          const scheduled = emailData.scheduled || 0;
          const completed = emailData.completed || 0;
          const sql = emailData.sql || 0;
          const openRate = emailsSent > 0 ? ((accepted / emailsSent) * 100) : 0;
          const replyRate = emailsSent > 0 ? ((sql / emailsSent) * 100) : 0;
          const meetings = scheduled + completed;
          
          return (
            <div className="space-y-6">
              {/* Email KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Emails Sent */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full shadow-xs">
                      Email
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{emailsSent.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Emails Sent</div>
                </div>

                {/* Open Rate */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full shadow-xs">
                      Rate
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{openRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 mt-1">{accepted.toLocaleString()} opened</div>
                </div>

                {/* Reply Rate */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full shadow-xs">
                      Rate
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{replyRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 mt-1">{sql.toLocaleString()} replies</div>
                </div>

                {/* Meetings Booked */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-amber-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 bg-white/70 border border-amber-100 px-2 py-1 rounded-full shadow-xs">
                      Meetings
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">{meetings.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-1">Meetings Booked</div>
                </div>

                {/* Bounce Rate */}
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-white/80 border border-red-100 flex items-center justify-center shadow-xs">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-red-700 bg-white/70 border border-red-100 px-2 py-1 rounded-full shadow-xs">
                      Bounce
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 leading-tight">0.0%</div>
                  <div className="text-sm text-gray-600 mt-1">Bounce Rate</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Email Funnel Overview */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Email Funnel Overview</h3>
                  <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                    <div className="h-64">
                      <Bar
                        data={{
                          labels: ['Emails Sent', 'Opened', 'Replied', 'Meetings'],
                          datasets: [{
                            label: 'Email Funnel',
                            data: [
                              emailsSent,
                              accepted,
                              sql,
                              meetings
                            ],
                            backgroundColor: '#3B82F6',
                            borderColor: '#2563EB',
                            borderWidth: 1
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  return `${context.label}: ${context.parsed.y.toLocaleString()}`;
                                }
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 10
                              }
                            },
                            x: {
                              ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                font: {
                                  size: 10
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </Suspense>
                </div>

                {/* Email Status Rate */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Email Status Distribution</h3>
                  <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                    <div className="h-64 flex items-center justify-center">
                      <Doughnut
                        data={{
                          labels: ['Replied', 'Opened', 'No Reply'],
                          datasets: [{
                            label: 'Email Status',
                            data: [
                              sql,
                              Math.max(0, accepted - sql),
                              Math.max(0, emailsSent - accepted)
                            ],
                            backgroundColor: ['#10B981', '#3B82F6', '#9CA3AF'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: '60%',
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: {
                                padding: 15,
                                font: {
                                  size: 12,
                                  weight: '500'
                                },
                                usePointStyle: true,
                                pointStyle: 'circle'
                              }
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.parsed || 0;
                                  const percentage = emailsSent > 0 ? ((value / emailsSent) * 100) : 0;
                                  return `${label}: ${value.toLocaleString()} (${percentage.toFixed(1)}%)`;
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </Suspense>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* Team Performance Funnels */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
              {loadingTeamFunnels ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : teamMemberFunnels.length > 0 ? (
                <div className={`${
                  teamMemberFunnels.length === 1
                    ? 'flex justify-center'
                    : teamMemberFunnels.length === 2
                    ? 'grid grid-cols-1 lg:grid-cols-2 gap-6'
                    : 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
                }`}>
                  {teamMemberFunnels.map((memberFunnel) => {
                    const member = analytics?.team?.performance?.find(m => m.id === memberFunnel.memberId);
                    return (
                      <div key={memberFunnel.memberId} className="space-y-4">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                          <h4 className="text-base font-semibold text-gray-900 mb-1">{memberFunnel.name}</h4>
                          <p className="text-xs text-gray-600">{memberFunnel.email}</p>
                          {member && (
                            <div className="mt-2 flex gap-4 text-xs text-gray-600">
                              <span>Total: <span className="font-semibold text-gray-900">{member.totalActivities}</span></span>
                              {enabledActivityTypes.includes('call') && (
                                <span>Calls: <span className="font-semibold text-gray-900">{member.calls}</span></span>
                              )}
                              {enabledActivityTypes.includes('email') && (
                                <span>Emails: <span className="font-semibold text-gray-900">{member.emails}</span></span>
                              )}
                              {enabledActivityTypes.includes('linkedin') && (
                                <span>LinkedIn: <span className="font-semibold text-gray-900">{member.linkedin}</span></span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          {/* Cold Calling Funnel - Only show if coldCalling channel is enabled */}
                          {enabledActivityTypes.includes('call') && memberFunnel.funnels.coldCalling && (
                            <FunnelVisualization
                              title={`${memberFunnel.name} - Cold Calling`}
                              data={memberFunnel.funnels.coldCalling}
                              color="green"
                              funnelType="call"
                              totalProspects={analytics.overview?.totalProspects}
                            />
                          )}
                          
                          {/* LinkedIn Funnel - Only show if linkedInOutreach channel is enabled */}
                          {enabledActivityTypes.includes('linkedin') && memberFunnel.funnels.linkedin && (
                            <FunnelVisualization
                              title={`${memberFunnel.name} - LinkedIn`}
                              data={memberFunnel.funnels.linkedin}
                              color="purple"
                              funnelType="linkedin"
                              totalProspects={analytics.overview?.totalProspects}
                            />
                          )}
                          
                          {/* Email Funnel - Only show if coldEmail channel is enabled */}
                          {enabledActivityTypes.includes('email') && memberFunnel.funnels.email && (
                            <FunnelVisualization
                              title={`${memberFunnel.name} - Email`}
                              data={memberFunnel.funnels.email}
                              color="blue"
                              funnelType="email"
                              totalProspects={analytics.overview?.totalProspects}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm">No team performance data available</p>
                </div>
              )}
            </div>

            {/* Time Filter Buttons */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Time Period:</span>
                <button
                  onClick={() => setTeamTimeFilter('today')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    teamTimeFilter === 'today'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setTeamTimeFilter('last7days')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    teamTimeFilter === 'last7days'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setTeamTimeFilter('lastMonth')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    teamTimeFilter === 'lastMonth'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Last Month
                </button>
              </div>
            </div>

            {/* Activity Graph */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Trends</h3>
              {loadingTeamActivity ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : teamActivityData?.chartData ? (
                <div className="h-96">
                  <Suspense fallback={<div className="h-full flex items-center justify-center">Loading chart...</div>}>
                    <Bar
                      data={teamActivityData.chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                          },
                          title: {
                            display: true,
                            text: 'Activities by Type and Status'
                          }
                        },
                        scales: {
                          x: {
                            stacked: true,
                          },
                          y: {
                            stacked: true,
                            beginAtZero: true
                          }
                        }
                      }}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <p className="text-sm">No activity data available</p>
                </div>
              )}
            </div>

            {/* Pie Chart for Status Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Distribution by Channel</h3>
              {loadingTeamActivity ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : teamActivityData?.pieData ? (
                <div className="h-96">
                  <Suspense fallback={<div className="h-full flex items-center justify-center">Loading chart...</div>}>
                    <Pie
                      data={teamActivityData.pieData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'right',
                          },
                          title: {
                            display: true,
                            text: 'Activities by Channel'
                          }
                        }
                      }}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <p className="text-sm">No activity data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stage Data Modal - Outside main content container */}
      {selectedStage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4"
          onClick={() => {
            setSelectedStage(null);
            setStageData([]);
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col relative z-[101]"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', zIndex: 101 }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedStage.stage === 'prospectData' 
                    ? 'All Prospects' 
                    : selectedStage.stage.charAt(0).toUpperCase() + selectedStage.stage.slice(1) + ' - ' + (selectedStage.funnelType === 'call' ? 'Cold Calling' : selectedStage.funnelType === 'email' ? 'Email' : 'LinkedIn') + ' Funnel'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {stageData.length} {selectedStage.stage === 'prospectData' ? 'prospect' : 'record'}{stageData.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedStage(null);
                  setStageData([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingStageData ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div>
                </div>
              ) : stageData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          {selectedStage.stage === 'prospectData' ? 'Prospect' : 'Contact'}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Company</th>
                        {selectedStage.stage === 'prospectData' ? (
                          <>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Phone</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Stage</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Priority</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {stageData.map((item, idx) => {
                        // If it's prospect data, display prospect information
                        if (item.isProspect || selectedStage.stage === 'prospectData') {
                          return (
                            <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                {item.name || 'Unknown'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                                {item.company || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {item.email || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {item.firstPhone || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {(item.displayStatus || item.stage) && (
                                  <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                                    {item.displayStatus || item.stage}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {item.priority && (
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                                    item.priority === 'High' ? 'bg-red-100 text-red-800 border-red-200' :
                                    item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                    'bg-gray-100 text-gray-800 border-gray-200'
                                  }`}>
                                    {item.priority}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                        
                        // Otherwise, display activity information
                        return (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {item.contact?.name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                              {item.contact?.company || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.callDate || item.emailDate || item.linkedinDate
                                ? new Date(item.callDate || item.emailDate || item.linkedinDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })
                                : item.createdAt
                                ? new Date(item.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })
                                : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {item.status && (
                                <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                                  {item.status}
                                </span>
                              )}
                              {item.callStatus && (
                                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full border border-green-200">
                                  {item.callStatus}
                                </span>
                              )}
                              {!item.status && !item.callStatus && (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium">No records found for this stage</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
