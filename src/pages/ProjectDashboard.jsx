import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await API.get('/projects/analytics');
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching project analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'pipeline', label: 'Pipeline', icon: 'funnel' },
    { id: 'channels', label: 'Channels', icon: 'megaphone' },
    { id: 'team', label: 'Team Performance', icon: 'users' },
    { id: 'projects', label: 'Project Health', icon: 'health' }
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

  const MetricCard = ({ title, value, subtitle, icon, trend, trendDirection, color = 'blue' }) => {
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
          {trend && (
            <span className={`text-xs font-semibold ${colors.badge} px-2 py-1 rounded-full shadow-xs flex items-center gap-1`}>
              {trendDirection === 'up' ? '↑' : '↓'} {trend}
            </span>
          )}
        </div>
        <div className="text-3xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-sm text-gray-600 mt-1">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
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
              <h1 className="text-3xl font-bold text-gray-900">Project Analytics Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Comprehensive insights into your lead generation campaigns</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button
                onClick={() => navigate('/projects')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                View Projects
              </button>
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
                title="Total Projects"
                value={analytics.overview.totalProjects}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                color="blue"
              />
              <MetricCard
                title="Active Projects"
                value={analytics.overview.activeProjects}
                subtitle={`${analytics.overview.draftProjects} in draft`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                color="green"
              />
              <MetricCard
                title="Total Prospects"
                value={analytics.overview.totalProspects.toLocaleString()}
                subtitle={`Across all projects`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
                color="purple"
              />
              <MetricCard
                title="Total Activities"
                value={analytics.overview.totalActivities.toLocaleString()}
                subtitle={`Calls, emails & LinkedIn`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Project Growth */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Growth</h3>
                {analytics.growth.monthly.length > 0 ? (
                  <div className="h-64">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                      <Bar
                        data={{
                          labels: analytics.growth.monthly.map(m => m.month),
                          datasets: [{
                            label: 'Projects Created',
                            data: analytics.growth.monthly.map(m => m.count),
                            backgroundColor: 'rgb(59, 130, 246)',
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
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
                    <p className="text-sm">No growth data available</p>
                  </div>
                )}
              </div>

              {/* Conversion Metrics */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Metrics</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">Win Rate</span>
                      <span className="text-lg font-bold text-green-600">{analytics.pipeline.conversion.winRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full"
                        style={{ width: `${analytics.pipeline.conversion.winRate}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {analytics.pipeline.conversion.won} won / {analytics.pipeline.conversion.total} total
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">Meeting Rate</span>
                      <span className="text-lg font-bold text-blue-600">{analytics.pipeline.conversion.meetingRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ width: `${analytics.pipeline.conversion.meetingRate}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {analytics.pipeline.conversion.meetings} meetings scheduled
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{analytics.pipeline.conversion.sql}</div>
                      <div className="text-xs text-gray-500">SQL</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{analytics.pipeline.conversion.cip}</div>
                      <div className="text-xs text-gray-500">CIP</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{analytics.pipeline.conversion.lost}</div>
                      <div className="text-xs text-gray-500">Lost</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Projects */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Projects</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prospects</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Won</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meetings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics.projects.topPerformers.slice(0, 5).map((project) => (
                      <tr
                        key={project.id}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.companyName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{project.contactCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{project.activityCount}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">{project.wonCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{project.meetingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Stage Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Stage Distribution</h3>
              {analytics.pipeline.stageDistribution.length > 0 ? (
                <div className="h-96">
                  <Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                    <Bar
                      data={{
                        labels: analytics.pipeline.stageDistribution.map(s => s.stage),
                        datasets: [{
                          label: 'Prospects',
                          data: analytics.pipeline.stageDistribution.map(s => s.count),
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

        {activeTab === 'channels' && (
          <div className="space-y-6">
            {/* Channel Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Usage</h3>
                <div className="h-64">
                  <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                    <Pie
                      data={{
                        labels: ['LinkedIn', 'Email', 'Cold Calling'],
                        datasets: [{
                          data: [
                            analytics.channels.linkedIn,
                            analytics.channels.email,
                            analytics.channels.calling
                          ],
                          backgroundColor: [
                            'rgb(168, 85, 247)',
                            'rgb(59, 130, 246)',
                            'rgb(34, 197, 94)',
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
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Statistics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">LinkedIn Outreach</div>
                      <div className="text-2xl font-bold text-gray-900">{analytics.channels.linkedIn}</div>
                      <div className="text-xs text-gray-500">Projects using this channel</div>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">Cold Email</div>
                      <div className="text-2xl font-bold text-gray-900">{analytics.channels.email}</div>
                      <div className="text-xs text-gray-500">Projects using this channel</div>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <div className="text-sm text-gray-600">Cold Calling</div>
                      <div className="text-2xl font-bold text-gray-900">{analytics.channels.calling}</div>
                      <div className="text-xs text-gray-500">Projects using this channel</div>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
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

        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Health Score</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Health Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prospects</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recent Activity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Won/Lost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics.projects.health.map((project) => (
                      <tr
                        key={project.id}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{project.companyName}</div>
                          <div className="text-xs text-gray-500">{project.status}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                              <div
                                className={`h-2 rounded-full ${
                                  project.healthScore >= 70 ? 'bg-green-500' :
                                  project.healthScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${project.healthScore}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{project.healthScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{project.contactCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{project.activityCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{project.recentActivity}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-green-600">{project.wonCount}</span>
                            <span className="text-sm text-gray-400">/</span>
                            <span className="text-sm font-semibold text-red-600">{project.lostCount}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
