import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function EmailFunnelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState({
    prospectData: 0,
    emailSent: 0,
    accepted: 0,
    followups: 0,
    cip: 0,
    meetingProposed: 0,
    scheduled: 0,
    completed: 0,
    sql: 0
  });

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    if (contacts.length > 0 || activities.length > 0) {
      calculateFunnelData();
    }
  }, [contacts, activities]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const projectResponse = await API.get(`/projects/${id}`);
      if (projectResponse.data.success) {
        setProject(projectResponse.data.data);
      }

      // Fetch project contacts
      const contactsResponse = await API.get(`/projects/${id}/project-contacts`);
      if (contactsResponse.data.success) {
        setContacts(contactsResponse.data.data || []);
      }

      // Fetch all email activities for the project
      const activitiesResponse = await API.get(`/activities/project/${id}?limit=10000`);
      if (activitiesResponse.data.success) {
        const allActivities = activitiesResponse.data.data || [];
        const emailActivities = allActivities.filter(a => a.type === 'email');
        setActivities(emailActivities);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateFunnelData = () => {
    const data = {
      prospectData: contacts.length, // Total prospects from project
      emailSent: 0,
      accepted: 0,
      followups: 0,
      cip: 0,
      meetingProposed: 0,
      scheduled: 0,
      completed: 0,
      sql: 0
    };

    // Group activities by contact
    const contactActivities = {};
    activities.forEach(activity => {
      if (!activity.contactId) return;
      const contactId = activity.contactId.toString();
      if (!contactActivities[contactId]) {
        contactActivities[contactId] = [];
      }
      contactActivities[contactId].push(activity);
    });

    // Calculate metrics
    const emailSentSet = new Set();
    const acceptedSet = new Set();
    const cipSet = new Set();
    const meetingProposedSet = new Set();
    const scheduledSet = new Set();
    const completedSet = new Set();
    const sqlSet = new Set();

    activities.forEach(activity => {
      const contactId = activity.contactId?.toString();
      if (!contactId) return;

      // Email Sent - if emailDate exists, it means an email was sent
      if (activity.emailDate) {
        emailSentSet.add(contactId);
      }

      // Accepted - if status is 'Interested' or 'Meeting Proposed' or 'Meeting Scheduled'
      if (activity.status === 'Interested' || 
          activity.status === 'Meeting Proposed' || 
          activity.status === 'Meeting Scheduled') {
        acceptedSet.add(contactId);
      }

      // Conversations in Progress (CIP) - if status indicates ongoing conversation
      if (activity.status === 'Interested' || activity.status === 'Out of Office') {
        cipSet.add(contactId);
      }

      // Meeting Proposed - if status is 'Meeting Proposed'
      if (activity.status === 'Meeting Proposed') {
        meetingProposedSet.add(contactId);
      }

      // Meeting Scheduled - if status is 'Meeting Scheduled' or nextActionDate is set
      if (activity.status === 'Meeting Scheduled' || activity.nextActionDate) {
        scheduledSet.add(contactId);
      }

      // Meeting Completed - if status is 'Meeting Completed'
      if (activity.status === 'Meeting Completed') {
        completedSet.add(contactId);
      }

      // SQL (Sales Qualified Lead) - if status is 'Meeting Completed' or 'Interested' with high engagement
      if (activity.status === 'Meeting Completed' || 
          (activity.status === 'Interested' && activity.conversationNotes && activity.conversationNotes.length > 50)) {
        sqlSet.add(contactId);
      }
    });

    // Calculate followups (contacts with more than one email)
    Object.keys(contactActivities).forEach(contactId => {
      const contactActs = contactActivities[contactId];
      const emailsWithNotes = contactActs.filter(a => a.conversationNotes && a.conversationNotes.trim() !== '');
      if (emailsWithNotes.length > 1 || contactActs.length > 1) {
        data.followups++;
      }
    });

    data.emailSent = emailSentSet.size;
    data.accepted = acceptedSet.size;
    data.cip = cipSet.size;
    data.meetingProposed = meetingProposedSet.size;
    data.scheduled = scheduledSet.size;
    data.completed = completedSet.size;
    data.sql = sqlSet.size;

    setFunnelData(data);
  };

  const funnelRows = [
    { key: 'prospectData', label: 'Prospect Data', description: 'Total prospects from this project' },
    { key: 'emailSent', label: 'Email Sent', description: 'Emails sent to prospects' },
    { key: 'accepted', label: 'Accepted', description: 'Emails accepted/responded' },
    { key: 'followups', label: 'Followups', description: 'Contacts with multiple emails' },
    { key: 'cip', label: 'CIP', description: 'Conversations in Progress' },
    { key: 'meetingProposed', label: 'Meeting Proposed', description: 'Meetings proposed' },
    { key: 'scheduled', label: 'Scheduled', description: 'Meetings scheduled' },
    { key: 'completed', label: 'Completed', description: 'Meetings completed' },
    { key: 'sql', label: 'SQL', description: 'Sales Qualified Leads' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading funnel data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/funnel/${id}`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-200 mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Funnel Selection
          </button>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-700 rounded-full"></div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Email Funnel - {project?.companyName || 'Project'}
              </h1>
            </div>
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
        </div>

        {/* Funnel Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-blue-50 via-blue-50 to-cyan-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider border-r border-blue-200">
                    Metric
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-blue-900 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider border-l border-blue-200">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {funnelRows.map((row, index) => {
                  const value = funnelData[row.key] || 0;
                  const percentage = funnelData.prospectData > 0 
                    ? ((value / funnelData.prospectData) * 100).toFixed(1) 
                    : 0;
                  
                  return (
                    <tr
                      key={row.key}
                      className={`hover:bg-gray-50 transition-colors ${
                        index === 0 ? 'bg-blue-50' : 
                        index >= 5 ? 'bg-green-50' : 
                        ''
                      }`}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium border-r border-gray-200 ${
                        index === 0 ? 'text-blue-900' : 
                        index >= 5 ? 'text-green-900' : 
                        'text-gray-900'
                      }`}>
                        {row.label}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-2xl font-bold ${
                            index === 0 ? 'text-blue-600' : 
                            index >= 5 ? 'text-green-600' : 
                            'text-gray-900'
                          }`}>
                            {value}
                          </span>
                          {index > 0 && funnelData.prospectData > 0 && (
                            <span className="text-xs text-gray-500 mt-1">
                              {percentage}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 border-l border-gray-200">
                        {row.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Card */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm font-medium text-blue-900 mb-2">Total Prospects</div>
            <div className="text-3xl font-bold text-blue-700">{funnelData.prospectData}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm font-medium text-emerald-900 mb-2">Conversion Rate</div>
            <div className="text-3xl font-bold text-emerald-700">
              {funnelData.prospectData > 0 
                ? ((funnelData.completed / funnelData.prospectData) * 100).toFixed(1) 
                : 0}%
            </div>
          </div>
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-sm font-medium text-cyan-900 mb-2">SQL Rate</div>
            <div className="text-3xl font-bold text-cyan-700">
              {funnelData.prospectData > 0 
                ? ((funnelData.sql / funnelData.prospectData) * 100).toFixed(1) 
                : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
