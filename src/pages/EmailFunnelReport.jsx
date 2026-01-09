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

export default function EmailFunnelReport() {
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

      // Fetch all email activities for the project
      const activitiesResponse = await API.get(`/activities/project/${id}?limit=10000`);
      if (activitiesResponse.data.success) {
        const allActivities = activitiesResponse.data.data || [];
        const emailActivities = allActivities.filter(a => a.type === 'email');
        setActivities(emailActivities);
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
    
    activities.forEach(activity => {
      if (activity.createdAt) {
        months.add(getMonthKey(activity.createdAt));
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

  const getYears = () => {
    const years = new Set();
    
    activities.forEach(activity => {
      if (activity.createdAt) {
        years.add(getYearKey(activity.createdAt));
      }
    });

    contacts.forEach(contact => {
      if (contact.createdAt) {
        years.add(getYearKey(new Date(contact.createdAt)));
      }
    });

    const sortedYears = Array.from(years).sort((a, b) => parseInt(a) - parseInt(b));
    return sortedYears;
  };

  const calculateReportData = () => {
    const periods = viewMode === 'month' ? getMonths() : getYears();
    const data = {};

    periods.forEach(period => {
      data[period] = {
        emailsSent: 0,
        noReply: 0,
        notInterested: 0,
        outOfOffice: 0,
        meetingProposed: 0,
        meetingScheduled: 0,
        interested: 0,
        wrongPerson: 0,
        bounce: 0,
        optOut: 0,
        meetingCompleted: 0,
        totalResponses: 0,
        responseRate: 0,
        openRate: 0,
        clickRate: 0
      };
    });

    // Calculate emails sent (total email activities)
    activities.forEach(activity => {
      if (activity.createdAt) {
        const period = viewMode === 'month' 
          ? getMonthKey(activity.createdAt) 
          : getYearKey(activity.createdAt);
        if (data[period]) {
          data[period].emailsSent++;
        }
      }
    });

    // Calculate metrics by status
    activities.forEach(activity => {
      if (activity.createdAt && activity.status) {
        const period = viewMode === 'month' 
          ? getMonthKey(activity.createdAt) 
          : getYearKey(activity.createdAt);
        if (!data[period]) return;

        switch (activity.status) {
          case 'No Reply':
            data[period].noReply++;
            break;
          case 'Not Interested':
            data[period].notInterested++;
            data[period].totalResponses++;
            break;
          case 'Out of Office':
            data[period].outOfOffice++;
            data[period].totalResponses++;
            break;
          case 'Meeting Proposed':
            data[period].meetingProposed++;
            data[period].totalResponses++;
            break;
          case 'Meeting Scheduled':
            data[period].meetingScheduled++;
            data[period].totalResponses++;
            break;
          case 'Interested':
            data[period].interested++;
            data[period].totalResponses++;
            break;
          case 'Wrong Person':
            data[period].wrongPerson++;
            data[period].totalResponses++;
            break;
          case 'Bounce':
            data[period].bounce++;
            break;
          case 'Opt-Out':
            data[period].optOut++;
            data[period].totalResponses++;
            break;
          case 'Meeting Completed':
            data[period].meetingCompleted++;
            data[period].totalResponses++;
            break;
        }
      }
    });

    // Calculate response rate and other metrics
    periods.forEach(period => {
      if (data[period].emailsSent > 0) {
        data[period].responseRate = ((data[period].totalResponses / data[period].emailsSent) * 100).toFixed(1);
      }
    });

    setReportData(data);
  };

  const metrics = [
    { key: 'emailsSent', label: 'Emails Sent', section: 'Email Activity', bold: true },
    { key: 'noReply', label: 'No Reply', section: 'Email Activity', bold: false },
    { key: 'notInterested', label: 'Not Interested', section: 'Email Activity', bold: false },
    { key: 'outOfOffice', label: 'Out of Office', section: 'Email Activity', bold: false },
    { key: 'meetingProposed', label: 'Meeting Proposed', section: 'Email Activity', bold: true, highlight: true },
    { key: 'meetingScheduled', label: 'Meeting Scheduled', section: 'Email Activity', bold: true, highlight: true },
    { key: 'interested', label: 'Interested', section: 'Email Activity', bold: true, highlight: true },
    { key: 'wrongPerson', label: 'Wrong Person', section: 'Email Activity', bold: false },
    { key: 'bounce', label: 'Bounce', section: 'Email Activity', bold: false },
    { key: 'optOut', label: 'Opt-Out', section: 'Email Activity', bold: false },
    { key: 'meetingCompleted', label: 'Meeting Completed', section: 'Email Activity', bold: true, highlight: true, highlightDark: true },
    { key: 'totalResponses', label: 'Total Responses', section: 'Email Activity', bold: true },
    { key: 'responseRate', label: 'Response Rate (%)', section: 'Email Activity', bold: true, isPercentage: true }
  ];

  const periods = viewMode === 'month' ? getMonths() : getYears();

  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = periods;
    
    return {
      emailFunnel: {
        labels,
        datasets: [
          {
            label: 'Emails Sent',
            data: labels.map(period => reportData[period]?.emailsSent || 0),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Total Responses',
            data: labels.map(period => reportData[period]?.totalResponses || 0),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
          }
        ]
      },
      responseBreakdown: {
        labels,
        datasets: [
          {
            label: 'No Reply',
            data: labels.map(period => reportData[period]?.noReply || 0),
            backgroundColor: 'rgba(156, 163, 175, 0.8)',
          },
          {
            label: 'Not Interested',
            data: labels.map(period => reportData[period]?.notInterested || 0),
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
          },
          {
            label: 'Interested',
            data: labels.map(period => reportData[period]?.interested || 0),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
          },
          {
            label: 'Meeting Proposed',
            data: labels.map(period => reportData[period]?.meetingProposed || 0),
            backgroundColor: 'rgba(251, 191, 36, 0.8)',
          },
          {
            label: 'Meeting Scheduled',
            data: labels.map(period => reportData[period]?.meetingScheduled || 0),
            backgroundColor: 'rgba(6, 182, 212, 0.8)',
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
            backgroundColor: 'rgba(6, 182, 212, 0.8)',
          },
          {
            label: 'Meeting Completed',
            data: labels.map(period => reportData[period]?.meetingCompleted || 0),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
          }
        ]
      },
      responseRate: {
        labels,
        datasets: [
          {
            label: 'Response Rate (%)',
            data: labels.map(period => parseFloat(reportData[period]?.responseRate || 0)),
            borderColor: 'rgb(168, 85, 247)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            tension: 0.4,
            fill: true,
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
  const emailActivityMetrics = metrics.filter(m => m.section === 'Email Activity');

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
              Back to Sales Funnel
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
                  {viewMode === 'month' ? 'Monthly' : 'Yearly'} Email Report - {project?.companyName || 'Project'}
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
            {/* Email Funnel Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Funnel</h3>
              <div className="h-64">
                <Line data={chartData.emailFunnel} options={chartOptions} />
              </div>
            </div>

            {/* Response Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Breakdown</h3>
              <div className="h-64">
                <Bar data={chartData.responseBreakdown} options={barChartOptions} />
              </div>
            </div>

            {/* Meeting Pipeline */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Meeting Pipeline</h3>
              <div className="h-64">
                <Bar data={chartData.meetingPipeline} options={barChartOptions} />
              </div>
            </div>

            {/* Response Rate */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Rate</h3>
              <div className="h-64">
                <Line data={chartData.responseRate} options={chartOptions} />
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
                  {/* Email Activity Section */}
                  <tr>
                    <td colSpan={periods.length + 1} className="px-6 py-3 bg-yellow-100 border-b-2 border-yellow-200">
                      <span className="text-sm font-bold text-gray-900">Email Activity</span>
                    </td>
                  </tr>
                  {emailActivityMetrics.map((metric) => (
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
                          {metric.isPercentage 
                            ? `${reportData[period]?.[metric.key] || 0}%`
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
            <p className="text-gray-500">No email activities found for this project.</p>
          </div>
        )}
      </div>
    </div>
  );
}

