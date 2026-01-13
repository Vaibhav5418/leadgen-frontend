import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function Projects() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    totalProspects: 0,
    totalActivities: 0,
    winRate: 0,
    meetingRate: 0,
    sqlCount: 0,
    avgActivitiesPerProspect: 0
  });
  const [analytics, setAnalytics] = useState(null);
  const [filterStage, setFilterStage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [quickFilter, setQuickFilter] = useState('');

  useEffect(() => {
    fetchProjects();
    fetchAnalytics();
  }, [searchQuery, filterStage, filterStatus, quickFilter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;
      
      const response = await API.get('/projects', { params });
      if (response.data.success) {
        let filteredProjects = response.data.data || [];
        
        // Apply quick filters
        if (quickFilter === 'active') {
          filteredProjects = filteredProjects.filter(p => p.status === 'active');
        } else if (quickFilter === 'draft') {
          filteredProjects = filteredProjects.filter(p => p.status === 'draft');
        } else if (quickFilter === 'completed') {
          filteredProjects = filteredProjects.filter(p => p.status === 'completed');
        }
        
        setProjects(filteredProjects);
        
        // Calculate basic stats
        const allProjects = response.data.data || [];
        const totalProspects = allProjects.reduce((sum, p) => sum + (p.totalProspects || 0), 0);
        setStats({
          total: allProjects.length,
          totalProspects: totalProspects,
          totalActivities: 0, // Will be updated from analytics
          winRate: 0, // Will be updated from analytics
          meetingRate: 0, // Will be updated from analytics
          sqlCount: 0, // Will be updated from analytics
          avgActivitiesPerProspect: 0 // Will be updated from analytics
        });
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await API.get('/projects/analytics');
      if (response.data.success) {
        const data = response.data.data;
        setAnalytics(data);
        // Update stats with analytics data
        setStats(prev => ({
          ...prev,
          totalProspects: data.overview.totalProspects || prev.totalProspects,
          totalActivities: data.overview.totalActivities || 0,
          winRate: data.pipeline?.conversion?.winRate || 0,
          meetingRate: data.pipeline?.conversion?.meetingRate || 0,
          sqlCount: data.pipeline?.conversion?.sql || 0,
          avgActivitiesPerProspect: data.overview.totalProspects > 0 
            ? parseFloat((data.overview.totalActivities / data.overview.totalProspects).toFixed(1))
            : 0
        }));
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const handleCreateProject = () => {
    navigate('/projects/new');
  };

  const handleEditProject = (projectId) => {
    navigate(`/projects/${projectId}/edit`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Project Management</h1>
          <p className="text-sm text-gray-600">Track and manage your outbound lead generation campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors font-medium text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics Dashboard
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={handleCreateProject}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Project
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Projects */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-center shadow-xs">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-white/70 border border-blue-100 px-2 py-1 rounded-full shadow-xs">
              Portfolio Size
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 leading-tight">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">Total Projects</div>
        </div>

        {/* Total Prospects */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-lg bg-white/80 border border-purple-100 flex items-center justify-center shadow-xs">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-purple-700 bg-white/70 border border-purple-100 px-2 py-1 rounded-full shadow-xs">
              Prospects
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 leading-tight">{stats.totalProspects.toLocaleString()}</div>
          <div className="text-sm text-gray-600 mt-1">Total Prospects</div>
        </div>

        {/* Total Activities */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-lg bg-white/80 border border-green-100 flex items-center justify-center shadow-xs">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-white/70 border border-green-100 px-2 py-1 rounded-full shadow-xs">
              Activities
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 leading-tight">{stats.totalActivities.toLocaleString()}</div>
          <div className="text-sm text-gray-600 mt-1">Total Activities</div>
        </div>

        {/* Win Rate */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-lg bg-white/80 border border-emerald-100 flex items-center justify-center shadow-xs">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-100 px-2 py-1 rounded-full shadow-xs">
              Conversion
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 leading-tight">{stats.winRate}%</div>
          <div className="text-sm text-gray-600 mt-1">Win Rate</div>
        </div>
      </div>

      {/* Search and Projects Dropdown Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, company, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="w-64">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  navigate(`/projects/${e.target.value}`);
                }
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.companyName} - {project.contactPerson?.fullName || 'N/A'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Projects Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      ) : projects.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Prospects
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr 
                    key={project._id} 
                    onClick={() => navigate(`/projects/${project._id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {project.companyName || 'N/A'}
                      </div>
                      {project.industry && (
                        <div className="text-xs text-gray-500">{project.industry}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {project.totalProspects || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {project.contactPerson?.fullName || 'N/A'}
                      </div>
                      {project.contactPerson?.email && (
                        <div className="text-xs text-gray-500">{project.contactPerson.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDate(project.createdAt)}
                      </div>
                      {project.createdBy && (
                        <div className="text-xs text-gray-500 mt-1 font-medium">
                          Created by: <span className="text-gray-700">{project.createdBy.name || project.createdBy.email || 'Unknown'}</span>
                        </div>
                      )}
                      {!project.createdBy && (
                        <div className="text-xs text-gray-500 mt-1">
                          Created by: Unknown
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {project.assignedTo || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProject(project._id);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                        title="Edit Project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h2>
            <p className="text-sm text-gray-600 mb-6">Get started by creating your first project</p>
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Project
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
