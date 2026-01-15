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
  const [viewModal, setViewModal] = useState({ isOpen: false, project: null });

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

  const handleToggleActive = async (e, projectId, currentStatus) => {
    e.stopPropagation(); // Prevent row click navigation
    
    const isActive = currentStatus === 'active';
    const newStatus = isActive ? 'draft' : 'active';
    
    try {
      const response = await API.patch(`/projects/${projectId}/status`, {
        isActive: !isActive
      });
      
      if (response.data.success) {
        // Update the project in the local state
        setProjects(prevProjects =>
          prevProjects.map(project =>
            project._id === projectId
              ? { ...project, status: newStatus }
              : project
          )
        );
      }
    } catch (err) {
      console.error('Error toggling project status:', err);
      alert('Failed to update project status. Please try again.');
    }
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
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '16%' }}>
                    Company
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '11%' }}>
                    Created Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '11%' }}>
                    Assigned To
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '16%' }}>
                    Contact Person
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                    Total Prospects
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                    Leads Generated
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                    Active
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '14%' }}>
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
                    <td className="px-3 py-4">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {project.companyName || 'N/A'}
                      </div>
                      {project.industry && (
                        <div className="text-xs text-gray-500 truncate">{project.industry}</div>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDate(project.createdAt)}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900 truncate">
                      {project.assignedTo || '-'}
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-gray-900 truncate">
                        {project.contactPerson?.fullName || 'N/A'}
                      </div>
                      {project.contactPerson?.email && (
                        <div className="text-xs text-gray-500 truncate">{project.contactPerson.email}</div>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {project.totalProspects || 0}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {project.leadsGenerated || 0}
                      </div>
                    </td>
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={project.status === 'active'}
                          onChange={(e) => handleToggleActive(e, project._id, project.status)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </td>
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewModal({ isOpen: true, project });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
                          title="View Project Details"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProject(project._id);
                        }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                        title="Edit Project"
                      >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      </div>
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

      {/* Project View Modal */}
      {viewModal.isOpen && viewModal.project && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Project Details</h2>
                <p className="text-sm text-gray-600 mt-1">{viewModal.project.companyName}</p>
              </div>
              <button
                onClick={() => setViewModal({ isOpen: false, project: null })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Company Details */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Company Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Company Name</label>
                    <p className="text-sm text-gray-900 mt-1">{viewModal.project.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Website</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {viewModal.project.website ? (
                        <a href={viewModal.project.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {viewModal.project.website}
                        </a>
                      ) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">City</label>
                    <p className="text-sm text-gray-900 mt-1">{viewModal.project.city || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Country</label>
                    <p className="text-sm text-gray-900 mt-1">{viewModal.project.country || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Industry</label>
                    <p className="text-sm text-gray-900 mt-1">{viewModal.project.industry || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Company Size</label>
                    <p className="text-sm text-gray-900 mt-1">{viewModal.project.companySize || 'N/A'}</p>
                  </div>
                  {viewModal.project.companyDescription && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Company Description</label>
                      <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{viewModal.project.companyDescription}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Person */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Contact Person
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Full Name</label>
                    <p className="text-sm text-gray-900 mt-1">{viewModal.project.contactPerson?.fullName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Designation</label>
                    <p className="text-sm text-gray-900 mt-1">{viewModal.project.contactPerson?.designation || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {viewModal.project.contactPerson?.email ? (
                        <a href={`mailto:${viewModal.project.contactPerson.email}`} className="text-blue-600 hover:underline">
                          {viewModal.project.contactPerson.email}
                        </a>
                      ) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Phone Number</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {viewModal.project.contactPerson?.phoneNumber ? (
                        <a href={`tel:${viewModal.project.contactPerson.phoneNumber}`} className="text-blue-600 hover:underline">
                          {viewModal.project.contactPerson.phoneNumber}
                        </a>
                      ) : 'N/A'}
                    </p>
                  </div>
                  {viewModal.project.contactPerson?.linkedInProfileUrl && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">LinkedIn Profile</label>
                      <p className="text-sm text-gray-900 mt-1">
                        <a href={viewModal.project.contactPerson.linkedInProfileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {viewModal.project.contactPerson.linkedInProfileUrl}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Campaign Details */}
              {viewModal.project.campaignDetails && (
                <div className="bg-gray-50 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Campaign Details
                  </h3>
                  <div className="space-y-4">
                    {viewModal.project.campaignDetails.servicesOffered && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Services Offered</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {viewModal.project.campaignDetails.servicesOffered.leadGeneration && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">Lead Generation</span>
                          )}
                          {viewModal.project.campaignDetails.servicesOffered.marketResearch && (
                            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Market Research</span>
                          )}
                          {viewModal.project.campaignDetails.servicesOffered.appointmentSetting && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">Appointment Setting</span>
                          )}
                          {viewModal.project.campaignDetails.servicesOffered.dataEnrichment && (
                            <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">Data Enrichment</span>
                          )}
                          {!viewModal.project.campaignDetails.servicesOffered.leadGeneration && 
                           !viewModal.project.campaignDetails.servicesOffered.marketResearch && 
                           !viewModal.project.campaignDetails.servicesOffered.appointmentSetting && 
                           !viewModal.project.campaignDetails.servicesOffered.dataEnrichment && (
                            <span className="text-sm text-gray-500">None selected</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewModal.project.campaignDetails.leadQuotaCommitted > 0 && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Lead Quota Committed</label>
                          <p className="text-sm text-gray-900 mt-1">{viewModal.project.campaignDetails.leadQuotaCommitted}</p>
                        </div>
                      )}
                      {viewModal.project.campaignDetails.startDate && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Start Date</label>
                          <p className="text-sm text-gray-900 mt-1">{formatDate(viewModal.project.campaignDetails.startDate)}</p>
                        </div>
                      )}
                      {viewModal.project.campaignDetails.endDate && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">End Date</label>
                          <p className="text-sm text-gray-900 mt-1">{formatDate(viewModal.project.campaignDetails.endDate)}</p>
                        </div>
                      )}
                    </div>
                    {viewModal.project.campaignDetails.expectationsFromUs && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Expectations From Us</label>
                        <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{viewModal.project.campaignDetails.expectationsFromUs}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Channels */}
              {viewModal.project.channels && (
                <div className="bg-gray-50 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                    Channels
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {viewModal.project.channels.linkedInOutreach && (
                      <span className="px-4 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-lg flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                        LinkedIn Outreach
                      </span>
                    )}
                    {viewModal.project.channels.coldEmail && (
                      <span className="px-4 py-2 bg-purple-100 text-purple-800 text-sm font-medium rounded-lg flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Cold Email
                      </span>
                    )}
                    {viewModal.project.channels.coldCalling && (
                      <span className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-lg flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Cold Calling
                      </span>
                    )}
                    {!viewModal.project.channels.linkedInOutreach && 
                     !viewModal.project.channels.coldEmail && 
                     !viewModal.project.channels.coldCalling && (
                      <span className="text-sm text-gray-500">No channels selected</span>
                    )}
                  </div>
                </div>
              )}

              {/* ICP Definition */}
              {viewModal.project.icpDefinition && (
                <div className="bg-gray-50 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    ICP Definition
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewModal.project.icpDefinition.targetIndustries && viewModal.project.icpDefinition.targetIndustries.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Target Industries</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {Array.isArray(viewModal.project.icpDefinition.targetIndustries) 
                            ? viewModal.project.icpDefinition.targetIndustries.join(', ')
                            : viewModal.project.icpDefinition.targetIndustries}
                        </p>
                      </div>
                    )}
                    {viewModal.project.icpDefinition.targetJobTitles && viewModal.project.icpDefinition.targetJobTitles.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Target Job Titles</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {Array.isArray(viewModal.project.icpDefinition.targetJobTitles)
                            ? viewModal.project.icpDefinition.targetJobTitles.join(', ')
                            : viewModal.project.icpDefinition.targetJobTitles}
                        </p>
                      </div>
                    )}
                    {(viewModal.project.icpDefinition.companySizeMin > 0 || viewModal.project.icpDefinition.companySizeMax < 1000) && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Company Size Range</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {viewModal.project.icpDefinition.companySizeMin} - {viewModal.project.icpDefinition.companySizeMax} employees
                        </p>
                      </div>
                    )}
                    {viewModal.project.icpDefinition.geographies && viewModal.project.icpDefinition.geographies.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Geographies</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {Array.isArray(viewModal.project.icpDefinition.geographies)
                            ? viewModal.project.icpDefinition.geographies.join(', ')
                            : viewModal.project.icpDefinition.geographies}
                        </p>
                      </div>
                    )}
                    {viewModal.project.icpDefinition.keywords && viewModal.project.icpDefinition.keywords.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Keywords</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {Array.isArray(viewModal.project.icpDefinition.keywords)
                            ? viewModal.project.icpDefinition.keywords.join(', ')
                            : viewModal.project.icpDefinition.keywords}
                        </p>
                      </div>
                    )}
                    {viewModal.project.icpDefinition.exclusionCriteria && viewModal.project.icpDefinition.exclusionCriteria.length > 0 && (
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-500 uppercase">Exclusion Criteria</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {Array.isArray(viewModal.project.icpDefinition.exclusionCriteria)
                            ? viewModal.project.icpDefinition.exclusionCriteria.join(', ')
                            : viewModal.project.icpDefinition.exclusionCriteria}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Team Allocation */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Team Allocation
                </h3>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Assigned To</label>
                  <p className="text-sm text-gray-900 mt-1">{viewModal.project.assignedTo || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setViewModal({ isOpen: false, project: null })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setViewModal({ isOpen: false, project: null });
                  handleEditProject(viewModal.project._id);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit Project
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
