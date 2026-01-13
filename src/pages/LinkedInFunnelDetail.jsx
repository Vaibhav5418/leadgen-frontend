import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function LinkedInFunnelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState({
    prospectData: 0,
    connectionSent: 0,
    accepted: 0,
    followups: 0,
    cip: 0,
    meetingProposed: 0,
    scheduled: 0,
    completed: 0,
    sql: 0
  });

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    if (contacts.length > 0 || activities.length > 0) {
      calculateFunnelData();
    }
  }, [contacts, activities]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const projectResponse = await API.get(`/projects/${id}`);
      if (projectResponse.data.success) {
        setProject(projectResponse.data.data);
      }

      // Fetch project contacts
      const contactsResponse = await API.get(`/projects/${id}/project-contacts`);
      if (contactsResponse.data.success) {
        setContacts(contactsResponse.data.data || []);
      }

      // Fetch all LinkedIn activities for the project
      const activitiesResponse = await API.get(`/activities/project/${id}?limit=10000`);
      if (activitiesResponse.data.success) {
        const allActivities = activitiesResponse.data.data || [];
        const linkedInActivities = allActivities.filter(a => a.type === 'linkedin');
        setActivities(linkedInActivities);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateFunnelData = () => {
    const data = {
      prospectData: contacts.length, // Total prospects from project
      connectionSent: 0,
      accepted: 0,
      followups: 0,
      cip: 0,
      meetingProposed: 0,
      scheduled: 0,
      completed: 0,
      sql: 0
    };

    // Group activities by contact
    const contactActivities = {};
    activities.forEach(activity => {
      if (!activity.contactId) return;
      const contactId = activity.contactId.toString();
      if (!contactActivities[contactId]) {
        contactActivities[contactId] = [];
      }
      contactActivities[contactId].push(activity);
    });

    // Calculate metrics
    const connectionSentSet = new Set();
    const acceptedSet = new Set();
    const cipSet = new Set();
    const meetingProposedSet = new Set();
    const scheduledSet = new Set();
    const completedSet = new Set();
    const sqlSet = new Set();

    activities.forEach(activity => {
      const contactId = activity.contactId?.toString();
      if (!contactId) return;

      // Connection Request Sent
      if (activity.lnRequestSent === 'Yes' || activity.lnRequestSent === true) {
        connectionSentSet.add(contactId);
      }

      // Connection Accepted
      if (activity.connected === 'Yes' || activity.connected === true) {
        acceptedSet.add(contactId);
      }

      // Conversations in Progress (CIP)
      if (activity.status === 'CIP') {
        cipSet.add(contactId);
      }

      // Meeting Proposed
      if (activity.status === 'Meeting Proposed') {
        meetingProposedSet.add(contactId);
      }

      // Meeting Scheduled
      if (activity.status === 'Meeting Scheduled') {
        scheduledSet.add(contactId);
      }

      // Meeting Completed
      if (activity.status === 'Meeting Completed') {
        completedSet.add(contactId);
      }

      // SQL (Sales Qualified Lead) - typically means meeting completed or high engagement
      if (activity.status === 'Meeting Completed' || activity.status === 'Interested') {
        sqlSet.add(contactId);
      }
    });

    // Calculate followups (contacts with more than one message)
    Object.keys(contactActivities).forEach(contactId => {
      const contactActs = contactActivities[contactId];
      const messagesWithNotes = contactActs.filter(a => a.conversationNotes && a.conversationNotes.trim() !== '');
      if (messagesWithNotes.length > 1) {
        data.followups++;
      }
    });

    data.connectionSent = connectionSentSet.size;
    data.accepted = acceptedSet.size;
    data.cip = cipSet.size;
    data.meetingProposed = meetingProposedSet.size;
    data.scheduled = scheduledSet.size;
    data.completed = completedSet.size;
    data.sql = sqlSet.size;

    setFunnelData(data);
  };

  const funnelRows = [
    { key: 'prospectData', label: 'Prospect Data', description: 'Total prospects from this project' },
    { key: 'connectionSent', label: 'Connection Sent', description: 'Connection requests sent' },
    { key: 'accepted', label: 'Accepted', description: 'Connections accepted' },
    { key: 'followups', label: 'Followups', description: 'Contacts with multiple messages' },
    { key: 'cip', label: 'CIP', description: 'Conversations in Progress' },
    { key: 'meetingProposed', label: 'Meeting Proposed', description: 'Meetings proposed' },
    { key: 'scheduled', label: 'Scheduled', description: 'Meetings scheduled' },
    { key: 'completed', label: 'Completed', description: 'Meetings completed' },
    { key: 'sql', label: 'SQL', description: 'Sales Qualified Leads' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading funnel data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4">
        {/* Header */}
        <div className="mb-4">
          <button
            onClick={() => navigate(`/projects/${id}`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-200 mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Prospect Management
          </button>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-indigo-700 rounded-full"></div>
              <h1 className="text-xl font-semibold text-gray-900">
                LinkedIn Funnel - {project?.companyName || 'Project'}
              </h1>
            </div>
            {project?.website && (
              <a 
                href={project.website.startsWith('http') ? project.website : `http://${project.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {project.website}
              </a>
            )}
          </div>
        </div>

        {/* Enterprise Funnel Visualization - Compact */}
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 border border-gray-200 rounded-lg shadow-lg p-4 backdrop-blur-sm">
          <div className="mb-3 text-center">
            <h2 className="text-base font-bold text-gray-800 mb-0.5">Sales Funnel Performance</h2>
            <p className="text-[10px] text-gray-600">Conversion metrics and pipeline health</p>
          </div>
          
          <div className="flex flex-col items-center space-y-0.5">
            {funnelRows.map((row, index) => {
              const value = funnelData[row.key] || 0;
              const maxValue = funnelData.prospectData || 1;
              const percentage = maxValue > 0 ? ((value / maxValue) * 100) : 0;
              
              // Calculate width based on funnel position (wider at top, narrower at bottom)
              const funnelWidths = [96, 88, 78, 68, 58, 48, 38, 28, 20]; // Progressive narrowing
              const actualWidth = funnelWidths[index] || 15;
              
              // Enterprise color scheme based on stage
              let bgGradient = '';
              let textColor = 'text-white';
              let borderColor = '';
              let shadowColor = '';
              let iconBg = '';
              
              if (index === 0) {
                bgGradient = 'from-blue-600 via-blue-500 to-indigo-500';
                borderColor = 'border-blue-400';
                shadowColor = 'shadow-blue-500/30';
                iconBg = 'bg-blue-400/30';
              } else if (index >= 5) {
                bgGradient = 'from-indigo-600 via-indigo-500 to-purple-500';
                borderColor = 'border-indigo-400';
                shadowColor = 'shadow-indigo-500/30';
                iconBg = 'bg-indigo-400/30';
              } else {
                bgGradient = 'from-slate-600 via-slate-500 to-gray-500';
                borderColor = 'border-slate-400';
                shadowColor = 'shadow-slate-500/30';
                iconBg = 'bg-slate-400/30';
              }
              
              // Icons for each stage
              const icons = [
                '👥', '🔗', '✅', '🔄', '💬', '📅', '📆', '✓', '🎯'
              ];
              
              return (
                <div
                  key={row.key}
                  className="w-full flex flex-col items-center transition-all duration-700 ease-out"
                  style={{
                    animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s both`
                  }}
                >
                  <div
                    className={`relative bg-gradient-to-r ${bgGradient} ${borderColor} border rounded-md shadow-md ${shadowColor} hover:shadow-lg transition-all duration-500 transform hover:scale-[1.01] hover:-translate-y-0.5 group overflow-hidden`}
                    style={{
                      width: `${actualWidth}%`,
                      minWidth: '150px',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
                    </div>
                    
                    {/* Content */}
                    <div className="relative px-3 py-1.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`${iconBg} backdrop-blur-sm rounded p-1 shadow-sm`}>
                            <span className="text-sm">{icons[index]}</span>
                          </div>
                          <div>
                            <span className={`${textColor} text-[10px] font-bold uppercase tracking-wide block leading-tight`}>
                              {row.label}
                            </span>
                            <span className={`${textColor} text-[9px] opacity-80 mt-0 block`}>
                              {row.description}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`${textColor} text-lg font-extrabold mb-0 drop-shadow-lg`}>
                            {value.toLocaleString()}
                          </div>
                          {index > 0 && maxValue > 0 && (
                            <div className={`${textColor} text-[9px] font-semibold bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/30`}>
                              {percentage.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Enhanced Progress bar */}
                      {index > 0 && (
                        <div className="mt-1 h-0.5 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden border border-white/20">
                          <div
                            className="h-full bg-gradient-to-r from-white/80 to-white rounded-full transition-all duration-1000 ease-out shadow-sm"
                            style={{ 
                              width: `${Math.min(percentage, 100)}%`,
                              animation: `progressFill 1.5s ease-out ${index * 0.1 + 0.5}s both`
                            }}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Shine effect on hover */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  </div>
                  
                  {/* Enhanced Connector line */}
                  {index < funnelRows.length - 1 && (
                    <div className="relative my-0.5">
                      <div className="w-0.5 h-2 bg-gradient-to-b from-gray-400 via-gray-500 to-gray-400 rounded-full shadow-inner mx-auto"></div>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-gray-500 rounded-full shadow-sm"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes progressFill {
            from {
              width: 0%;
            }
          }
          
          .shadow-3xl {
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
          }
        `}</style>

        {/* Enterprise Summary Cards - Compact */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group relative bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500 rounded-xl p-4 shadow-xl hover:shadow-blue-500/30 transition-all duration-500 transform hover:scale-105 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">Total Prospects</div>
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <span className="text-base">👥</span>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white mb-0.5 drop-shadow-lg">{funnelData.prospectData.toLocaleString()}</div>
              <div className="text-[10px] text-white/80 font-medium">Pipeline foundation</div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30"></div>
          </div>
          
          <div className="group relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-xl p-4 shadow-xl hover:shadow-emerald-500/30 transition-all duration-500 transform hover:scale-105 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">Conversion Rate</div>
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <span className="text-base">📈</span>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white mb-0.5 drop-shadow-lg">
                {funnelData.prospectData > 0 
                  ? ((funnelData.completed / funnelData.prospectData) * 100).toFixed(1) 
                  : 0}%
              </div>
              <div className="text-[10px] text-white/80 font-medium">Meetings completed</div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30"></div>
          </div>
          
          <div className="group relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-500 rounded-xl p-4 shadow-xl hover:shadow-indigo-500/30 transition-all duration-500 transform hover:scale-105 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-white/90 uppercase tracking-wider">SQL Rate</div>
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <span className="text-base">🎯</span>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white mb-0.5 drop-shadow-lg">
                {funnelData.prospectData > 0 
                  ? ((funnelData.sql / funnelData.prospectData) * 100).toFixed(1) 
                  : 0}%
              </div>
              <div className="text-[10px] text-white/80 font-medium">Sales qualified leads</div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
