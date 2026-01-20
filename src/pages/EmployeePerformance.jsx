import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
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
  Filler,
} from 'chart.js';

// Lazy load chart components
const Bar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
const Line = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));
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
  Legend,
  Filler
);

// Simple in-memory cache for employee performance (per browser tab)
// Cached by timeFilter so switching away and back is instant for the same period.
const employeePerformanceCache = {};
const EMP_PERF_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export default function EmployeePerformance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [timeFilter, setTimeFilter] = useState('last7days');

  useEffect(() => {
    const load = async () => {
      const key = timeFilter || 'all';
      const entry = employeePerformanceCache[key];
      if (entry && (Date.now() - entry.timestamp) < EMP_PERF_CACHE_TTL_MS) {
        const perfData = entry.data;
        setData(perfData);
        if (perfData.employees.length > 0 && !selectedEmployee) {
          setSelectedEmployee(perfData.employees[0].userId);
        }
        setLoading(false);
      } else {
        await fetchEmployeePerformance();
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter]);

  const fetchEmployeePerformance = async () => {
    try {
      setLoading(true);
      const response = await API.get('/projects/employee-performance', {
        params: { timeFilter }
      });
      if (response.data.success) {
        const perfData = response.data.data;
        setData(perfData);
        employeePerformanceCache[timeFilter || 'all'] = {
          data: perfData,
          timestamp: Date.now(),
        };
        if (perfData.employees.length > 0 && !selectedEmployee) {
          setSelectedEmployee(perfData.employees[0].userId);
        }
      }
    } catch (error) {
      console.error('Error fetching employee performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentEmployee = useMemo(() => {
    if (!data || !selectedEmployee) return null;
    return data.employees.find(emp => emp.userId === selectedEmployee) || data.employees[0];
  }, [data, selectedEmployee]);

  // Chart data preparation
  const overviewChartData = useMemo(() => {
    if (!data) return null;

    return {
      channelDistribution: {
        labels: ['Email', 'Call', 'LinkedIn'],
        datasets: [{
          label: 'Activities by Channel',
          data: [
            data.summary.byChannel.email,
            data.summary.byChannel.call,
            data.summary.byChannel.linkedin
          ],
          backgroundColor: ['#3B82F6', '#10B981', '#8B5CF6'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      employeeComparison: {
        labels: data.employees.map(emp => emp.name),
        datasets: [
          {
            label: 'Email',
            data: data.employees.map(emp => emp.byChannel.email.total),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#3B82F6',
            borderWidth: 1
          },
          {
            label: 'Call',
            data: data.employees.map(emp => emp.byChannel.call.total),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: '#10B981',
            borderWidth: 1
          },
          {
            label: 'LinkedIn',
            data: data.employees.map(emp => emp.byChannel.linkedin.total),
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
            borderColor: '#8B5CF6',
            borderWidth: 1
          }
        ]
      },
      topPerformers: data.employees
        .sort((a, b) => b.totalActivities - a.totalActivities)
        .slice(0, 5)
    };
  }, [data]);

  const employeeChartData = useMemo(() => {
    if (!currentEmployee) return null;

    const emailStatusKeys = Object.keys(currentEmployee.byChannel.email.byStatus || {});
    const callStatusKeys = Object.keys(currentEmployee.byChannel.call.byStatus || {});
    const linkedinStatusKeys = Object.keys(currentEmployee.byChannel.linkedin.byStatus || {});

    return {
      channelDistribution: {
        labels: ['Email', 'Call', 'LinkedIn'],
        datasets: [{
          label: 'Activities',
          data: [
            currentEmployee.byChannel.email.total,
            currentEmployee.byChannel.call.total,
            currentEmployee.byChannel.linkedin.total
          ],
          backgroundColor: ['#3B82F6', '#10B981', '#8B5CF6'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      emailStatus: {
        labels: emailStatusKeys.length > 0 ? emailStatusKeys : ['No Status'],
        datasets: [{
          label: 'Email Status',
          data: emailStatusKeys.length > 0 
            ? emailStatusKeys.map(key => currentEmployee.byChannel.email.byStatus[key])
            : [0],
          backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE', '#EFF6FF'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      callStatus: {
        labels: callStatusKeys.length > 0 ? callStatusKeys : ['No Status'],
        datasets: [{
          label: 'Call Status',
          data: callStatusKeys.length > 0
            ? callStatusKeys.map(key => currentEmployee.byChannel.call.byStatus[key])
            : [0],
          backgroundColor: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      linkedinStatus: {
        labels: linkedinStatusKeys.length > 0 ? linkedinStatusKeys : ['No Status'],
        datasets: [{
          label: 'LinkedIn Status',
          data: linkedinStatusKeys.length > 0
            ? linkedinStatusKeys.map(key => currentEmployee.byChannel.linkedin.byStatus[key])
            : [0],
          backgroundColor: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      projectPerformance: {
        labels: currentEmployee.byProject.map(p => p.projectName),
        datasets: [
          {
            label: 'Email',
            data: currentEmployee.byProject.map(p => p.email),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#3B82F6',
            borderWidth: 1
          },
          {
            label: 'Call',
            data: currentEmployee.byProject.map(p => p.call),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: '#10B981',
            borderWidth: 1
          },
          {
            label: 'LinkedIn',
            data: currentEmployee.byProject.map(p => p.linkedin),
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
            borderColor: '#8B5CF6',
            borderWidth: 1
          }
        ]
      }
    };
  }, [currentEmployee]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.employees || data.employees.length === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Employee Data Available</h3>
            <p className="text-gray-600">There are no employees with performance data for the selected time period.</p>
          </div>
        </div>
      </div>
    );
  }

  const timeFilterLabels = {
    today: 'Today',
    last7days: 'Last 7 Days',
    lastMonth: 'Last Month'
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Performance</h1>
              <p className="text-gray-600 text-sm">Comprehensive analytics and insights for team performance tracking</p>
            </div>
            {/* Time Filter */}
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
              {['today', 'last7days', 'lastMonth'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    timeFilter === filter
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {timeFilterLabels[filter]}
                </button>
              ))}
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">Total Employees</span>
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{data.summary.totalEmployees}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">Total Activities</span>
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{data.summary.totalActivities.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">Total Projects</span>
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{data.summary.totalProjects}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-amber-700">Avg per Employee</span>
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {data.summary.totalEmployees > 0
                  ? Math.round(data.summary.totalActivities / data.summary.totalEmployees)
                  : 0}
              </div>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveSection('overview')}
                className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  activeSection === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveSection('employee')}
                className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  activeSection === 'employee'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Employee Details
              </button>
            </nav>
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && overviewChartData && (
          <div className="space-y-6">
            {/* Channel Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Email Activities</h3>
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-2">{data.summary.byChannel.email.toLocaleString()}</div>
                <div className="text-xs text-gray-500">
                  {((data.summary.byChannel.email / data.summary.totalActivities) * 100).toFixed(1)}% of total
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Call Activities</h3>
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-600 mb-2">{data.summary.byChannel.call.toLocaleString()}</div>
                <div className="text-xs text-gray-500">
                  {((data.summary.byChannel.call / data.summary.totalActivities) * 100).toFixed(1)}% of total
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">LinkedIn Activities</h3>
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-purple-600 mb-2">{data.summary.byChannel.linkedin.toLocaleString()}</div>
                <div className="text-xs text-gray-500">
                  {((data.summary.byChannel.linkedin / data.summary.totalActivities) * 100).toFixed(1)}% of total
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Channel Distribution */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Channel Distribution</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Doughnut
                      data={overviewChartData.channelDistribution}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 15,
                              font: {
                                size: 12,
                                weight: '500'
                              }
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14 },
                            bodyFont: { size: 13 }
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>

              {/* Employee Comparison */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Employee Activity Comparison</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={overviewChartData.employeeComparison}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                            labels: {
                              padding: 10,
                              font: {
                                size: 12,
                                weight: '500'
                              }
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              font: { size: 11 }
                            },
                            grid: {
                              color: 'rgba(0, 0, 0, 0.05)'
                            }
                          },
                          x: {
                            ticks: {
                              font: { size: 11 }
                            },
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

            {/* Top Performers Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Top Performers</h3>
                <p className="text-sm text-gray-600 mt-1">Ranked by total activities</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Activities</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Call</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">LinkedIn</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Projects</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {overviewChartData.topPerformers.map((emp, index) => (
                      <tr key={emp.userId} className={index < 3 ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : 'hover:bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {index < 3 ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-sm">
                                {index + 1}
                              </span>
                            ) : (
                              <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{emp.name}</div>
                            <div className="text-sm text-gray-500">{emp.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900">{emp.totalActivities.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-blue-600">{emp.byChannel.email.total.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-green-600">{emp.byChannel.call.total.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-purple-600">{emp.byChannel.linkedin.total.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{emp.projects.length}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Employee Section */}
        {activeSection === 'employee' && currentEmployee && employeeChartData && (
          <div className="space-y-6">
            {/* Employee Selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Select Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full md:w-80 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
              >
                {data.employees.map(emp => (
                  <option key={emp.userId} value={emp.userId}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-blue-700 mb-2">Total Activities</div>
                <div className="text-3xl font-bold text-gray-900">{currentEmployee.totalActivities.toLocaleString()}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-blue-700 mb-2">Email Activities</div>
                <div className="text-3xl font-bold text-blue-600">{currentEmployee.byChannel.email.total.toLocaleString()}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-green-700 mb-2">Call Activities</div>
                <div className="text-3xl font-bold text-green-600">{currentEmployee.byChannel.call.total.toLocaleString()}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 shadow-sm">
                <div className="text-sm font-medium text-purple-700 mb-2">LinkedIn Activities</div>
                <div className="text-3xl font-bold text-purple-600">{currentEmployee.byChannel.linkedin.total.toLocaleString()}</div>
              </div>
            </div>

            {/* Channel Distribution */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Channel Distribution</h3>
              <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                <div className="h-64">
                  <Pie
                    data={employeeChartData.channelDistribution}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            padding: 15,
                            font: {
                              size: 12,
                              weight: '500'
                            }
                          }
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          padding: 12
                        }
                      }
                    }}
                  />
                </div>
              </Suspense>
            </div>

            {/* Status Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Email Status */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Email Status</h3>
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <Suspense fallback={<div className="h-48 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-48">
                    <Doughnut
                      data={employeeChartData.emailStatus}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              boxWidth: 12,
                              padding: 8,
                              font: { size: 10 }
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 10
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>

              {/* Call Status */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Call Status</h3>
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </div>
                <Suspense fallback={<div className="h-48 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-48">
                    <Doughnut
                      data={employeeChartData.callStatus}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              boxWidth: 12,
                              padding: 8,
                              font: { size: 10 }
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 10
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>

              {/* LinkedIn Status */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">LinkedIn Status</h3>
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                </div>
                <Suspense fallback={<div className="h-48 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-48">
                    <Doughnut
                      data={employeeChartData.linkedinStatus}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              boxWidth: 12,
                              padding: 8,
                              font: { size: 10 }
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 10
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>
            </div>

            {/* Project Performance */}
            {currentEmployee.byProject.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Activity by Project</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={employeeChartData.projectPerformance}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                            labels: {
                              padding: 10,
                              font: { size: 12, weight: '500' }
                            }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { font: { size: 11 } },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                          },
                          x: {
                            ticks: { font: { size: 11 } },
                            grid: { display: false }
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>
            )}

            {/* Projects List */}
            {currentEmployee.projects.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Assigned Projects</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {currentEmployee.projects.map(project => (
                    <div
                      key={project.id}
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">{project.companyName}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {project.isCreator && <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium mr-2">Creator</span>}
                            {project.isTeamMember && <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-medium">Team Member</span>}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
