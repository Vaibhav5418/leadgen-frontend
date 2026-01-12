import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function FunnelProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchProjects();
  }, [searchQuery]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      
      const response = await API.get('/projects', { params });
      if (response.data.success) {
        setProjects(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { 
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'Active',
        dot: 'bg-emerald-500'
      },
      draft: { 
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        label: 'Draft',
        dot: 'bg-amber-500'
      },
      completed: { 
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        label: 'Completed',
        dot: 'bg-blue-500'
      },
      archived: { 
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
        label: 'Archived',
        dot: 'bg-slate-500'
      }
    };
    
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${config.bg} ${config.text} ${config.border} transition-colors`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header Section */}
        <div className={`mb-10 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                Funnel Management
              </h1>
            </div>
            <p className="text-sm text-slate-500 ml-4">
              Select a project to view detailed funnel metrics and analytics
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className={`mb-8 transition-all duration-500 delay-75 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search projects by name, company, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-md bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 animate-pulse"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1 space-y-2.5">
                    <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 bg-slate-200 rounded-md w-16"></div>
                </div>
                <div className="space-y-3 mb-5">
                  <div className="h-4 bg-slate-200 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                  <div className="h-4 bg-slate-200 rounded w-4/6"></div>
                </div>
                <div className="h-px bg-slate-200 mb-4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project, index) => (
              <div
                key={project._id}
                onClick={() => navigate(`/funnel/${project._id}`)}
                className={`group relative bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow hover:border-slate-300 cursor-pointer transition-all duration-150 flex flex-col ${
                  mounted ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                  animationDelay: `${index * 30}ms`,
                  minHeight: '240px'
                }}
              >
                <div className="p-6 flex flex-col h-full">
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-5 min-h-[56px]">
                    <div className="flex-1 min-w-0 pr-3">
                      <h3 className="text-base font-semibold text-slate-900 mb-1.5 truncate">
                        {project.companyName || 'N/A'}
                      </h3>
                      <p className="text-xs text-slate-500 min-h-[16px]">
                        {project.industry || '\u00A0'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(project.status || 'draft')}
                    </div>
                  </div>
                  
                  {/* Info Section */}
                  <div className="space-y-3 mb-5 flex-1">
                    {/* Contact Person */}
                    <div className="flex items-center gap-2.5 min-h-[20px]">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className={`truncate text-sm ${project.contactPerson?.fullName ? 'text-slate-600' : 'text-slate-400'}`}>
                        {project.contactPerson?.fullName || 'No contact name'}
                      </span>
                    </div>
                    
                    {/* Email */}
                    <div className="flex items-center gap-2.5 min-h-[20px]">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className={`truncate text-sm ${project.contactPerson?.email ? 'text-slate-600' : 'text-slate-400'}`}>
                        {project.contactPerson?.email || 'No email'}
                      </span>
                    </div>
                    
                    {/* Created Date */}
                    <div className="flex items-center gap-2.5 min-h-[20px]">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-sm text-slate-600">
                        {formatDate(project.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                      View Funnel
                    </span>
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`bg-white rounded-lg border border-slate-200 shadow-sm p-12 transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">No projects found</h3>
              <p className="text-sm text-slate-500 mb-4">Get started by creating your first project</p>
              <button
                onClick={() => navigate('/projects/new')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
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
    </div>
  );
}
