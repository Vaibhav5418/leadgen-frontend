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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Master Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">All Projects Summary & Analytics</p>
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Section Navigation */}
        <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-2.5">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeSection === section.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-102'
                }`}
              >
                <span className="mr-2 text-base">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Executive Summary */}
        {activeSection === 'executive' && (
          <div className="space-y-4">
            {/* Executive Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Active Projects</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{executive?.activeProjects || 0}</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Total Leads in Play</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{(executive?.totalLeadsInPlay || 0).toLocaleString()}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Touches This Week</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{(executive?.totalTouchesThisWeek || 0).toLocaleString()}</p>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Meetings This Week</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">{executive?.totalMeetingsBookedThisWeek || 0}</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Touches This Month</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">{(executive?.totalTouchesThisMonth || 0).toLocaleString()}</p>
              </div>

              <div className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Meetings This Month</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">{executive?.totalMeetingsBookedThisMonth || 0}</p>
              </div>

              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Weighted Conversion Rate</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">{clampPercentage(executive?.weightedConversionRate || 0).toFixed(1)}%</p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">SLA Compliance</h3>
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">{clampPercentage(executive?.slaCompliance || 0).toFixed(1)}%</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Week vs Month Comparison */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📊</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Week vs Month Performance</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📈</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Activity by Channel</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🎯</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Overall Sales Funnel</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">✅</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Key Performance Metrics</h3>
                </div>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Best Performing Projects */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🏆</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Best Performing Projects</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📊</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Channel Efficiency Leaderboard</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200 lg:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">👥</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Team Leaderboard</h3>
                </div>
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
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Low Activity (Last 3 Days)</h3>
                </div>
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
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Missing Follow-ups</h3>
                </div>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Leads Added (Daily)</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{dataQuality?.leadsAddedDaily || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Leads Added (Weekly)</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{dataQuality?.leadsAddedWeekly || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Valid Email %</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{clampPercentage(dataQuality?.validEmailPercent || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(dataQuality?.validEmailCount || 0).toLocaleString()} of {(dataQuality?.totalProspects || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Valid Phone %</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">{clampPercentage(dataQuality?.validPhonePercent || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(dataQuality?.validPhoneCount || 0).toLocaleString()} of {(dataQuality?.totalProspects || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Duplicate %</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">{clampPercentage(dataQuality?.duplicatePercent || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(dataQuality?.duplicateCount || 0).toLocaleString()} duplicates</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Data Quality Score</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">{clampPercentage(dataQuality?.dataQualityScore || 0).toFixed(1)}%</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📈</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Data Quality Overview</h3>
              </div>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Connection Requests Sent</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{(linkedin?.connectionRequestsSent || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Acceptance Rate</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{clampPercentage(linkedin?.acceptanceRate || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(linkedin?.accepted || 0).toLocaleString()} accepted</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Messages Sent</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{(linkedin?.messagesSent || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Reply Rate</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">{clampPercentage(linkedin?.replyRate || 0).toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-2 font-medium">{(linkedin?.replies || 0).toLocaleString()} replies</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Meetings Booked</h3>
                <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">{linkedin?.meetingsBooked || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LinkedIn Funnel Chart */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📊</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">LinkedIn Funnel Overview</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📈</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Connection Acceptance Rate</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📞</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Cold Call Funnel Overview</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📈</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Call Connection Rate</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📧</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Email Funnel Overview</h3>
                </div>
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
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📊</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Email Status Breakdown</h3>
                </div>
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
