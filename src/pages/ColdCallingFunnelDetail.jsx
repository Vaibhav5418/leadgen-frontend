import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';

// Version: 2.0 - Updated funnel stages (10 stages)
export default function ColdCallingFunnelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState({
    prospectData: 0,
    callsAttempted: 0,
    callsConnected: 0,
    decisionMakerReached: 0,
    interested: 0,
    detailsShared: 0,
    demoBooked: 0,
    demoCompleted: 0,
    sql: 0,
    won: 0
  });

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    if (id && (contacts.length > 0 || activities.length > 0)) {
      calculateFunnelData();
    } else if (id && contacts.length === 0 && activities.length === 0) {
      // Initialize with zero values if no data
      setFunnelData({
        prospectData: 0,
        callsAttempted: 0,
        callsConnected: 0,
        decisionMakerReached: 0,
        interested: 0,
        detailsShared: 0,
        demoBooked: 0,
        demoCompleted: 0,
        sql: 0,
        won: 0
      });
    }
  }, [id, contacts, activities]);

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

      // Fetch all call activities for the project
      const activitiesResponse = await API.get(`/activities/project/${id}?limit=10000`);
      if (activitiesResponse.data.success) {
        const allActivities = activitiesResponse.data.data || [];
        const callActivities = allActivities.filter(a => a.type === 'call');
        setActivities(callActivities);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateFunnelData = () => {
    console.log('Calculating funnel data...', { contactsCount: contacts.length, activitiesCount: activities.length });
    
    const data = {
      prospectData: contacts.length, // Total prospects from project
      callsAttempted: 0,
      callsConnected: 0,
      decisionMakerReached: 0,
      interested: 0,
      detailsShared: 0,
      demoBooked: 0,
      demoCompleted: 0,
      sql: 0,
      won: 0
    };

    if (activities.length === 0) {
      console.log('No activities found, setting default data');
      setFunnelData(data);
      return;
    }

    // Calculate metrics using Sets to track unique contacts at each stage
    const callsAttemptedSet = new Set();
    const callsConnectedSet = new Set();
    const decisionMakerReachedSet = new Set();
    const interestedSet = new Set();
    const detailsSharedSet = new Set();
    const demoBookedSet = new Set();
    const demoCompletedSet = new Set();
    const sqlSet = new Set();
    const wonSet = new Set();

    activities.forEach(activity => {
      const contactId = activity.contactId?.toString();
      if (!contactId) return;

      // Calls Attempted - if callDate exists, it means a call was attempted
      if (activity.callDate) {
        callsAttemptedSet.add(contactId);
      }

      // Calls Connected - if callStatus indicates a connection (not Ring, Busy, Hang Up, Switch Off, Invalid)
      const connectedStatuses = ['Interested', 'Not Interested', 'Call Back', 'Future', 'Details Shared', 'Demo Booked', 'Demo Completed', 'Existing'];
      if (activity.callStatus && connectedStatuses.includes(activity.callStatus)) {
        callsConnectedSet.add(contactId);
      }

      // Decision Maker Reached - if callStatus indicates decision maker engagement
      const decisionMakerStatuses = ['Interested', 'Details Shared', 'Demo Booked', 'Demo Completed'];
      if (activity.callStatus && decisionMakerStatuses.includes(activity.callStatus)) {
        decisionMakerReachedSet.add(contactId);
      }

      // Interested - if callStatus is 'Interested'
      if (activity.callStatus === 'Interested') {
        interestedSet.add(contactId);
      }

      // Details Shared - if callStatus is 'Details Shared'
      if (activity.callStatus === 'Details Shared') {
        detailsSharedSet.add(contactId);
      }

      // Demo Booked - if callStatus is 'Demo Booked'
      if (activity.callStatus === 'Demo Booked') {
        demoBookedSet.add(contactId);
      }

      // Demo Completed - if callStatus is 'Demo Completed'
      if (activity.callStatus === 'Demo Completed') {
        demoCompletedSet.add(contactId);
      }

      // SQL (Sales Qualified Lead) - if callStatus is 'Demo Completed' or 'Interested' with high engagement
      if (activity.callStatus === 'Demo Completed' || 
          (activity.callStatus === 'Interested' && activity.conversationNotes && activity.conversationNotes.length > 50) ||
          activity.status === 'SQL') {
        sqlSet.add(contactId);
      }

      // WON - if status is 'WON'
      if (activity.status === 'WON') {
        wonSet.add(contactId);
      }
    });

    // Set final counts
    data.callsAttempted = callsAttemptedSet.size;
    data.callsConnected = callsConnectedSet.size;
    data.decisionMakerReached = decisionMakerReachedSet.size;
    data.interested = interestedSet.size;
    data.detailsShared = detailsSharedSet.size;
    data.demoBooked = demoBookedSet.size;
    data.demoCompleted = demoCompletedSet.size;
    data.sql = sqlSet.size;
    data.won = wonSet.size;

    console.log('Funnel data calculated:', data);
    console.log('Stage breakdown:', {
      callsAttempted: data.callsAttempted,
      callsConnected: data.callsConnected,
      decisionMakerReached: data.decisionMakerReached,
      interested: data.interested,
      detailsShared: data.detailsShared,
      demoBooked: data.demoBooked,
      demoCompleted: data.demoCompleted,
      sql: data.sql,
      won: data.won
    });
    setFunnelData(data);
  };

  // Updated 10-stage funnel configuration
  const funnelRows = [
    { key: 'prospectData', label: 'Prospect Data', description: 'Total prospects from this project' },
    { key: 'callsAttempted', label: 'Calls Attempted', description: 'Total calls made to prospects' },
    { key: 'callsConnected', label: 'Calls Connected', description: 'Calls where contact answered' },
    { key: 'decisionMakerReached', label: 'Decision Maker Reached', description: 'Reached decision maker' },
    { key: 'interested', label: 'Interested', description: 'Prospects showing interest' },
    { key: 'detailsShared', label: 'Details Shared', description: 'Product/service details shared' },
    { key: 'demoBooked', label: 'Demo Booked', description: 'Demos scheduled' },
    { key: 'demoCompleted', label: 'Demo Completed', description: 'Demos successfully completed' },
    { key: 'sql', label: 'SQL', description: 'Sales Qualified Leads' },
    { key: 'won', label: 'WON', description: 'Deals closed successfully' }
  ];

  // Debug: Log funnel rows to verify they're correct
  useEffect(() => {
    console.log('Funnel rows configured:', funnelRows.length, 'stages');
    console.log('Stage labels:', funnelRows.map(r => r.label));
  }, []);

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
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-emerald-700 rounded-full"></div>
              <h1 className="text-xl font-semibold text-gray-900">
                Cold Calling Funnel - {project?.companyName || 'Project'}
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
            <h2 className="text-base font-bold text-gray-800 mb-0.5">Cold Calling Funnel Performance</h2>
            <p className="text-[10px] text-gray-600">Updated: 10-Stage Funnel • Conversion metrics and pipeline health</p>
            <div className="mt-1 text-[9px] text-blue-600 font-semibold">
              Stages: {funnelRows.length} | Total Prospects: {funnelData.prospectData}
            </div>
            {funnelData.prospectData === 0 && (
              <p className="text-xs text-amber-600 mt-2 font-medium">⚠️ No prospects found. Add contacts to see funnel data.</p>
            )}
          </div>
          
          <div className="flex flex-col items-center space-y-0.5" key={`funnel-${funnelRows.length}`}>
            {funnelRows.map((row, index) => {
              const value = funnelData[row.key] !== undefined ? funnelData[row.key] : 0;
              const maxValue = funnelData.prospectData || 1;
              const percentage = maxValue > 0 ? ((value / maxValue) * 100) : 0;
              
              // Debug log for each stage
              if (index === 0) {
                console.log(`Rendering stage ${index}: ${row.label} = ${value} (key: ${row.key})`);
              }
              
              // Calculate width based on funnel position (wider at top, narrower at bottom)
              const funnelWidths = [96, 88, 80, 72, 64, 56, 48, 40, 32, 24]; // Progressive narrowing for 10 stages
              const actualWidth = funnelWidths[index] || 20;
              
              // Enterprise color scheme based on stage
              let bgGradient = '';
              let textColor = 'text-white';
              let borderColor = '';
              let shadowColor = '';
              let iconBg = '';
              
              // Color scheme based on stage progression
              if (index === 0) {
                // Prospect Data - Blue
                bgGradient = 'from-blue-600 via-blue-500 to-cyan-500';
                borderColor = 'border-blue-400';
                shadowColor = 'shadow-blue-500/30';
                iconBg = 'bg-blue-400/30';
              } else if (index === 1 || index === 2) {
                // Calls Attempted/Connected - Purple
                bgGradient = 'from-purple-600 via-purple-500 to-indigo-500';
                borderColor = 'border-purple-400';
                shadowColor = 'shadow-purple-500/30';
                iconBg = 'bg-purple-400/30';
              } else if (index === 3 || index === 4) {
                // Decision Maker/Interested - Orange
                bgGradient = 'from-orange-600 via-orange-500 to-amber-500';
                borderColor = 'border-orange-400';
                shadowColor = 'shadow-orange-500/30';
                iconBg = 'bg-orange-400/30';
              } else if (index === 5 || index === 6) {
                // Details Shared/Demo Booked - Yellow
                bgGradient = 'from-yellow-600 via-yellow-500 to-amber-500';
                borderColor = 'border-yellow-400';
                shadowColor = 'shadow-yellow-500/30';
                iconBg = 'bg-yellow-400/30';
              } else if (index === 7 || index === 8) {
                // Demo Completed/SQL - Green
                bgGradient = 'from-emerald-600 via-emerald-500 to-teal-500';
                borderColor = 'border-emerald-400';
                shadowColor = 'shadow-emerald-500/30';
                iconBg = 'bg-emerald-400/30';
              } else {
                // WON - Gold
                bgGradient = 'from-amber-600 via-amber-500 to-yellow-500';
                borderColor = 'border-amber-400';
                shadowColor = 'shadow-amber-500/30';
                iconBg = 'bg-amber-400/30';
              }
              
              // Icons for each stage - Updated for 10 stages
              const icons = [
                '👥', // Prospect Data
                '📞', // Calls Attempted
                '📱', // Calls Connected
                '👔', // Decision Maker Reached
                '💡', // Interested
                '📋', // Details Shared
                '📅', // Demo Booked
                '✅', // Demo Completed
                '🎯', // SQL
                '🏆'  // WON
              ];
              
              const stageIcon = icons[index] || '📊';
              
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
                            <span className="text-sm">{icons[index] || '📊'}</span>
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
          <div className="group relative bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-xl p-4 shadow-xl hover:shadow-blue-500/30 transition-all duration-500 transform hover:scale-105 overflow-hidden">
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
                  ? ((funnelData.demoCompleted / funnelData.prospectData) * 100).toFixed(1) 
                  : 0}%
              </div>
              <div className="text-[10px] text-white/80 font-medium">Demos completed</div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30"></div>
          </div>
          
          <div className="group relative bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-500 rounded-xl p-4 shadow-xl hover:shadow-teal-500/30 transition-all duration-500 transform hover:scale-105 overflow-hidden">
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
