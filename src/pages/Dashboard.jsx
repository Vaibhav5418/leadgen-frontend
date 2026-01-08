import { useState, useEffect, useMemo, memo, lazy, Suspense } from 'react';
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

// Lazy load chart components for better initial load performance
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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const response = await API.get('/dashboard/stats', {
          signal: abortController.signal
        });
        if (isMounted) {
          setStats(response.data?.data || response.data);
        }
      } catch (err) {
        // Only log errors that are not cancellations
        const isCanceled = err.name === 'CanceledError' || 
                          err.message === 'canceled' || 
                          err.code === 'ERR_CANCELED' ||
                          (err.config && err.config.signal && err.config.signal.aborted);
        
        if (!isCanceled && isMounted) {
          console.error('Error fetching dashboard stats:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDashboardStats();

    return () => {
      isMounted = false;
      // Only abort if the request is still pending
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
    };
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'industry', label: 'Industry', icon: 'building' },
    { id: 'geography', label: 'Geography', icon: 'globe' },
    { id: 'designation', label: 'Designation & Persona', icon: 'briefcase' },
    { id: 'data-quality', label: 'Data Quality', icon: 'shield' },
    { id: 'ownership', label: 'Ownership & Team', icon: 'users' }
  ];

  // Memoized calculations - must be at top level before any conditional returns
  const dataHealthScores = useMemo(() => {
    if (!stats) {
      return { overallScore: 0, completeness: 0, deduplication: 100, freshness: 0 };
    }
    const totalContacts = stats.totalContacts || 0;
    const overallScore = totalContacts > 0 ? Math.round(
      ((stats.emailValidity?.valid || 0) / totalContacts * 0.3 +
       (stats.outreachReady?.value || 0) / totalContacts * 0.3 +
       (stats.enrichmentCoverage?.value || 0) / totalContacts * 0.2 +
       (1 - (stats.duplicateRecords?.value || 0) / totalContacts) * 0.2) * 100
    ) : 0;
    const completeness = totalContacts > 0 ? Math.round(
      ((stats.outreachReady?.value || 0) / totalContacts) * 100
    ) : 0;
    const deduplication = totalContacts > 0 ? Math.round(
      (1 - (stats.duplicateRecords?.value || 0) / totalContacts) * 100
    ) : 100;
    const freshness = stats.enrichmentCoverage?.percent ? Math.round(stats.enrichmentCoverage.percent) : 0;
    
    return { overallScore, completeness, deduplication, freshness };
  }, [stats?.totalContacts, stats?.emailValidity?.valid, stats?.outreachReady?.value, stats?.enrichmentCoverage?.value, stats?.duplicateRecords?.value, stats?.enrichmentCoverage?.percent]);

  // Memoized pie chart data
  const pieChartData = useMemo(() => {
    if (!stats?.topIndustries || stats.topIndustries.length === 0) {
      return null;
    }
    const top5 = stats.topIndustries.slice(0, 5);
    const totalTop5 = top5.reduce((sum, item) => sum + (item.count || 0), 0);
    const totalAll = stats.topIndustries.reduce((sum, item) => sum + (item.count || 0), 0);
    const othersCount = totalAll - totalTop5;
    
    const pieData = top5.map(item => ({
      label: item.name,
      value: item.count || 0,
      percentage: totalAll > 0 ? Math.round(((item.count || 0) / totalAll) * 100) : 0
    }));
    
    if (othersCount > 0) {
      pieData.push({
        label: 'Others',
        value: othersCount,
        percentage: Math.round((othersCount / totalAll) * 100)
      });
    }
    
    const colors = [
      'rgb(59, 130, 246)',   // Blue
      'rgb(34, 197, 94)',    // Green
      'rgb(249, 115, 22)',   // Orange
      'rgb(239, 68, 68)',    // Red
      'rgb(168, 85, 247)',   // Purple
      'rgb(156, 163, 175)'   // Gray for Others
    ];
    
    return {
      labels: pieData.map(item => `${item.label}: ${item.percentage}%`),
      data: pieData.map(item => item.value),
      colors: colors.slice(0, pieData.length)
    };
  }, [stats?.topIndustries]);

  // Skeleton loading component
  const SkeletonCard = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-full animate-pulse"></div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  // Memoized MetricCard component to prevent unnecessary re-renders
  const MetricCard = memo(({ title, value, trend, trendDirection, icon, subtitle, percent }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
              {percent && <span className="text-lg text-gray-500 ml-1">({percent}%)</span>}
            </h3>
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-gray-400">
          {icon === 'people' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
          {icon === 'building' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
          {icon === 'plus' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          )}
          {icon === 'check' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {icon === 'sparkle' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          )}
          {icon === 'clock' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {icon === 'envelope' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
          {icon === 'exclamation' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {icon === 'ban' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
          {icon === 'duplicate' && (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-sm ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          <svg className={`w-4 h-4 ${trendDirection === 'down' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span>{trend}</span>
        </div>
      )}
    </div>
  ));

  // Memoized AlertCard component
  const AlertCard = memo(({ type, title, description, action, actionLabel }) => {
    const colors = {
      success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', text: 'text-green-800' },
      warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', text: 'text-yellow-800' },
      error: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', text: 'text-red-800' }
    };
    const color = colors[type] || colors.success;

    return (
      <div className={`${color.bg} border ${color.border} rounded-lg p-6`}>
        <div className="flex items-start gap-4">
          <div className={`${color.icon} flex-shrink-0`}>
            {type === 'success' && (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {type === 'warning' && (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {type === 'error' && (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h4 className={`font-semibold ${color.text} mb-2`}>{title}</h4>
            <p className={`text-sm ${color.text} mb-4`}>{description}</p>
            {action && (
              <button
                onClick={action}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
              >
                {actionLabel}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Monitor your contact and account data performance</p>
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
                {tab.icon === 'grid' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                )}
                {tab.icon === 'building' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
                {tab.icon === 'globe' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 6.055V5a2 2 0 012-2h3.055M21 12.055V19a2 2 0 01-2 2h-3.055M9 3.055V5a2 2 0 012-2h2.945M9 20.945V19a2 2 0 012-2h2.945M21 3.055V5a2 2 0 00-2 2h-3.055M9 20.945V19a2 2 0 00-2-2H3.055" />
                  </svg>
                )}
                {tab.icon === 'briefcase' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                {tab.icon === 'shield' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
                {tab.icon === 'users' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricCard
                title="Total Contacts"
                value={stats.totalContacts?.value || 0}
                trend={stats.totalContacts?.trend}
                trendDirection={stats.totalContacts?.trendDirection}
                icon="people"
              />
              <MetricCard
                title="Total Accounts"
                value={stats.totalAccounts?.value || 0}
                trend={stats.totalAccounts?.trend}
                trendDirection={stats.totalAccounts?.trendDirection}
                icon="building"
              />
              <MetricCard
                title="New Contacts"
                value={stats.newContacts?.value || 0}
                trend={stats.newContacts?.trend}
                trendDirection={stats.newContacts?.trendDirection}
                icon="plus"
                subtitle="This month"
              />
              <MetricCard
                title="Outreach Ready"
                value={stats.outreachReady?.value || 0}
                percent={stats.outreachReady?.percent}
                trend={stats.outreachReady?.trend}
                trendDirection={stats.outreachReady?.trendDirection}
                icon="check"
              />
              <MetricCard
                title="Enrichment Coverage"
                value={stats.enrichmentCoverage?.percent || 0}
                subtitle={`${stats.enrichmentCoverage?.value || 0} contacts enriched`}
                trend={stats.enrichmentCoverage?.trend}
                trendDirection={stats.enrichmentCoverage?.trendDirection}
                icon="sparkle"
              />
              <MetricCard
                title="Stale Enrichment"
                value={stats.staleEnrichment?.value || 0}
                subtitle=">90 days old"
                trend={stats.staleEnrichment?.trend}
                trendDirection={stats.staleEnrichment?.trendDirection}
                icon="clock"
              />
            </div>

            {/* Data Quality Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Email Validity"
                value={stats.emailValidity?.percent || 0}
                subtitle={`${stats.emailValidity?.valid || 0} valid`}
                trend={stats.emailValidity?.trend}
                trendDirection={stats.emailValidity?.trendDirection}
                icon="envelope"
              />
              <MetricCard
                title="Missing Titles"
                value={stats.missingTitles?.value || 0}
                percent={stats.missingTitles?.percent}
                trend={stats.missingTitles?.trend}
                trendDirection={stats.missingTitles?.trendDirection}
                icon="exclamation"
              />
              <MetricCard
                title="DNC Contacts"
                value={stats.dncContacts?.value || 0}
                percent={stats.dncContacts?.percent}
                trend={stats.dncContacts?.trend}
                trendDirection={stats.dncContacts?.trendDirection}
                icon="ban"
              />
              <MetricCard
                title="Duplicate Records"
                value={stats.duplicateRecords?.value || 0}
                trend={stats.duplicateRecords?.trend}
                trendDirection={stats.duplicateRecords?.trendDirection}
                icon="duplicate"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact & Account Growth */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact & Account Growth</h3>
                {stats.monthlyGrowth && Array.isArray(stats.monthlyGrowth) && stats.monthlyGrowth.length > 0 ? (
                  <div className="h-64">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                      <Line
                      data={{
                        labels: stats.monthlyGrowth.map(item => item.month || ''),
                        datasets: [
                          {
                            label: 'Contacts',
                            data: stats.monthlyGrowth.map(item => item.contacts || 0),
                            borderColor: 'rgb(59, 130, 246)',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            fill: false,
                          },
                          {
                            label: 'Accounts',
                            data: stats.monthlyGrowth.map(item => item.accounts || 0),
                            borderColor: 'rgb(34, 197, 94)',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            tension: 0.4,
                            fill: false,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              precision: 0,
                            },
                          },
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

              {/* Enrichment Status Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Enrichment Status Distribution</h3>
                {stats.enrichmentStatus ? (
                  <div className="h-64">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                      <Doughnut
                      data={{
                        labels: ['Fully Enriched', 'Partially Enriched', 'Not Enriched'],
                        datasets: [
                          {
                            data: [
                              stats.enrichmentStatus.fullyEnriched?.count || 0,
                              stats.enrichmentStatus.partiallyEnriched?.count || 0,
                              stats.enrichmentStatus.notEnriched?.count || 0,
                            ],
                            backgroundColor: [
                              'rgb(34, 197, 94)',
                              'rgb(249, 115, 22)',
                              'rgb(239, 68, 68)',
                            ],
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                          },
                        },
                      }}
                    />
                    </Suspense>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <p className="text-sm">No enrichment data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Outreach Readiness Funnel & Top Segments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Outreach Readiness Funnel */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Outreach Readiness Funnel</h3>
                <div className="space-y-4">
                  {stats.outreachFunnel && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700">Total Contacts</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {stats.outreachFunnel.totalContacts?.toLocaleString() || 0} (100%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gray-400 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700">Has Email</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {stats.outreachFunnel.hasEmail?.toLocaleString() || 0} ({stats.outreachFunnel.totalContacts > 0 ? ((stats.outreachFunnel.hasEmail / stats.outreachFunnel.totalContacts) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.outreachFunnel.totalContacts > 0 ? (stats.outreachFunnel.hasEmail / stats.outreachFunnel.totalContacts * 100) : 0}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700">Valid Email</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {stats.outreachFunnel.validEmail?.toLocaleString() || 0} ({stats.outreachFunnel.totalContacts > 0 ? ((stats.outreachFunnel.validEmail / stats.outreachFunnel.totalContacts) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.outreachFunnel.totalContacts > 0 ? (stats.outreachFunnel.validEmail / stats.outreachFunnel.totalContacts * 100) : 0}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700">Has Title</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {stats.outreachFunnel.hasTitle?.toLocaleString() || 0} ({stats.outreachFunnel.totalContacts > 0 ? ((stats.outreachFunnel.hasTitle / stats.outreachFunnel.totalContacts) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.outreachFunnel.totalContacts > 0 ? (stats.outreachFunnel.hasTitle / stats.outreachFunnel.totalContacts * 100) : 0}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700">Ready for Outreach</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {stats.outreachFunnel.readyForOutreach?.toLocaleString() || 0} ({stats.outreachFunnel.totalContacts > 0 ? ((stats.outreachFunnel.readyForOutreach / stats.outreachFunnel.totalContacts) * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.outreachFunnel.totalContacts > 0 ? (stats.outreachFunnel.readyForOutreach / stats.outreachFunnel.totalContacts * 100) : 0}%` }}></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Top Segments */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Segments</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Industries</h4>
                    <div className="space-y-2">
                      {stats.topIndustries && stats.topIndustries.length > 0 ? (
                        stats.topIndustries.map((industry, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1">
                            <span className="text-sm text-gray-600">{industry.name}</span>
                            <span className="text-sm font-semibold text-gray-900">{industry.count.toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No industry data available</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Top States</h4>
                    <div className="space-y-2">
                      {stats.topStates && stats.topStates.length > 0 ? (
                        stats.topStates.map((state, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1">
                            <span className="text-sm text-gray-600">{state.name}</span>
                            <span className="text-sm font-semibold text-gray-900">{state.count.toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">No geography data available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts & Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AlertCard
                type="success"
                title="Strong Contact Growth"
                description="Your contact database grew significantly this month. Consider allocating more enrichment resources to maintain data quality."
                action={() => navigate('/contacts')}
                actionLabel="View Industry Breakdown"
              />
              <AlertCard
                type="warning"
                title="Email Validity Declining"
                description="Email validity rate dropped this month. Run validation on contacts added in the last 30 days to identify and fix invalid addresses."
                action={() => navigate('/contacts')}
                actionLabel="Review Data Quality"
              />
              <AlertCard
                type="error"
                title="Duplicate Detection Alert"
                description={`${stats.duplicateRecords?.value || 0} duplicate records detected across your database. Use the Data Quality Center to merge or remove duplicates.`}
                action={() => navigate('/contacts')}
                actionLabel="Fix Duplicates"
              />
            </div>

            {/* Data Health Score */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Data Health Score</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">{dataHealthScores.overallScore}</div>
                  <p className="text-sm text-gray-600">Overall Score</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">{dataHealthScores.completeness}</div>
                  <p className="text-sm text-gray-600">Completeness</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">{dataHealthScores.deduplication}</div>
                  <p className="text-sm text-gray-600">Deduplication</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-orange-600 mb-2">{dataHealthScores.freshness}</div>
                  <p className="text-sm text-gray-600">Freshness</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'industry' && (
          <div className="space-y-6">
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Industry Distribution Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Industry Distribution</h3>
                {stats.topIndustries && stats.topIndustries.length > 0 ? (
                  <div className="h-80">
                    <Suspense fallback={<div className="h-80 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                      <Bar
                      data={{
                        labels: stats.topIndustries.map(item => item.name),
                        datasets: [
                          {
                            label: 'Contacts',
                            data: stats.topIndustries.map(item => item.count || 0),
                            backgroundColor: 'rgb(59, 130, 246)',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                        scales: {
                          x: {
                            beginAtZero: true,
                            ticks: {
                              precision: 0,
                            },
                            grid: {
                              color: 'rgba(0, 0, 0, 0.05)',
                              lineWidth: 1,
                            },
                          },
                          y: {
                            ticks: {
                              maxRotation: 45,
                              minRotation: 45,
                            },
                            grid: {
                              display: false,
                            },
                          },
                        },
                      }}
                    />
                    </Suspense>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    <p className="text-sm">No industry data available</p>
                  </div>
                )}
              </div>

              {/* Top 5 Industries by Contact Volume - Pie Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Industries by Contact Volume</h3>
                {pieChartData ? (
                  <div className="h-80">
                    <Suspense fallback={<div className="h-80 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                      <Pie
                        data={{
                          labels: pieChartData.labels,
                          datasets: [
                            {
                              data: pieChartData.data,
                              backgroundColor: pieChartData.colors,
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'right',
                              labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: {
                                  size: 12,
                                },
                                generateLabels: function(chart) {
                                  const data = chart.data;
                                  if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                      const value = data.datasets[0].data[i];
                                      const color = data.datasets[0].backgroundColor[i];
                                      return {
                                        text: label,
                                        fillStyle: color,
                                        hidden: false,
                                        index: i
                                      };
                                    });
                                  }
                                  return [];
                                }
                              }
                            },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  const label = context.label || '';
                                  const value = context.parsed || 0;
                                  return `${label} - ${value.toLocaleString()} contacts`;
                                }
                              }
                            }
                          }
                        }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    <p className="text-sm">No industry data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Industry Insights */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Industry Insights</h3>
              {stats.industryInsights ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Fastest Growing */}
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600 mb-2">Fastest Growing</p>
                    <p className="text-xl font-bold text-gray-900 mb-1">
                      {stats.industryInsights.fastestGrowing?.industry || 'N/A'}
                    </p>
                    <p className="text-sm font-semibold text-green-600">
                      {stats.industryInsights.fastestGrowing 
                        ? `+${stats.industryInsights.fastestGrowing.growth.toFixed(0)}% this quarter`
                        : 'No data'}
                    </p>
                  </div>

                  {/* Highest Enrichment */}
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600 mb-2">Highest Enrichment</p>
                    <p className="text-xl font-bold text-gray-900 mb-1">
                      {stats.industryInsights.highestEnrichment?.industry || 'N/A'}
                    </p>
                    <p className="text-sm font-semibold text-green-600">
                      {stats.industryInsights.highestEnrichment
                        ? `${stats.industryInsights.highestEnrichment.enrichment.toFixed(0)}% enriched`
                        : 'No data'}
                    </p>
                  </div>

                  {/* Needs Attention */}
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600 mb-2">Needs Attention</p>
                    <p className="text-xl font-bold text-gray-900 mb-1">
                      {stats.industryInsights.needsAttention?.industry || 'N/A'}
                    </p>
                    <p className="text-sm font-semibold text-orange-600">
                      {stats.industryInsights.needsAttention
                        ? `${stats.industryInsights.needsAttention.enrichment.toFixed(0)}% enriched`
                        : 'No data'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center">No industry insights available</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'geography' && (
          <div className="space-y-6">
            {/* Geographic Distribution Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
              {stats.topStates && stats.topStates.length > 0 ? (
                <div className="h-96">
                  <Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                    <Bar
                    data={{
                      labels: stats.topStates.map(item => item.name),
                      datasets: [
                        {
                          label: 'Contacts',
                          data: stats.topStates.map(item => item.count || 0),
                          backgroundColor: 'rgb(59, 130, 246)',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: 'y',
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          ticks: {
                            precision: 0,
                            stepSize: 750,
                            font: {
                              size: 11,
                            },
                            color: '#6B7280',
                          },
                          grid: {
                            color: 'rgba(0, 0, 0, 0.08)',
                            lineWidth: 1,
                            borderDash: [5, 5],
                            drawBorder: false,
                          },
                        },
                        y: {
                          ticks: {
                            font: {
                              size: 12,
                            },
                            color: '#374151',
                          },
                          grid: {
                            display: false,
                          },
                        },
                      },
                    }}
                  />
                  </Suspense>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <p className="text-sm">No geographic data available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'data-quality' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Quality Metrics</h3>
              {stats.dataQualityMetrics ? (
                <div className="h-80">
                  <Suspense fallback={<div className="h-80 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-600"></div></div>}>
                    <Bar
                    data={{
                      labels: ['Email Valid', 'Phone Valid', 'Complete Profile', 'LinkedIn Connected', 'Recent Activity'],
                      datasets: [
                        {
                          label: 'Count',
                          data: [
                            stats.dataQualityMetrics.emailValid || 0,
                            stats.dataQualityMetrics.phoneValid || 0,
                            stats.dataQualityMetrics.completeProfile || 0,
                            stats.dataQualityMetrics.linkedinConnected || 0,
                            stats.dataQualityMetrics.recentActivity || 0,
                          ],
                          backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                  </Suspense>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  <p className="text-sm">No data quality metrics available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
