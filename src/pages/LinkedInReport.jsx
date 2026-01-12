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

export default function LinkedInReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [activities, setActivities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'year'

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  // Refresh data when component comes into focus (user returns to tab)
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

      // Fetch all LinkedIn activities for the project (no limit to get all activities)
      const activitiesResponse = await API.get(`/activities/project/${id}?limit=10000`);
      if (activitiesResponse.data.success) {
        const allActivities = activitiesResponse.data.data || [];
        const linkedInActivities = allActivities.filter(a => a.type === 'linkedin');
        setActivities(linkedInActivities);
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

  const getMonthKey = (date) => {
    const d = new Date(date);
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${month} '${year}`;
  };

  const getYearKey = (date) => {
    const d = new Date(date);
    return d.getFullYear().toString();
  };

  const getMonths = () => {
    const months = new Set();
    
    // Add months from activities
    activities.forEach(activity => {
      if (activity.createdAt) {
        months.add(getMonthKey(activity.createdAt));
      }
    });

    // Add months from contacts
    contacts.forEach(contact => {
      if (contact.createdAt) {
        months.add(getMonthKey(contact.createdAt));
      }
    });

    // Sort months chronologically
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

  const getYears = () => {
    const years = new Set();
    
    // Add years from activities
    activities.forEach(activity => {
      if (activity.createdAt) {
        years.add(getYearKey(activity.createdAt));
      }
    });

    // Add years from contacts
    contacts.forEach(contact => {
      if (contact.createdAt) {
        years.add(getYearKey(contact.createdAt));
      }
    });

    // Sort years chronologically
    return Array.from(years).sort((a, b) => parseInt(a) - parseInt(b));
  };

  const calculateReportData = () => {
    const periods = viewMode === 'month' ? getMonths() : getYears();
    const data = {};

    periods.forEach(period => {
      data[period] = {
        dataResearch: 0,
        connectionRequestSent: 0,
        connectionAccepted: 0,
        firstMessageSent: 0,
        followupMessagesSent: 0,
        existingConnection: 0,
        conversationsInProgress: 0,
        meetingProposed: 0,
        meetingScheduled: 0,
        meetingCompleted: 0
      };
    });

    // Calculate Data Research manually (contacts added in that period)
    contacts.forEach(contact => {
      if (contact.createdAt) {
        const period = viewMode === 'month' ? getMonthKey(contact.createdAt) : getYearKey(contact.createdAt);
        if (data[period]) {
          data[period].dataResearch++;
        }
      }
    });

    // Group activities by contact
    const contactActivities = {};
    activities.forEach(activity => {
      if (!activity.createdAt) return;
      const contactId = activity.contactId?.toString() || 'unknown';

      if (!contactActivities[contactId]) {
        contactActivities[contactId] = [];
      }
      contactActivities[contactId].push(activity);
    });

    // Calculate metrics per period
    activities.forEach(activity => {
      if (!activity.createdAt) return;
      const period = viewMode === 'month' ? getMonthKey(activity.createdAt) : getYearKey(activity.createdAt);
      if (!data[period]) return;

      // Connection Request Sent
      if (activity.lnRequestSent === 'Yes') {
        data[period].connectionRequestSent++;
      }

      // Existing Connection
      if (activity.lnRequestSent === 'Existing Connect') {
        data[period].existingConnection++;
      }

      // Connection Accepted
      if (activity.connected === 'Yes') {
        data[period].connectionAccepted++;
      }

      // Status-based metrics (count activities with these statuses)
      if (activity.status === 'CIP') {
        data[period].conversationsInProgress++;
      } else if (activity.status === 'Meeting Proposed') {
        data[period].meetingProposed++;
      } else if (activity.status === 'Meeting Scheduled') {
        data[period].meetingScheduled++;
      } else if (activity.status === 'Meeting Completed') {
        data[period].meetingCompleted++;
      }
    });

    // Calculate First Message Sent and Followup Messages
    Object.keys(contactActivities).forEach(contactId => {
      const contactActs = contactActivities[contactId].sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );

      contactActs.forEach((activity, index) => {
        if (!activity.createdAt || !activity.conversationNotes) return;
        const period = viewMode === 'month' ? getMonthKey(activity.createdAt) : getYearKey(activity.createdAt);
        if (!data[period]) return;

        // First Message Sent (first activity with conversation notes for this contact)
        if (index === 0) {
          data[period].firstMessageSent++;
        } else {
          // Followup Messages sent (subsequent activities with conversation notes)
          data[period].followupMessagesSent++;
        }
      });
    });

    setReportData(data);
  };

  const metrics = [
    { key: 'dataResearch', label: 'Data Research manually', section: 'DRA' },
    { key: 'connectionRequestSent', label: 'Connection Request Sent', section: 'DRA' },
    { key: 'connectionAccepted', label: 'Connection Accepted', section: 'DRA' },
    { key: 'firstMessageSent', label: 'First Message Sent', section: 'DRA' },
    { key: 'followupMessagesSent', label: 'Followup Messages sent', section: 'DRA' },
    { key: 'existingConnection', label: 'Existing Connection', section: 'Linked IN' },
    { key: 'conversationsInProgress', label: 'Conversations in Progress', section: 'Linked IN', highlight: true },
    { key: 'meetingProposed', label: 'Meeting Proposed', section: 'Linked IN', highlight: true },
    { key: 'meetingScheduled', label: 'Meeting Scheduled', section: 'Linked IN', highlight: true },
    { key: 'meetingCompleted', label: 'Meeting Completed', section: 'Linked IN', highlight: true }
  ];

  const periods = viewMode === 'month' ? getMonths() : getYears();

  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = periods;
    
    return {
      connectionFunnel: {
        labels,
        datasets: [
          {
            label: 'Connection Request Sent',
            data: labels.map(period => reportData[period]?.connectionRequestSent || 0),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Connection Accepted',
            data: labels.map(period => reportData[period]?.connectionAccepted || 0),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
          }
        ]
      },
      messageActivity: {
        labels,
        datasets: [
          {
            label: 'First Message Sent',
            data: labels.map(period => reportData[period]?.firstMessageSent || 0),
            borderColor: 'rgb(168, 85, 247)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Followup Messages',
            data: labels.map(period => reportData[period]?.followupMessagesSent || 0),
            borderColor: 'rgb(236, 72, 153)',
            backgroundColor: 'rgba(236, 72, 153, 0.1)',
            tension: 0.4,
            fill: true,
          }
        ]
      },
      meetingPipeline: {
        labels,
        datasets: [
          {
            label: 'Meeting Proposed',
            data: labels.map(period => reportData[period]?.meetingProposed || 0),
            backgroundColor: 'rgba(251, 191, 36, 0.8)',
          },
          {
            label: 'Meeting Scheduled',
            data: labels.map(period => reportData[period]?.meetingScheduled || 0),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
          },
          {
            label: 'Meeting Completed',
            data: labels.map(period => reportData[period]?.meetingCompleted || 0),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
          }
        ]
      },
      conversationsStatus: {
        labels,
        datasets: [
          {
            label: 'Conversations in Progress',
            data: labels.map(period => reportData[period]?.conversationsInProgress || 0),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
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
                  {viewMode === 'month' ? 'Monthly' : 'Yearly'} Report - {project?.companyName || 'Project'}
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
                    onClick={() => setViewMode('month')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      viewMode === 'month'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setViewMode('year')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      viewMode === 'year'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {periods.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Connection Funnel Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Funnel</h3>
              <div className="h-64">
                <Line data={chartData.connectionFunnel} options={chartOptions} />
              </div>
            </div>

            {/* Message Activity Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Activity</h3>
              <div className="h-64">
                <Line data={chartData.messageActivity} options={chartOptions} />
              </div>
            </div>

            {/* Meeting Pipeline Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Meeting Pipeline</h3>
              <div className="h-64">
                <Bar data={chartData.meetingPipeline} options={barChartOptions} />
              </div>
            </div>

            {/* Conversations Status Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversations in Progress</h3>
              <div className="h-64">
                <Bar data={chartData.conversationsStatus} options={chartOptions} />
              </div>
            </div>
          </div>
        )}

        {/* Report Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Key Results
                  </th>
                  {periods.map((period) => (
                    <th key={period} className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                      <div>{period}</div>
                      <div className="text-xs font-normal text-gray-500 mt-1">Progress</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {['DRA', 'Linked IN'].map((section) => (
                  <React.Fragment key={section}>
                    {metrics
                      .filter(m => m.section === section)
                      .map((metric, index) => (
                        <tr
                          key={metric.key}
                          className={metric.highlight ? 'bg-green-50' : 'hover:bg-gray-50'}
                        >
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200 ${
                            metric.highlight ? 'font-semibold' : ''
                          }`}>
                            {metric.label}
                          </td>
                          {periods.map((period) => (
                            <td
                              key={period}
                              className={`px-4 py-4 whitespace-nowrap text-sm text-center border-r border-gray-200 last:border-r-0 ${
                                metric.highlight
                                  ? 'font-semibold text-gray-900'
                                  : 'text-gray-700'
                              }`}
                            >
                              {reportData[period]?.[metric.key] || 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

