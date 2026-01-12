import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ColdCallingReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [activities, setActivities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'month'

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  // Refresh data when component comes into focus
  useEffect(() => {
    const handleFocus = () => {
      if (id && !loading) {
        fetchData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id, loading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const projectResponse = await API.get(`/projects/${id}`);
      if (projectResponse.data.success) {
        setProject(projectResponse.data.data);
      }

      // Fetch all call activities for the project
      const activitiesResponse = await API.get(`/activities/project/${id}?limit=10000`);
      if (activitiesResponse.data.success) {
        const allActivities = activitiesResponse.data.data || [];
        const callActivities = allActivities.filter(a => a.type === 'call');
        setActivities(callActivities);
      }

      // Fetch project contacts
      const contactsResponse = await API.get(`/projects/${id}/project-contacts`);
      if (contactsResponse.data.success) {
        setContacts(contactsResponse.data.data || []);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activities.length > 0 || contacts.length > 0) {
      calculateReportData();
    }
  }, [activities, contacts, viewMode]);

  const getDayKey = (date) => {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${day} ${month} '${year}`;
  };

  const getMonthKey = (date) => {
    const d = new Date(date);
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${month} '${year}`;
  };

  const getDays = () => {
    const days = new Set();
    
    // Add days from activities (use callDate if available, otherwise createdAt)
    activities.forEach(activity => {
      const date = activity.callDate ? new Date(activity.callDate) : new Date(activity.createdAt);
      if (date) {
        days.add(getDayKey(date));
      }
    });

    // Add days from contacts
    contacts.forEach(contact => {
      if (contact.createdAt) {
        days.add(getDayKey(new Date(contact.createdAt)));
      }
    });

    // Sort days chronologically
    const sortedDays = Array.from(days).sort((a, b) => {
      const dateA = new Date(a.replace(/(\d+) (\w+) '(\d+)/, '$2 $1, 20$3'));
      const dateB = new Date(b.replace(/(\d+) (\w+) '(\d+)/, '$2 $1, 20$3'));
      return dateA - dateB;
    });

    return sortedDays;
  };

  const getMonths = () => {
    const months = new Set();
    
    activities.forEach(activity => {
      const date = activity.callDate ? new Date(activity.callDate) : new Date(activity.createdAt);
      if (date) {
        months.add(getMonthKey(date));
      }
    });

    contacts.forEach(contact => {
      if (contact.createdAt) {
        months.add(getMonthKey(new Date(contact.createdAt)));
      }
    });

    const sortedMonths = Array.from(months).sort((a, b) => {
      const [monthA, yearA] = a.split(" '");
      const [monthB, yearB] = b.split(" '");
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndexA = monthOrder.indexOf(monthA);
      const monthIndexB = monthOrder.indexOf(monthB);
      
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      return monthIndexA - monthIndexB;
    });

    return sortedMonths;
  };

  const calculateReportData = () => {
    const periods = viewMode === 'day' ? getDays() : getMonths();
    const data = {};

    periods.forEach(period => {
      data[period] = {
        // DRA Section
        dataAllocated: 0,
        interested: 0,
        notInterested: 0,
        ring: 0,
        busy: 0,
        hangUp: 0,
        callBack: 0,
        switchOff: 0,
        // Cold Calling Section
        detailsShared: 0,
        future: 0,
        invalid: 0,
        demoBooked: 0,
        followUps: 0,
        totalCalls: 0,
        freshCalls: 0
      };
    });

    // Calculate Data Allocated (contacts added in that period)
    contacts.forEach(contact => {
      if (contact.createdAt) {
        const period = viewMode === 'day' 
          ? getDayKey(new Date(contact.createdAt)) 
          : getMonthKey(new Date(contact.createdAt));
        if (data[period]) {
          data[period].dataAllocated++;
        }
      }
    });

    // Group activities by contact to track first calls vs follow-ups
    const contactFirstCalls = new Map();
    const contactActivitiesByPeriod = {};

    activities.forEach(activity => {
      const date = activity.callDate ? new Date(activity.callDate) : new Date(activity.createdAt);
      if (!date) return;

      const period = viewMode === 'day' ? getDayKey(date) : getMonthKey(date);
      if (!data[period]) return;

      const contactId = activity.contactId?.toString() || 'unknown';

      // Track first call per contact
      if (activity.callNumber === '1st call' && !contactFirstCalls.has(contactId)) {
        contactFirstCalls.set(contactId, period);
      }

      // Group activities by period and contact
      if (!contactActivitiesByPeriod[period]) {
        contactActivitiesByPeriod[period] = {};
      }
      if (!contactActivitiesByPeriod[period][contactId]) {
        contactActivitiesByPeriod[period][contactId] = [];
      }
      contactActivitiesByPeriod[period][contactId].push(activity);
    });

    // Calculate metrics per period
    activities.forEach(activity => {
      const date = activity.callDate ? new Date(activity.callDate) : new Date(activity.createdAt);
      if (!date) return;

      const period = viewMode === 'day' ? getDayKey(date) : getMonthKey(date);
      if (!data[period]) return;

      // Count by callStatus for DRA section
      if (activity.callStatus) {
        switch (activity.callStatus) {
          case 'Interested':
            data[period].interested++;
            break;
          case 'Not Interested':
            data[period].notInterested++;
            break;
          case 'Ring':
            data[period].ring++;
            break;
          case 'Busy':
            data[period].busy++;
            break;
          case 'Hang Up':
            data[period].hangUp++;
            break;
          case 'Call Back':
            data[period].callBack++;
            break;
          case 'Switch Off':
            data[period].switchOff++;
            break;
          case 'Details Shared':
            data[period].detailsShared++;
            break;
          case 'Future':
            data[period].future++;
            break;
          case 'Invalid':
            data[period].invalid++;
            break;
          case 'Demo Booked':
            data[period].demoBooked++;
            break;
        }
      }

      // Count total calls
      data[period].totalCalls++;
    });

    // Calculate Fresh Calls and Follow Ups
    Object.keys(contactActivitiesByPeriod).forEach(period => {
      const periodData = contactActivitiesByPeriod[period];
      let freshCalls = 0;
      let followUps = 0;

      Object.keys(periodData).forEach(contactId => {
        const contactActs = periodData[contactId];
        const firstCallPeriod = contactFirstCalls.get(contactId);

        contactActs.forEach(activity => {
          if (activity.callNumber === '1st call' || (firstCallPeriod === period && !activity.callNumber)) {
            freshCalls++;
          } else {
            followUps++;
          }
        });
      });

      if (data[period]) {
        data[period].freshCalls = freshCalls;
        data[period].followUps = followUps;
      }
    });

    setReportData(data);
  };

  const metrics = [
    // DRA Section
    { key: 'dataAllocated', label: 'Data Allocated', section: 'DRA', bold: false },
    { key: 'interested', label: 'Interested', section: 'DRA', bold: true },
    { key: 'notInterested', label: 'Not Interested', section: 'DRA', bold: true },
    { key: 'ring', label: 'Ring', section: 'DRA', bold: false },
    { key: 'busy', label: 'Busy', section: 'DRA', bold: false, highlight: true },
    { key: 'hangUp', label: 'Hang Up', section: 'DRA', bold: false },
    { key: 'callBack', label: 'Call Back', section: 'DRA', bold: false },
    { key: 'switchOff', label: 'Switch Off', section: 'DRA', bold: false },
    // Cold Calling Section
    { key: 'detailsShared', label: 'Detailed Shared', section: 'Cold Calling', bold: true, highlight: true },
    { key: 'future', label: 'Future', section: 'Cold Calling', bold: false },
    { key: 'invalid', label: 'Invalid', section: 'Cold Calling', bold: false },
    { key: 'demoBooked', label: 'Demo Booked', section: 'Cold Calling', bold: true, highlight: true, highlightDark: true },
    { key: 'followUps', label: 'Follow Ups', section: 'Cold Calling', bold: true },
    { key: 'totalCalls', label: 'Total Calls', section: 'Cold Calling', bold: true },
    { key: 'freshCalls', label: '(Fresh Calls + FollowUpS)', section: 'Cold Calling', bold: false, isFormula: true }
  ];

  const periods = viewMode === 'day' ? getDays() : getMonths();

  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = periods;
    
    return {
      draMetrics: {
        labels,
        datasets: [
          {
            label: 'Interested',
            data: labels.map(period => reportData[period]?.interested || 0),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Not Interested',
            data: labels.map(period => reportData[period]?.notInterested || 0),
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true,
          }
        ]
      },
      callStatusBreakdown: {
        labels,
        datasets: [
          {
            label: 'Ring',
            data: labels.map(period => reportData[period]?.ring || 0),
            backgroundColor: 'rgba(156, 163, 175, 0.8)',
          },
          {
            label: 'Busy',
            data: labels.map(period => reportData[period]?.busy || 0),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
          },
          {
            label: 'Call Back',
            data: labels.map(period => reportData[period]?.callBack || 0),
            backgroundColor: 'rgba(168, 85, 247, 0.8)',
          }
        ]
      },
      coldCallingMetrics: {
        labels,
        datasets: [
          {
            label: 'Details Shared',
            data: labels.map(period => reportData[period]?.detailsShared || 0),
            borderColor: 'rgb(251, 191, 36)',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Demo Booked',
            data: labels.map(period => reportData[period]?.demoBooked || 0),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
          }
        ]
      },
      callVolume: {
        labels,
        datasets: [
          {
            label: 'Total Calls',
            data: labels.map(period => reportData[period]?.totalCalls || 0),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
          },
          {
            label: 'Fresh Calls',
            data: labels.map(period => reportData[period]?.freshCalls || 0),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
          },
          {
            label: 'Follow Ups',
            data: labels.map(period => reportData[period]?.followUps || 0),
            backgroundColor: 'rgba(168, 85, 247, 0.8)',
          }
        ]
      }
    };
  }, [periods, reportData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
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
        titleFont: {
          size: 14,
          weight: '600'
        },
        bodyFont: {
          size: 13
        },
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        stacked: true
      },
      y: {
        ...chartOptions.scales.y,
        stacked: true
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  // Group metrics by section
  const draMetrics = metrics.filter(m => m.section === 'DRA');
  const coldCallingMetrics = metrics.filter(m => m.section === 'Cold Calling');

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(`/projects/${id}/funnel`)}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Sales Report
            </button>
            
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <svg 
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                  {viewMode === 'day' ? 'Daily' : 'Monthly'} Report - {project?.companyName || 'Project'}
                </h1>
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
              <div className="flex items-center gap-4">
                {lastUpdated && (
                  <p className="text-xs text-gray-500">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('day')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      viewMode === 'day'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      viewMode === 'month'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {periods.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* DRA Metrics Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">DRA Metrics</h3>
              <div className="h-64">
                <Line data={chartData.draMetrics} options={chartOptions} />
              </div>
            </div>

            {/* Call Status Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Status Breakdown</h3>
              <div className="h-64">
                <Bar data={chartData.callStatusBreakdown} options={barChartOptions} />
              </div>
            </div>

            {/* Cold Calling Metrics */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cold Calling Metrics</h3>
              <div className="h-64">
                <Line data={chartData.coldCallingMetrics} options={chartOptions} />
              </div>
            </div>

            {/* Call Volume */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Volume</h3>
              <div className="h-64">
                <Bar data={chartData.callVolume} options={barChartOptions} />
              </div>
            </div>
          </div>
        )}

        {/* Report Table */}
        {periods.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Key Results
                    </th>
                    {periods.map((period) => (
                      <th key={period} className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0 bg-blue-50">
                        <div>{period}</div>
                        <div className="text-xs font-normal text-gray-500 mt-1">Progress</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* DRA Section */}
                  <tr>
                    <td colSpan={periods.length + 1} className="px-6 py-3 bg-yellow-100 border-b-2 border-yellow-200">
                      <span className="text-sm font-bold text-gray-900">DRA</span>
                    </td>
                  </tr>
                  {draMetrics.map((metric) => (
                    <tr
                      key={metric.key}
                      className={`${
                        metric.highlight
                          ? 'bg-green-50'
                          : 'hover:bg-gray-50'
                      } transition-colors duration-150`}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-sm border-r border-gray-200 ${
                        metric.bold ? 'font-bold text-gray-900' : 'text-gray-700'
                      } ${metric.highlightDark ? 'bg-green-100' : ''}`}>
                        {metric.label}
                      </td>
                      {periods.map((period) => (
                        <td
                          key={period}
                          className={`px-4 py-4 whitespace-nowrap text-sm text-center border-r border-gray-200 last:border-r-0 ${
                            metric.bold
                              ? 'font-semibold text-gray-900'
                              : 'text-gray-700'
                          }`}
                        >
                          {metric.isFormula 
                            ? `(${reportData[period]?.freshCalls || 0} + ${reportData[period]?.followUps || 0})`
                            : (reportData[period]?.[metric.key] || 0)
                          }
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Cold Calling Section */}
                  <tr>
                    <td colSpan={periods.length + 1} className="px-6 py-3 bg-yellow-100 border-b-2 border-yellow-200">
                      <span className="text-sm font-bold text-gray-900">Cold Calling</span>
                    </td>
                  </tr>
                  {coldCallingMetrics.map((metric) => (
                    <tr
                      key={metric.key}
                      className={`${
                        metric.highlight
                          ? metric.highlightDark 
                            ? 'bg-green-200' 
                            : 'bg-green-50'
                          : 'hover:bg-gray-50'
                      } transition-colors duration-150`}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-sm border-r border-gray-200 ${
                        metric.bold ? 'font-bold text-gray-900' : 'text-gray-700'
                      } ${metric.highlightDark ? 'bg-green-200' : ''}`}>
                        {metric.label}
                      </td>
                      {periods.map((period) => (
                        <td
                          key={period}
                          className={`px-4 py-4 whitespace-nowrap text-sm text-center border-r border-gray-200 last:border-r-0 ${
                            metric.bold
                              ? 'font-semibold text-gray-900'
                              : 'text-gray-700'
                          }`}
                        >
                          {metric.isFormula 
                            ? `(${reportData[period]?.freshCalls || 0} + ${reportData[period]?.followUps || 0})`
                            : (reportData[period]?.[metric.key] || 0)
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {periods.length === 0 && !loading && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No call activities found for this project.</p>
          </div>
        )}
      </div>
    </div>
  );
}

