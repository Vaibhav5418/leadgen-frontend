import { useState, useEffect, lazy, Suspense } from 'react';
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

export default function MasterDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('executive');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await API.get('/master-dashboard');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching master dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load dashboard data</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Safe destructuring with defaults
  const executive = data?.executive || {};
  const rankings = data?.rankings || {
    bestPerformingProjects: [],
    worstDataQualityProjects: [],
    channelEfficiency: {
      linkedin: { acceptanceRate: 0, total: 0, accepted: 0 },
      call: { connectRate: 0, total: 0, connected: 0 },
      email: { replyRate: 0, total: 0, replied: 0 }
    },
    teamLeaderboard: []
  };
  const alerts = data?.alerts || {
    lowActivityProjects: [],
    highBounceProjects: [],
    missingFollowUps: []
  };
  const dataQuality = data?.dataQuality || {
    leadsAddedDaily: 0,
    leadsAddedWeekly: 0,
    validEmailPercent: 0,
    validPhonePercent: 0,
    duplicatePercent: 0,
    dataQualityScore: 0,
    totalProspects: 0,
    validEmailCount: 0,
    validPhoneCount: 0,
    duplicateCount: 0
  };
  const linkedin = data?.linkedin || {
    connectionRequestsSent: 0,
    acceptanceRate: 0,
    accepted: 0,
    messagesSent: 0,
    replies: 0,
    replyRate: 0,
    meetingsBooked: 0
  };
  const coldCall = data?.coldCall || {
    callsMade: 0,
    connectRate: 0,
    connected: 0,
    decisionMakerConnects: 0,
    interested: 0,
    meetingsBooked: 0
  };
  const email = data?.email || {
    emailsSent: 0,
    bounceRate: 0,
    bounced: 0,
    replyRate: 0,
    replied: 0,
    positiveReplies: 0,
    meetingsBooked: 0
  };
  const followUp = data?.followUp || {
    totalDue: 0,
    completed: 0,
    overdueCount: 0,
    completionRate: 0,
    slaCompliance: 0
  };

  // Helper function to clamp values between 0-100 and handle NaN/Infinity
  const clampPercentage = (value) => {
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check for invalid values
    if (typeof numValue !== 'number' || isNaN(numValue) || !isFinite(numValue) || numValue < 0) {
      return 0;
    }
    
    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, numValue));
  };

  // Helper to ensure all chart data values are finite
  const sanitizeChartData = (dataArray) => {
    return dataArray.map(val => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
        return 0;
      }
      return num;
    });
  };

  // Chart data with safe access and validation - ensure all values are finite
  const channelEfficiencyValues = [
    rankings?.channelEfficiency?.linkedin?.acceptanceRate,
    rankings?.channelEfficiency?.call?.connectRate,
    rankings?.channelEfficiency?.email?.replyRate
  ].map(val => clampPercentage(val || 0));

  const channelEfficiencyData = {
    labels: ['LinkedIn', 'Call', 'Email'],
    datasets: [{
      label: 'Efficiency Rate (%)',
      data: sanitizeChartData(channelEfficiencyValues),
      backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
      borderColor: ['#2563EB', '#059669', '#D97706'],
      borderWidth: 2
    }]
  };

  const teamPerformanceData = {
    labels: (rankings?.teamLeaderboard || []).slice(0, 10).map(m => m?.name || 'Unknown'),
    datasets: [{
      label: 'Total Activities',
      data: (rankings?.teamLeaderboard || []).slice(0, 10).map(m => {
        const value = m?.totalActivities || 0;
        return typeof value === 'number' && isFinite(value) ? value : 0;
      }),
      backgroundColor: '#3B82F6',
      borderColor: '#2563EB',
      borderWidth: 1
    }]
  };

  // Ensure data quality values are finite and valid
  const dataQualityValues = [
    dataQuality?.validEmailPercent || 0,
    dataQuality?.validPhonePercent || 0,
    dataQuality?.duplicatePercent || 0
  ].map(val => clampPercentage(val));

  const dataQualityData = {
    labels: ['Valid Email', 'Valid Phone', 'Duplicates'],
    datasets: [{
      data: sanitizeChartData(dataQualityValues),
      backgroundColor: ['#10B981', '#3B82F6', '#EF4444'],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 4
    }]
  };

  // LinkedIn chart data
  const linkedinFunnelData = {
    labels: ['Requests Sent', 'Accepted', 'Messages Sent', 'Replies', 'Meetings'],
    datasets: [{
      label: 'LinkedIn Funnel',
      data: [
        linkedin?.connectionRequestsSent || 0,
        linkedin?.accepted || 0,
        linkedin?.messagesSent || 0,
        linkedin?.replies || 0,
        linkedin?.meetingsBooked || 0
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#0077B5', '#00A0DC', '#008CC9', '#006699', '#004D73'],
      borderColor: ['#005885', '#0077B5', '#006699', '#004D73', '#003D5C'],
      borderWidth: 2
    }]
  };

  const linkedinAcceptanceData = {
    labels: ['Accepted', 'Not Accepted'],
    datasets: [{
      label: 'Connection Requests',
      data: [
        linkedin?.accepted || 0,
        Math.max(0, (linkedin?.connectionRequestsSent || 0) - (linkedin?.accepted || 0))
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#10B981', '#EF4444'],
      borderWidth: 2
    }]
  };

  // Cold Call chart data
  const coldCallFunnelData = {
    labels: ['Calls Made', 'Connected', 'Decision Maker', 'Interested', 'Meetings'],
    datasets: [{
      label: 'Cold Call Funnel',
      data: [
        coldCall?.callsMade || 0,
        coldCall?.connected || 0,
        coldCall?.decisionMakerConnects || 0,
        coldCall?.interested || 0,
        coldCall?.meetingsBooked || 0
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A'],
      borderColor: ['#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A', '#1E3A8A'],
      borderWidth: 2
    }]
  };

  const coldCallConnectData = {
    labels: ['Connected', 'Not Connected'],
    datasets: [{
      label: 'Call Connections',
      data: [
        coldCall?.connected || 0,
        Math.max(0, (coldCall?.callsMade || 0) - (coldCall?.connected || 0))
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#10B981', '#EF4444'],
      borderWidth: 2
    }]
  };

  // Email chart data
  const emailFunnelData = {
    labels: ['Emails Sent', 'Replied', 'Positive Replies', 'Meetings'],
    datasets: [{
      label: 'Email Funnel',
      data: [
        email?.emailsSent || 0,
        email?.replied || 0,
        email?.positiveReplies || 0,
        email?.meetingsBooked || 0
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6'],
      borderColor: ['#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'],
      borderWidth: 2
    }]
  };

  const emailStatusData = {
    labels: ['Replied', 'Bounced', 'No Reply'],
    datasets: [{
      label: 'Email Status',
      data: [
        email?.replied || 0,
        email?.bounced || 0,
        Math.max(0, (email?.emailsSent || 0) - (email?.replied || 0) - (email?.bounced || 0))
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#10B981', '#EF4444', '#9CA3AF'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  // Executive Summary chart data
  const weeklyMonthlyComparisonData = {
    labels: ['Touches', 'Meetings'],
    datasets: [
      {
        label: 'This Week',
        data: [
          executive?.totalTouchesThisWeek || 0,
          executive?.totalMeetingsBookedThisWeek || 0
        ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
        backgroundColor: '#3B82F6',
        borderColor: '#2563EB',
        borderWidth: 2
      },
      {
        label: 'This Month',
        data: [
          executive?.totalTouchesThisMonth || 0,
          executive?.totalMeetingsBookedThisMonth || 0
        ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
        backgroundColor: '#10B981',
        borderColor: '#059669',
        borderWidth: 2
      }
    ]
  };

  const channelDistributionData = {
    labels: ['LinkedIn', 'Cold Call', 'Email'],
    datasets: [{
      label: 'Activities by Channel',
      data: [
        linkedin?.connectionRequestsSent || 0,
        coldCall?.callsMade || 0,
        email?.emailsSent || 0
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#0077B5', '#3B82F6', '#8B5CF6'],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 4
    }]
  };

  const conversionSlaData = {
    labels: ['Conversion Rate', 'SLA Compliance'],
    datasets: [{
      label: 'Performance Metrics (%)',
      data: [
        clampPercentage(executive?.weightedConversionRate || 0),
        clampPercentage(executive?.slaCompliance || 0)
      ],
      backgroundColor: ['#10B981', '#3B82F6'],
      borderColor: ['#059669', '#2563EB'],
      borderWidth: 2
    }]
  };

  const overallFunnelData = {
    labels: ['Leads in Play', 'Total Touches', 'Meetings Booked'],
    datasets: [{
      label: 'Overall Funnel',
      data: [
        executive?.totalLeadsInPlay || 0,
        executive?.totalTouchesThisMonth || 0,
        executive?.totalMeetingsBookedThisMonth || 0
      ].map(val => typeof val === 'number' && isFinite(val) ? val : 0),
      backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981'],
      borderColor: ['#2563EB', '#7C3AED', '#059669'],
      borderWidth: 2
    }]
  };

  const sections = [
    { id: 'executive', label: 'Executive Summary', icon: '📊' },
    { id: 'rankings', label: 'Rankings', icon: '🏆' },
    { id: 'alerts', label: 'Alerts', icon: '⚠️' },
    { id: 'data', label: 'Data Quality', icon: '📈' },
    { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { id: 'calls', label: 'Cold Calls', icon: '📞' },
    { id: 'email', label: 'Email', icon: '✉️' },
    { id: 'followup', label: 'Follow-ups', icon: '🔄' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                title="Go Back"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Master Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">All Projects Summary & Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* Section Navigation */}
          <div className="flex items-center gap-6 overflow-x-auto pb-2 border-b border-gray-200">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === section.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="text-base">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-0">
        {/* Executive Summary */}
        {activeSection === 'executive' && (
          <div className="space-y-6">
            {/* Executive Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Projects */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full shadow-xs">
                    Projects
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{executive?.activeProjects || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Active Projects</div>
              </div>

              {/* Total Leads in Play */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full shadow-xs">
                    Leads
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{(executive?.totalLeadsInPlay || 0).toLocaleString()}</div>
                <div className="text-sm text-gray-600 mt-1">Total Leads in Play</div>
              </div>

              {/* Touches This Week */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-green-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-green-700 bg-white/70 border border-green-100 px-2 py-1 rounded-full shadow-xs">
                    Activity
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{(executive?.totalTouchesThisWeek || 0).toLocaleString()}</div>
                <div className="text-sm text-gray-600 mt-1">Touches This Week</div>
              </div>

              {/* Meetings This Week */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full shadow-xs">
                    Meetings
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{executive?.totalMeetingsBookedThisWeek || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Meetings This Week</div>
              </div>

              {/* Touches This Month */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-indigo-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700 bg-white/70 border border-indigo-100 px-2 py-1 rounded-full shadow-xs">
                    Activity
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{(executive?.totalTouchesThisMonth || 0).toLocaleString()}</div>
                <div className="text-sm text-gray-600 mt-1">Touches This Month</div>
              </div>

              {/* Meetings This Month */}
              <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border border-rose-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-rose-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-rose-700 bg-white/70 border border-rose-100 px-2 py-1 rounded-full shadow-xs">
                    Meetings
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{executive?.totalMeetingsBookedThisMonth || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Meetings This Month</div>
              </div>

              {/* Weighted Conversion Rate */}
              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border border-teal-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-teal-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 bg-white/70 border border-teal-100 px-2 py-1 rounded-full shadow-xs">
                    Conversion
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(executive?.weightedConversionRate || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">Weighted Conversion Rate</div>
              </div>

              {/* SLA Compliance */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-orange-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-orange-700 bg-white/70 border border-orange-100 px-2 py-1 rounded-full shadow-xs">
                    Compliance
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(executive?.slaCompliance || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">SLA Compliance</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Week vs Month Comparison */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Week vs Month Performance</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={weeklyMonthlyComparisonData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { 
                            position: 'top',
                            labels: {
                              padding: 15,
                              font: {
                                size: 12,
                                weight: '500'
                              },
                              usePointStyle: true
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = typeof context.parsed.y === 'number' && isFinite(context.parsed.y) 
                                  ? context.parsed.y 
                                  : 0;
                                return `${context.dataset.label}: ${value.toLocaleString()}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: (value) => {
                                const numValue = typeof value === 'number' ? value : parseFloat(value);
                                return typeof numValue === 'number' && isFinite(numValue) ? Math.round(numValue) : 0;
                              },
                              stepSize: 1
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>

              {/* Channel Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Activity by Channel</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64 flex items-center justify-center">
                    <Doughnut
                      data={channelDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 1.5,
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
                                const total = (linkedin?.connectionRequestsSent || 0) + (coldCall?.callsMade || 0) + (email?.emailsSent || 0);
                                const percentage = total > 0 ? ((value / total) * 100) : 0;
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

              {/* Overall Funnel */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Overall Sales Funnel</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={overallFunnelData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = typeof context.parsed.y === 'number' && isFinite(context.parsed.y) 
                                  ? context.parsed.y 
                                  : 0;
                                return `${context.label}: ${value.toLocaleString()}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: (value) => {
                                const numValue = typeof value === 'number' ? value : parseFloat(value);
                                return typeof numValue === 'number' && isFinite(numValue) ? Math.round(numValue) : 0;
                              },
                              stepSize: 1
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            },
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

              {/* Conversion & SLA Metrics */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Key Performance Metrics</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={conversionSlaData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = clampPercentage(context.parsed.y);
                                return `${context.label}: ${value.toFixed(2)}%`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            min: 0,
                            ticks: {
                              callback: (value) => {
                                const clamped = clampPercentage(value);
                                return `${clamped}%`;
                              },
                              stepSize: 20,
                              maxTicksLimit: 6
                            },
                            afterDataLimits: (scale) => {
                              scale.max = 100;
                              scale.min = 0;
                            }
                          },
                          x: {
                            grid: {
                              display: false
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
        )}

        {/* Rankings */}
        {activeSection === 'rankings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Best Performing Projects */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Best Performing Projects</h3>
                <div className="space-y-3">
                  {(rankings?.bestPerformingProjects || []).slice(0, 10).map((project, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{project.projectName}</p>
                          <p className="text-xs text-gray-500">{project.totalProspects} prospects</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{project.meetingsPer100Leads.toFixed(1)}</p>
                        <p className="text-xs text-gray-500">meetings/100 leads</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Channel Efficiency */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Channel Efficiency Leaderboard</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={channelEfficiencyData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = clampPercentage(context.parsed.y);
                                return `Efficiency: ${value.toFixed(2)}%`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            min: 0,
                            grace: 0,
                            ticks: {
                              callback: (value) => {
                                const clamped = clampPercentage(value);
                                return `${clamped}%`;
                              },
                              stepSize: 20,
                              maxTicksLimit: 6,
                              precision: 0
                            },
                            afterDataLimits: (scale) => {
                              scale.max = 100;
                              scale.min = 0;
                            },
                            afterBuildTicks: (scale) => {
                              scale.ticks = scale.ticks.filter(tick => {
                                const val = typeof tick.value === 'number' ? tick.value : parseFloat(tick.value);
                                return isFinite(val) && val >= 0 && val <= 100;
                              });
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-gray-700">LinkedIn Acceptance</span>
                    <span className="font-bold text-lg text-blue-700">{clampPercentage(rankings?.channelEfficiency?.linkedin?.acceptanceRate || 0).toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                    <span className="text-sm font-medium text-gray-700">Call Connect Rate</span>
                    <span className="font-bold text-lg text-green-700">{clampPercentage(rankings?.channelEfficiency?.call?.connectRate || 0).toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                    <span className="text-sm font-medium text-gray-700">Email Reply Rate</span>
                    <span className="font-bold text-lg text-amber-700">{clampPercentage(rankings?.channelEfficiency?.email?.replyRate || 0).toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {/* Team Leaderboard */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Team Leaderboard</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={teamPerformanceData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2.5,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = typeof context.parsed.y === 'number' && isFinite(context.parsed.y) 
                                  ? context.parsed.y 
                                  : 0;
                                return `Activities: ${value}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: (value) => {
                                const numValue = typeof value === 'number' ? value : parseFloat(value);
                                return typeof numValue === 'number' && isFinite(numValue) ? Math.round(numValue) : 0;
                              },
                              stepSize: 1
                            },
                            afterBuildTicks: (scale) => {
                              scale.ticks = scale.ticks.filter(tick => {
                                const val = typeof tick.value === 'number' ? tick.value : parseFloat(tick.value);
                                return isFinite(val) && val >= 0;
                              });
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            },
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
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {(rankings?.teamLeaderboard || []).slice(0, 10).map((member, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900 text-sm">{member.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 mt-1">{member.totalActivities} activities</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="text-blue-600">{member.calls} calls</span>
                        <span className="text-green-600">{member.emails} emails</span>
                        <span className="text-purple-600">{member.linkedin} LI</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {activeSection === 'alerts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Low Activity Projects */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Activity (Last 3 Days)</h3>
                <div className="space-y-2">
                  {(alerts?.lowActivityProjects || []).length > 0 ? (
                    (alerts?.lowActivityProjects || []).map((project, index) => (
                      <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="font-medium text-gray-900">{project.projectName}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {project.activityCount} activities / {project.totalContacts} contacts
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No low activity projects</p>
                  )}
                </div>
              </div>

              {/* High Bounce Projects */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">High Bounce/Wrong Data</h3>
                </div>
                <div className="space-y-2">
                  {(alerts?.highBounceProjects || []).length > 0 ? (
                    (alerts?.highBounceProjects || []).map((project, index) => (
                      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="font-medium text-gray-900">{project.projectName}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {project.errorRate.toFixed(1)}% error rate ({project.bounceCount} bounces, {project.wrongPersonCount} wrong)
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No high bounce projects</p>
                  )}
                </div>
              </div>

              {/* Missing Follow-ups */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Missing Follow-ups</h3>
                <div className="space-y-2">
                  {(alerts?.missingFollowUps || []).length > 0 ? (
                    (alerts?.missingFollowUps || []).map((project, index) => (
                      <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="font-medium text-gray-900">{project.projectName}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {project.overdueCount} overdue follow-ups
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No missing follow-ups</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Quality */}
        {activeSection === 'data' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Leads Added Daily */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full shadow-xs">
                    Daily
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{dataQuality?.leadsAddedDaily || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Leads Added (Daily)</div>
              </div>

              {/* Leads Added Weekly */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full shadow-xs">
                    Weekly
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{dataQuality?.leadsAddedWeekly || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Leads Added (Weekly)</div>
              </div>

              {/* Valid Email % */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full shadow-xs">
                    Quality
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(dataQuality?.validEmailPercent || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">{(dataQuality?.validEmailCount || 0).toLocaleString()} of {(dataQuality?.totalProspects || 0).toLocaleString()}</div>
              </div>

              {/* Valid Phone % */}
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-cyan-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-cyan-700 bg-white/70 border border-cyan-100 px-2 py-1 rounded-full shadow-xs">
                    Quality
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(dataQuality?.validPhonePercent || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">{(dataQuality?.validPhoneCount || 0).toLocaleString()} of {(dataQuality?.totalProspects || 0).toLocaleString()}</div>
              </div>

              {/* Duplicate % */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-red-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-red-700 bg-white/70 border border-red-100 px-2 py-1 rounded-full shadow-xs">
                    Duplicates
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(dataQuality?.duplicatePercent || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">{(dataQuality?.duplicateCount || 0).toLocaleString()} duplicates</div>
              </div>

              {/* Data Quality Score */}
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-amber-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 bg-white/70 border border-amber-100 px-2 py-1 rounded-full shadow-xs">
                    Score
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(dataQuality?.dataQualityScore || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">Data Quality Score</div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Data Quality Overview</h3>
              <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                <div className="h-80 flex items-center justify-center">
                  <Doughnut
                    data={dataQualityData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      aspectRatio: 1.5,
                      cutout: '60%',
                      layout: {
                        padding: {
                          top: 20,
                          bottom: 20
                        }
                      },
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
                              const value = clampPercentage(context.parsed || 0);
                              const total = dataQualityValues.reduce((sum, val) => sum + clampPercentage(val), 0);
                              const percentage = total > 0 ? ((clampPercentage(context.parsed || 0) / total) * 100) : 0;
                              return `${label}: ${value.toFixed(2)}% (${percentage.toFixed(1)}% of total)`;
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
        )}

        {/* LinkedIn */}
        {activeSection === 'linkedin' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Connection Requests Sent */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full shadow-xs">
                    LinkedIn
                  </span>
                </div>
                <div className="text-3xl font-bold text-gray-900 leading-tight">{(linkedin?.connectionRequestsSent || 0).toLocaleString()}</div>
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
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(linkedin?.acceptanceRate || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">{(linkedin?.accepted || 0).toLocaleString()} accepted</div>
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
                <div className="text-3xl font-bold text-gray-900 leading-tight">{(linkedin?.messagesSent || 0).toLocaleString()}</div>
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
                <div className="text-3xl font-bold text-gray-900 leading-tight">{clampPercentage(linkedin?.replyRate || 0).toFixed(1)}%</div>
                <div className="text-sm text-gray-600 mt-1">{(linkedin?.replies || 0).toLocaleString()} replies</div>
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
                <div className="text-3xl font-bold text-gray-900 leading-tight">{linkedin?.meetingsBooked || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Meetings Booked</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LinkedIn Funnel Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">LinkedIn Funnel Overview</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={linkedinFunnelData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = typeof context.parsed.y === 'number' && isFinite(context.parsed.y) 
                                  ? context.parsed.y 
                                  : 0;
                                return `${context.label}: ${value.toLocaleString()}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: (value) => {
                                const numValue = typeof value === 'number' ? value : parseFloat(value);
                                return typeof numValue === 'number' && isFinite(numValue) ? Math.round(numValue) : 0;
                              },
                              stepSize: 1
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            },
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

              {/* LinkedIn Acceptance Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Connection Acceptance Rate</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64 flex items-center justify-center">
                    <Doughnut
                      data={linkedinAcceptanceData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 1.5,
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
                              usePointStyle: true
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = (linkedin?.connectionRequestsSent || 0);
                                const percentage = total > 0 ? ((value / total) * 100) : 0;
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
        )}

        {/* Cold Calls */}
        {activeSection === 'calls' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Calls Made</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{(coldCall?.callsMade || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Connect Rate</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{clampPercentage(coldCall?.connectRate || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(coldCall?.connected || 0).toLocaleString()} connected</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Decision Maker Connects</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{(coldCall?.decisionMakerConnects || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Interested</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">{(coldCall?.interested || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Meetings Booked</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">{coldCall?.meetingsBooked || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Cold Call Funnel Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Cold Call Funnel Overview</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={coldCallFunnelData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = typeof context.parsed.y === 'number' && isFinite(context.parsed.y) 
                                  ? context.parsed.y 
                                  : 0;
                                return `${context.label}: ${value.toLocaleString()}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: (value) => {
                                const numValue = typeof value === 'number' ? value : parseFloat(value);
                                return typeof numValue === 'number' && isFinite(numValue) ? Math.round(numValue) : 0;
                              },
                              stepSize: 1
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            },
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

              {/* Cold Call Connect Rate Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Call Connection Rate</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64 flex items-center justify-center">
                    <Doughnut
                      data={coldCallConnectData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 1.5,
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
                              usePointStyle: true
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = (coldCall?.callsMade || 0);
                                const percentage = total > 0 ? ((value / total) * 100) : 0;
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
        )}

        {/* Email */}
        {activeSection === 'email' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Emails Sent</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{(email?.emailsSent || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Bounce Rate</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">{clampPercentage(email?.bounceRate || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(email?.bounced || 0).toLocaleString()} bounced</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Reply Rate</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{clampPercentage(email?.replyRate || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(email?.replied || 0).toLocaleString()} replied</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Positive Replies</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{(email?.positiveReplies || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Meetings Booked</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">{email?.meetingsBooked || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Email Funnel Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Email Funnel Overview</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={emailFunnelData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
                        layout: {
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const value = typeof context.parsed.y === 'number' && isFinite(context.parsed.y) 
                                  ? context.parsed.y 
                                  : 0;
                                return `${context.label}: ${value.toLocaleString()}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: (value) => {
                                const numValue = typeof value === 'number' ? value : parseFloat(value);
                                return typeof numValue === 'number' && isFinite(numValue) ? Math.round(numValue) : 0;
                              },
                              stepSize: 1
                            }
                          },
                          x: {
                            grid: {
                              display: false
                            },
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

              {/* Email Status Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Email Status Breakdown</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64 flex items-center justify-center">
                    <Doughnut
                      data={emailStatusData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 1.5,
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
                              usePointStyle: true
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = (email?.emailsSent || 0);
                                const percentage = total > 0 ? ((value / total) * 100) : 0;
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
        )}

        {/* Follow-ups */}
        {activeSection === 'followup' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Total Due</h3>
                <p className="text-3xl font-bold text-gray-900">{(followUp?.totalDue || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Completed</h3>
                <p className="text-3xl font-bold text-gray-900">{(followUp?.completed || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Overdue Count</h3>
                <p className="text-3xl font-bold text-gray-900">{(followUp?.overdueCount || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Completion Rate</h3>
                <p className="text-3xl font-bold text-gray-900">{(followUp?.completionRate || 0).toFixed(2)}%</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">SLA Compliance</h3>
                <p className="text-3xl font-bold text-gray-900">{(followUp?.slaCompliance || 0).toFixed(2)}%</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
