import React, { useState, useEffect, lazy, Suspense } from 'react';
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

export default function EmployeePerformance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeSection, setActiveSection] = useState('overview'); // 'overview' or 'employee'
  const [activeTab, setActiveTab] = useState('overview'); // For employee section tabs
  const [timeFilter, setTimeFilter] = useState('today'); // 'today', 'last7days', 'lastMonth'

  useEffect(() => {
    fetchEmployeePerformance();
  }, [timeFilter]);

  const fetchEmployeePerformance = async () => {
    try {
      setLoading(true);
      const response = await API.get('/projects/employee-performance', {
        params: { timeFilter }
      });
      if (response.data.success) {
        setData(response.data.data);
        // Select first employee by default
        if (response.data.data.employees.length > 0) {
          setSelectedEmployee(response.data.data.employees[0].userId);
        }
      }
    } catch (error) {
      console.error('Error fetching employee performance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!data || !data.employees || data.employees.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Employee Performance</h1>
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No employee data available</p>
        </div>
      </div>
    );
  }

  const currentEmployee = data.employees.find(emp => emp.userId === selectedEmployee) || data.employees[0];

  // Prepare chart data for overview
  const channelDistributionData = {
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
  };

  // Employee activity comparison
  const employeeComparisonData = {
    labels: data.employees.map(emp => emp.name),
    datasets: [
      {
        label: 'Email',
        data: data.employees.map(emp => emp.byChannel.email.total),
        backgroundColor: '#3B82F6'
      },
      {
        label: 'Call',
        data: data.employees.map(emp => emp.byChannel.call.total),
        backgroundColor: '#10B981'
      },
      {
        label: 'LinkedIn',
        data: data.employees.map(emp => emp.byChannel.linkedin.total),
        backgroundColor: '#8B5CF6'
      }
    ]
  };

  // Current employee channel breakdown
  const employeeChannelData = {
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
  };

  // Email status breakdown for current employee
  const emailStatusData = {
    labels: Object.keys(currentEmployee.byChannel.email.byStatus).length > 0
      ? Object.keys(currentEmployee.byChannel.email.byStatus)
      : ['No Status'],
    datasets: [{
      label: 'Email Status',
      data: Object.keys(currentEmployee.byChannel.email.byStatus).length > 0
        ? Object.values(currentEmployee.byChannel.email.byStatus)
        : [0],
      backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  // Call status breakdown for current employee
  const callStatusData = {
    labels: Object.keys(currentEmployee.byChannel.call.byStatus).length > 0
      ? Object.keys(currentEmployee.byChannel.call.byStatus)
      : ['No Status'],
    datasets: [{
      label: 'Call Status',
      data: Object.keys(currentEmployee.byChannel.call.byStatus).length > 0
        ? Object.values(currentEmployee.byChannel.call.byStatus)
        : [0],
      backgroundColor: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  // LinkedIn status breakdown for current employee
  const linkedinStatusData = {
    labels: Object.keys(currentEmployee.byChannel.linkedin.byStatus).length > 0
      ? Object.keys(currentEmployee.byChannel.linkedin.byStatus)
      : ['No Status'],
    datasets: [{
      label: 'LinkedIn Status',
      data: Object.keys(currentEmployee.byChannel.linkedin.byStatus).length > 0
        ? Object.values(currentEmployee.byChannel.linkedin.byStatus)
        : [0],
      backgroundColor: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  // Project performance for current employee
  const projectPerformanceData = {
    labels: currentEmployee.byProject.map(p => p.projectName),
    datasets: [
      {
        label: 'Email',
        data: currentEmployee.byProject.map(p => p.email),
        backgroundColor: '#3B82F6'
      },
      {
        label: 'Call',
        data: currentEmployee.byProject.map(p => p.call),
        backgroundColor: '#10B981'
      },
      {
        label: 'LinkedIn',
        data: currentEmployee.byProject.map(p => p.linkedin),
        backgroundColor: '#8B5CF6'
      }
    ]
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Performance</h1>
          <p className="text-gray-600">Track employee performance across projects and channels</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Employees</div>
            <div className="text-3xl font-bold text-gray-900">{data.summary.totalEmployees}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Activities</div>
            <div className="text-3xl font-bold text-gray-900">{data.summary.totalActivities.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Projects</div>
            <div className="text-3xl font-bold text-gray-900">{data.summary.totalProjects}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-1">Avg Activities/Employee</div>
            <div className="text-3xl font-bold text-gray-900">
              {data.summary.totalEmployees > 0
                ? Math.round(data.summary.totalActivities / data.summary.totalEmployees)
                : 0}
            </div>
          </div>
        </div>

        {/* Time Filter */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Time Period:</span>
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeFilter('last7days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'last7days'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeFilter('lastMonth')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'lastMonth'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last Month
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex space-x-2 border-b border-gray-200 mb-4">
            <button
              onClick={() => setActiveSection('overview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveSection('employee')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'employee'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Employee
            </button>
          </div>

          {/* Employee Selector (only show in Employee section) */}
          {activeSection === 'employee' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {data.employees.map(emp => (
                  <option key={emp.userId} value={emp.userId}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Employee Section Tabs */}
          {activeSection === 'employee' && (
            <div className="flex space-x-2 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('channels')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'channels'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Channel Breakdown
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'projects'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Projects
              </button>
            </div>
          )}
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Overall Performance Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">Total Activities</div>
                <div className="text-3xl font-bold text-gray-900">{data.summary.totalActivities.toLocaleString()}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">Email Activities</div>
                <div className="text-3xl font-bold text-blue-600">{data.summary.byChannel.email.toLocaleString()}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">Call Activities</div>
                <div className="text-3xl font-bold text-green-600">{data.summary.byChannel.call.toLocaleString()}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-sm font-medium text-gray-600 mb-1">LinkedIn Activities</div>
                <div className="text-3xl font-bold text-purple-600">{data.summary.byChannel.linkedin.toLocaleString()}</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overall Channel Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Channel Distribution</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Doughnut
                      data={channelDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom'
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>

              {/* Employee Comparison */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Activity Comparison</h3>
                <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                  <div className="h-64">
                    <Bar
                      data={employeeComparisonData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top'
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true
                          }
                        }
                      }}
                    />
                  </div>
                </Suspense>
              </div>
            </div>

            {/* Top Performers Table */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Activities</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.employees
                      .sort((a, b) => b.totalActivities - a.totalActivities)
                      .map((emp, index) => (
                        <tr key={emp.userId} className={index < 3 ? 'bg-yellow-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {index < 3 && (
                                <span className="mr-2 text-yellow-600 font-bold">#{index + 1}</span>
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                <div className="text-sm text-gray-500">{emp.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.totalActivities}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{emp.byChannel.email.total}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{emp.byChannel.call.total}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">{emp.byChannel.linkedin.total}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.projects.length}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Employee Section */}
        {activeSection === 'employee' && (
          <>
            {/* Employee Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Employee Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="text-sm font-medium text-gray-600 mb-1">Total Activities</div>
                    <div className="text-2xl font-bold text-gray-900">{currentEmployee.totalActivities}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="text-sm font-medium text-gray-600 mb-1">Email Activities</div>
                    <div className="text-2xl font-bold text-blue-600">{currentEmployee.byChannel.email.total}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="text-sm font-medium text-gray-600 mb-1">Call Activities</div>
                    <div className="text-2xl font-bold text-green-600">{currentEmployee.byChannel.call.total}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="text-sm font-medium text-gray-600 mb-1">LinkedIn Activities</div>
                    <div className="text-2xl font-bold text-purple-600">{currentEmployee.byChannel.linkedin.total}</div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Employee Channel Distribution */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {currentEmployee.name}'s Channel Distribution
                    </h3>
                    <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                      <div className="h-64">
                        <Pie
                          data={employeeChannelData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom'
                              }
                            }
                          }}
                        />
                      </div>
                    </Suspense>
                  </div>

                  {/* Employee Comparison */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Activity Comparison</h3>
                    <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                      <div className="h-64">
                        <Bar
                          data={employeeComparisonData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'top'
                              }
                            },
                            scales: {
                              y: {
                                beginAtZero: true
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

            {/* Channel Breakdown Tab */}
            {activeTab === 'channels' && (
              <div className="space-y-6">
                {/* Employee Channel Distribution */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {currentEmployee.name}'s Channel Distribution
                  </h3>
                  <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                    <div className="h-64">
                      <Pie
                        data={employeeChannelData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom'
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
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Status Breakdown</h3>
                    <Suspense fallback={<div className="h-48 flex items-center justify-center">Loading chart...</div>}>
                      <div className="h-48">
                        <Doughnut
                          data={emailStatusData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  boxWidth: 12,
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

                  {/* Call Status */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Status Breakdown</h3>
                    <Suspense fallback={<div className="h-48 flex items-center justify-center">Loading chart...</div>}>
                      <div className="h-48">
                        <Doughnut
                          data={callStatusData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  boxWidth: 12,
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

                  {/* LinkedIn Status */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">LinkedIn Status Breakdown</h3>
                    <Suspense fallback={<div className="h-48 flex items-center justify-center">Loading chart...</div>}>
                      <div className="h-48">
                        <Doughnut
                          data={linkedinStatusData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  boxWidth: 12,
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
                </div>
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                {/* Projects List */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {currentEmployee.name}'s Projects
                  </h3>
                  {currentEmployee.projects.length > 0 ? (
                    <div className="space-y-3">
                      {currentEmployee.projects.map(project => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          <div>
                            <div className="font-medium text-gray-900">{project.companyName}</div>
                            <div className="text-sm text-gray-500">
                              {project.isCreator && <span className="mr-2">Creator</span>}
                              {project.isTeamMember && <span>Team Member</span>}
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">No projects assigned</p>
                  )}
                </div>

                {/* Project Performance Chart */}
                {currentEmployee.byProject.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Activity by Project
                    </h3>
                    <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading chart...</div>}>
                      <div className="h-64">
                        <Bar
                          data={projectPerformanceData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'top'
                              }
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                stacked: false
                              },
                              x: {
                                stacked: false
                              }
                            }
                          }}
                        />
                      </div>
                    </Suspense>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
