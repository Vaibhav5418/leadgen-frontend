import { useState, useEffect, lazy, Suspense } from 'react';
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

export default function ProspectDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get('projectId') || '');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedProject]);

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

  const handleProjectChange = (projectId) => {
    setSelectedProject(projectId);
    if (projectId) {
      setSearchParams({ projectId });
    } else {
      setSearchParams({});
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'funnels', label: 'Funnels', icon: 'funnel' },
    { id: 'pipeline', label: 'Pipeline', icon: 'chart' },
    { id: 'team', label: 'Team Performance', icon: 'users' }
  ];

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
          <p className="text-gray-600">Failed to load dashboard data</p>
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

  const MetricCard = ({ title, value, subtitle, icon, color = 'blue' }) => {
    const colorClasses = {
      blue: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-100', icon: 'text-indigo-600', badge: 'text-blue-700 bg-white/70 border-blue-100' },
      green: { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-100', icon: 'text-emerald-600', badge: 'text-emerald-700 bg-white/70 border-emerald-100' },
      purple: { bg: 'from-purple-50 to-indigo-50', border: 'border-purple-100', icon: 'text-purple-600', badge: 'text-purple-700 bg-white/70 border-purple-100' },
      orange: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-100', icon: 'text-amber-600', badge: 'text-amber-700 bg-white/70 border-amber-100' }
    };
    const colors = colorClasses[color] || colorClasses.blue;

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

  const FunnelVisualization = ({ title, data, color = 'blue' }) => {
    // Determine which stages to show based on funnel type
    let stages = [];
    if (data.callSent !== undefined) {
      // Cold Calling Funnel
      stages = [
        { key: 'prospectData', label: 'Prospect Data' },
        { key: 'callSent', label: 'Call Sent' },
        { key: 'accepted', label: 'Accepted' },
        { key: 'followups', label: 'Followups' },
        { key: 'cip', label: 'CIP' },
        { key: 'meetingProposed', label: 'Meeting Proposed' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'completed', label: 'Completed' },
        { key: 'sql', label: 'SQL' }
      ];
    } else if (data.emailSent !== undefined) {
      // Email Funnel
      stages = [
        { key: 'prospectData', label: 'Prospect Data' },
        { key: 'emailSent', label: 'Email Sent' },
        { key: 'accepted', label: 'Accepted' },
        { key: 'followups', label: 'Followups' },
        { key: 'cip', label: 'CIP' },
        { key: 'meetingProposed', label: 'Meeting Proposed' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'completed', label: 'Completed' },
        { key: 'sql', label: 'SQL' }
      ];
    } else if (data.connectionSent !== undefined) {
      // LinkedIn Funnel
      stages = [
        { key: 'prospectData', label: 'Prospect Data' },
        { key: 'connectionSent', label: 'Connection Sent' },
        { key: 'accepted', label: 'Accepted' },
        { key: 'followups', label: 'Followups' },
        { key: 'cip', label: 'CIP' },
        { key: 'meetingProposed', label: 'Meeting Proposed' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'completed', label: 'Completed' },
        { key: 'sql', label: 'SQL' }
      ];
    }
    
    stages = stages.filter(s => s.key && data[s.key] !== undefined);

    const maxValue = data.prospectData || 1;
    const colorMap = {
      blue: { primary: 'rgb(59, 130, 246)', light: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' },
      green: { primary: 'rgb(34, 197, 94)', light: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' },
      purple: { primary: 'rgb(168, 85, 247)', light: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)' }
    };
    const colors = colorMap[color] || colorMap.blue;

    // Calculate funnel widths (trapezoid shape - wider at top, narrower at bottom)
    const calculateWidth = (index, total) => {
      const baseWidth = 100; // Start at 100%
      const reductionPerStep = 8; // Reduce by 8% each step
      return Math.max(20, baseWidth - (index * reductionPerStep)); // Minimum 20% width
    };

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4 text-center">{title}</h3>
        <div className="flex flex-col items-center space-y-0">
          {stages.map((stage, index) => {
            const value = data[stage.key] || 0;
            const percentage = maxValue > 0 ? ((value / maxValue) * 100).toFixed(1) : 0;
            const funnelWidth = calculateWidth(index, stages.length);
            const actualWidth = maxValue > 0 ? (value / maxValue) * funnelWidth : 0;
            
            return (
              <div key={stage.key} className="relative w-full flex flex-col items-center">
                {/* Funnel segment */}
                <div 
                  className="relative transition-all duration-500"
                  style={{
                    width: `${funnelWidth}%`,
                    minHeight: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {/* Background trapezoid */}
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: index === 0 
                        ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' // First item: rectangle
                        : index === stages.length - 1
                        ? 'polygon(10% 0, 90% 0, 100% 100%, 0 100%)' // Last item: narrow at bottom
                        : 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)', // Middle items: trapezoid
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
                        width: `${(actualWidth / funnelWidth) * 100}%`,
                        height: '100%',
                        backgroundColor: colors.primary,
                        clipPath: index === 0 
                          ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                          : index === stages.length - 1
                          ? 'polygon(10% 0, 90% 0, 100% 100%, 0 100%)'
                          : 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)',
                        opacity: 0.8
                      }}
                    />
                  )}
                  
                  {/* Content */}
                  <div className="relative z-10 w-full px-3 py-2 text-center">
                    <div className="text-xs font-medium text-gray-700 mb-1">{stage.label}</div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{value.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">({percentage}%)</span>
                    </div>
                  </div>
                </div>
                
                {/* Connector line */}
                {index < stages.length - 1 && (
                  <div 
                    className="w-0.5"
                    style={{
                      height: '8px',
                      backgroundColor: colors.primary,
                      opacity: 0.5
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
              <div className="text-gray-600 mb-1">Conversion Rate</div>
              <div className="text-sm font-semibold text-gray-900">
                {maxValue > 0 ? ((data.sql / maxValue) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600 mb-1">Meeting Rate</div>
              <div className="text-sm font-semibold text-gray-900">
                {maxValue > 0 ? ((data.scheduled / maxValue) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Prospect Analytics Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                {analytics.project 
                  ? `Analytics for ${analytics.project.companyName}`
                  : 'Comprehensive insights across all projects'}
              </p>
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
            {tabs.map((tab) => (
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Total Prospects"
                value={analytics.overview.totalProspects.toLocaleString()}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
                color="blue"
              />
              <MetricCard
                title="Total Activities"
                value={analytics.overview.totalActivities.toLocaleString()}
                subtitle="Calls, emails & LinkedIn"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                color="green"
              />
              <MetricCard
                title="Win Rate"
                value={`${analytics.pipeline.conversion.winRate}%`}
                subtitle={`${analytics.pipeline.conversion.won} won`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="purple"
              />
              <MetricCard
                title="Meeting Rate"
                value={`${analytics.pipeline.conversion.meetingRate}%`}
                subtitle={`${analytics.pipeline.conversion.meetings} meetings`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                color="orange"
              />
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
                            {
                              label: 'Calls',
                              data: analytics.activities.trends.call,
                              borderColor: 'rgb(34, 197, 94)',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              tension: 0.4,
                            },
                            {
                              label: 'Emails',
                              data: analytics.activities.trends.email,
                              borderColor: 'rgb(59, 130, 246)',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              tension: 0.4,
                            },
                            {
                              label: 'LinkedIn',
                              data: analytics.activities.trends.linkedin,
                              borderColor: 'rgb(168, 85, 247)',
                              backgroundColor: 'rgba(168, 85, 247, 0.1)',
                              tension: 0.4,
                            },
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
                          labels: analytics.activities.byType.map(a => a.type.charAt(0).toUpperCase() + a.type.slice(1)),
                          datasets: [{
                            data: analytics.activities.byType.map(a => a.count),
                            backgroundColor: [
                              'rgb(34, 197, 94)',
                              'rgb(59, 130, 246)',
                              'rgb(168, 85, 247)',
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <FunnelVisualization
                title="Cold Calling Funnel"
                data={analytics.funnels.coldCalling}
                color="green"
              />
              <FunnelVisualization
                title="Email Funnel"
                data={analytics.funnels.email}
                color="blue"
              />
              <FunnelVisualization
                title="LinkedIn Funnel"
                data={analytics.funnels.linkedin}
                color="purple"
              />
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Conversion Metrics */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{analytics.pipeline.conversion.winRate}%</div>
                  <div className="text-sm text-gray-600">Win Rate</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {analytics.pipeline.conversion.won} won / {analytics.pipeline.conversion.total} total
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">{analytics.pipeline.conversion.meetingRate}%</div>
                  <div className="text-sm text-gray-600">Meeting Rate</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {analytics.pipeline.conversion.meetings} meetings scheduled
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 mb-2">{analytics.pipeline.conversion.sql}</div>
                  <div className="text-sm text-gray-600">SQL Count</div>
                  <div className="text-xs text-gray-500 mt-1">Sales Qualified Leads</div>
                </div>
              </div>
            </div>

            {/* Stage Distribution Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Stage Distribution</h3>
              {analytics.prospects.byStage.length > 0 ? (
                <div className="h-96">
                  <Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                    <Bar
                      data={{
                        labels: analytics.prospects.byStage.map(s => s.stage),
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
                          x: { beginAtZero: true },
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

        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
              {analytics.team.performance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team Member</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Activities</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calls</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emails</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LinkedIn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {analytics.team.performance.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{member.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">{member.email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{member.totalActivities}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{member.calls}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{member.emails}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{member.linkedin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm">No team performance data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
