import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api/axios';
import ContactFilter from '../components/ContactFilter';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKeywords, setExpandedKeywords] = useState(new Set());
  const [viewMode, setViewMode] = useState('details'); // 'details' or 'company'
  const [expandedCompanies, setExpandedCompanies] = useState(new Set());
  const [allCompaniesData, setAllCompaniesData] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const navigate = useNavigate();
  
  // Get category, page, and search from URL params or use default
  // Note: Database stores as "IND-IT&service", but UI shows "IND-IT & Service"
  const category = searchParams.get('category') || 'All';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchParam = searchParams.get('search') || '';
  
  // Get filter params from URL
  const filterKeywords = searchParams.get('filterKeywords') || '';
  const filterCity = searchParams.get('filterCity') || '';
  const filterState = searchParams.get('filterState') || '';
  const filterCountry = searchParams.get('filterCountry') || '';
  const filterHasLinkedIn = searchParams.get('filterHasLinkedIn') || '';
  const filterHasEmail = searchParams.get('filterHasEmail') || '';
  const filterHasPhone = searchParams.get('filterHasPhone') || '';
  
  const categories = [
    'All',
    'IND-IT & Service',
    'Accounting & Book keeping',
    'Web Design & Development',
    'Enterprise Software',
    'Finance Services - IND',
    'E-commerce',
    'CRM',
    'Middle East',
    'International',
    'USA Chicago',
    'IT Company - USA',
    'IT Company - Chicago',
    'Weam.ai Mumbai Data',
    'ERP Software',
    'ERP NEXT- Manufacturing-Automotive Components & Spares',
    'Salon & Spa - Chicago',
    'SPA & SALON AHMEDABAD',
    'kology'
  ];

  // Removed auto-update URL effect - category changes are handled in dropdown onChange
  // This prevents filters from being cleared when they're applied

  // Sync pagination state with URL params
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      page: currentPage
    }));
  }, [currentPage]);

  // Sync search query with URL params
  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  // Fetch all companies when Company view is active or filters change
  useEffect(() => {
    if (viewMode === 'company') {
      fetchAllCompanies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, category, searchParam, filterKeywords, filterCity, filterState, filterCountry, filterHasLinkedIn, filterHasEmail, filterHasPhone]);

  // Fetch contacts when filters or pagination change
  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, currentPage, searchParam, filterKeywords, filterCity, filterState, filterCountry, filterHasLinkedIn, filterHasEmail, filterHasPhone]);


  const fetchAllCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const params = {};
      // Only add category if it's not "All"
      if (category && category !== 'All') {
        params.category = category;
      }
      
      // Add search param if provided
      if (searchParam && searchParam.trim()) {
        params.search = searchParam.trim();
      }
      
      // Add filter params
      if (filterKeywords) params.filterKeywords = filterKeywords;
      if (filterCity) params.filterCity = filterCity;
      if (filterState) params.filterState = filterState;
      if (filterCountry) params.filterCountry = filterCountry;
      if (filterHasLinkedIn) params.filterHasLinkedIn = filterHasLinkedIn;
      if (filterHasEmail) params.filterHasEmail = filterHasEmail;
      if (filterHasPhone) params.filterHasPhone = filterHasPhone;
      
      const response = await API.get('/contacts/companies', { params });
      const companies = response?.data?.data || [];
      setAllCompaniesData(companies);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setAllCompaniesData([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = { 
        page: currentPage,
        limit: 50
      };
      // Only add category param if it's not "All"
      if (category && category !== 'All') {
        params.category = category;
      }
      // Only add search param if it's not empty
      if (searchParam && searchParam.trim()) {
        params.search = searchParam.trim();
      }
      // Add filter params
      if (filterKeywords) params.filterKeywords = filterKeywords;
      if (filterCity) params.filterCity = filterCity;
      if (filterState) params.filterState = filterState;
      if (filterCountry) params.filterCountry = filterCountry;
      if (filterHasLinkedIn) params.filterHasLinkedIn = filterHasLinkedIn;
      if (filterHasEmail) params.filterHasEmail = filterHasEmail;
      if (filterHasPhone) params.filterHasPhone = filterHasPhone;
      
      const response = await API.get('/contacts', { params });
      
      const list = response?.data?.data || response?.data || [];
      setContacts(Array.isArray(list) ? list : []);
      
      // Update pagination info
      if (response?.data) {
        setPagination({
          page: response.data.page || currentPage,
          limit: response.data.limit || 50,
          total: response.data.total || 0,
          totalPages: response.data.totalPages || 0
        });
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch contacts. Please try again.');
      console.error('=== Error fetching contacts ===');
      console.error('Error details:', err);
      console.error('Error response:', err?.response?.data);
      console.error('Error status:', err?.response?.status);
      console.error('==============================');
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = (contactId) => {
    const categoryParam = (category && category !== 'All') ? `?category=${encodeURIComponent(category)}` : '';
    navigate(`/contacts/${contactId}${categoryParam}`);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedContacts(contacts.map(c => c._id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleAccessEmail = (contact, e) => {
    e.stopPropagation();
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    const params = { page: '1' };
    
    // Only add category if it's not "All"
    if (category && category !== 'All') {
      params.category = category;
    }
    
    // If search query is empty, remove search param
    if (trimmedQuery) {
      params.search = trimmedQuery;
    }
    
    // Preserve active filters when searching
    if (filterKeywords) params.filterKeywords = filterKeywords;
    if (filterCity) params.filterCity = filterCity;
    if (filterState) params.filterState = filterState;
    if (filterCountry) params.filterCountry = filterCountry;
    if (filterHasLinkedIn) params.filterHasLinkedIn = filterHasLinkedIn;
    if (filterHasEmail) params.filterHasEmail = filterHasEmail;
    if (filterHasPhone) params.filterHasPhone = filterHasPhone;
    
    setSearchParams(params, { replace: true });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    const params = { page: '1' };
    // Only add category if it's not "All"
    if (category && category !== 'All') {
      params.category = category;
    }
    // Preserve active filters when clearing search
    if (filterKeywords) params.filterKeywords = filterKeywords;
    if (filterCity) params.filterCity = filterCity;
    if (filterState) params.filterState = filterState;
    if (filterCountry) params.filterCountry = filterCountry;
    if (filterHasLinkedIn) params.filterHasLinkedIn = filterHasLinkedIn;
    if (filterHasEmail) params.filterHasEmail = filterHasEmail;
    if (filterHasPhone) params.filterHasPhone = filterHasPhone;
    setSearchParams(params, { replace: true });
  };

  const handleApplyFilters = (filters) => {
    const params = { page: '1' };
    // Only add category if it's not "All"
    if (category && category !== 'All') {
      params.category = category;
    }
    
    if (searchParam && searchParam.trim()) {
      params.search = searchParam.trim();
    }
    
    // Add active filters - include all filters that have values
    if (filters.keywords && filters.keywords.trim()) {
      params.filterKeywords = filters.keywords.trim();
    }
    if (filters.city && filters.city.trim()) {
      params.filterCity = filters.city.trim();
    }
    if (filters.state && filters.state.trim()) {
      params.filterState = filters.state.trim();
    }
    if (filters.country && filters.country.trim()) {
      params.filterCountry = filters.country.trim();
    }
    // For dropdowns, include them if they have a value (yes/no)
    if (filters.hasLinkedIn && filters.hasLinkedIn !== '') {
      params.filterHasLinkedIn = filters.hasLinkedIn;
    }
    if (filters.hasEmail && filters.hasEmail !== '') {
      params.filterHasEmail = filters.hasEmail;
    }
    if (filters.hasPhone && filters.hasPhone !== '') {
      params.filterHasPhone = filters.hasPhone;
    }
    
    setSearchParams(params, { replace: true });
  };

  const hasActiveFilters = () => {
    return !!(filterKeywords || filterCity || filterState || filterCountry || 
              filterHasLinkedIn || filterHasEmail || filterHasPhone);
  };

  const handleClearFilters = () => {
    const params = { page: '1' };
    // Only add category if it's not "All"
    if (category && category !== 'All') {
      params.category = category;
    }
    if (searchParam) params.search = searchParam;
    setSearchParams(params, { replace: true });
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    let aValue = a[sortColumn] || '';
    let bValue = b[sortColumn] || '';
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  const getCompanyInitials = (companyName) => {
    if (!companyName) return '?';
    const words = companyName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
  };

  const toggleKeywords = (contactId) => {
    setExpandedKeywords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const formatKeywords = (contact) => {
    if (!contact.keywords) return '-';
    
    const keywords = contact.keywords.split(',').map(k => k.trim()).filter(k => k);
    const isExpanded = expandedKeywords.has(contact._id);
    
    if (keywords.length <= 3) {
      return keywords.join(', ');
    }
    
    if (isExpanded) {
      return keywords.join(', ');
    }
    
    return keywords.slice(0, 3).join(', ') + '...';
  };

  // Group contacts by company
  const groupContactsByCompany = () => {
    const grouped = {};
    sortedContacts.forEach(contact => {
      const companyName = contact.company || 'No Company';
      if (!grouped[companyName]) {
        grouped[companyName] = [];
      }
      grouped[companyName].push(contact);
    });
    // Sort companies alphabetically
    const sortedCompanies = Object.keys(grouped).sort((a, b) => {
      if (a === 'No Company') return 1;
      if (b === 'No Company') return -1;
      return a.localeCompare(b);
    });
    const sortedGrouped = {};
    sortedCompanies.forEach(company => {
      sortedGrouped[company] = grouped[company];
    });
    return sortedGrouped;
  };

  const toggleCompany = (companyName) => {
    setExpandedCompanies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyName)) {
        newSet.delete(companyName);
      } else {
        newSet.add(companyName);
      }
      return newSet;
    });
  };

  const handleCompanyClick = (companyName) => {
    // Navigate to company detail page
    const categoryParam = (category && category !== 'All') ? `?category=${encodeURIComponent(category)}` : '';
    const encodedCompanyName = encodeURIComponent(companyName);
    navigate(`/contacts/company/${encodedCompanyName}${categoryParam}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gray-200 blur-xl animate-pulse"></div>
            <div className="relative animate-spin rounded-full h-14 w-14 border-2 border-gray-200 border-t-gray-900 mx-auto"></div>
          </div>
          <p className="tracking-wide text-sm uppercase text-gray-500 font-medium">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8 animate-fade-in-down">
          {/* Title and Stats Row */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Contacts</h1>
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('details')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        viewMode === 'details'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="View individual contacts"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setViewMode('company')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        viewMode === 'company'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="View companies grouped by name"
                    >
                      Company
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-gray-50 text-gray-700 border border-gray-200 shadow-sm">
                    {pagination.total.toLocaleString()} {pagination.total === 1 ? 'contact' : 'contacts'}
                  </span>
                  {pagination.totalPages > 1 && (
                    <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                      Page {currentPage} of {pagination.totalPages}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 font-medium">Category:</span>
                    <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
                      {category}
                    </span>
                  </div>
                  {viewMode === 'company' && allCompaniesData.length > 0 && (
                    <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                      {allCompaniesData.length} {allCompaniesData.length === 1 ? 'company' : 'companies'}
                    </span>
                  )}
                  {hasActiveFilters() && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Filters Active
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search and Category Section */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-end">
              {/* Search and Category on Same Line */}
              <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
                {/* Search Input */}
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                  <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch(e);
                        }
                      }}
                      placeholder="Search by name, email, company, title..."
                      className="pl-11 pr-11 py-3 w-full border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 font-semibold text-sm whitespace-nowrap shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Search
                  </button>
                </form>

                {/* Category Dropdown */}
                <div className="relative group sm:w-64">
                  <select
                    value={category}
                    onChange={(e) => {
                      const newCategory = e.target.value;
                      const params = { page: '1' };
                      // Only add category if it's not "All"
                      if (newCategory !== 'All') {
                        params.category = newCategory;
                      }
                      if (searchParam) params.search = searchParam;
                      // Preserve active filters when changing category
                      if (filterKeywords) params.filterKeywords = filterKeywords;
                      if (filterCity) params.filterCity = filterCity;
                      if (filterState) params.filterState = filterState;
                      if (filterCountry) params.filterCountry = filterCountry;
                      if (filterHasLinkedIn) params.filterHasLinkedIn = filterHasLinkedIn;
                      if (filterHasEmail) params.filterHasEmail = filterHasEmail;
                      if (filterHasPhone) params.filterHasPhone = filterHasPhone;
                      setSearchParams(params, { replace: true });
                    }}
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 w-full text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 cursor-pointer shadow-sm hover:border-gray-400 hover:shadow-md"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Filter Component */}
                <ContactFilter
                  category={category}
                  searchParam={searchParam}
                  onApplyFilters={handleApplyFilters}
                  onClearFilters={handleClearFilters}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/import')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all duration-200 font-semibold text-sm shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex-1 sm:flex-none"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="hidden sm:inline">Import</span>
                </button>
                <button
                  onClick={() => navigate('/contacts/new')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 active:bg-gray-950 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transform hover:scale-105 active:scale-100 flex-1 sm:flex-none"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Add Contact</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-5 py-4 rounded-lg shadow-md animate-shake">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Contacts View */}
        {contacts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No contacts found</h3>
            <p className="text-gray-600 mb-2">
              {category === 'All' ? (
                'No contacts found in the database.'
              ) : (
                <>No contacts found for category: <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">{category}</span></>
              )}
            </p>
            <p className="text-sm text-gray-500 mb-8">
              {category === 'All' ? (
                'Try using the search or filters to find contacts, or import contacts to get started.'
              ) : (
                'Switch to a different category using the dropdown above, or import/add contacts for this category.'
              )}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate('/import')}
                className="inline-flex items-center px-5 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-900 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-md"
              >
                Import CSV/Excel
              </button>
              <button
                onClick={() => navigate('/contacts/new')}
                className="inline-flex items-center px-5 py-3 border border-transparent shadow-md text-sm font-medium rounded-lg text-white bg-gray-900 hover:bg-gray-800 transition-all duration-200 hover:shadow-lg transform hover:scale-105"
              >
                Add Contact
              </button>
            </div>
          </div>
        ) : viewMode === 'company' ? (
          /* Company List View */
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-fade-in">
              {loadingCompanies ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Loading companies...</p>
                  </div>
                </div>
              ) : allCompaniesData.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No companies found</h3>
                  <p className="text-gray-600 mb-2">
                    {hasActiveFilters() ? (
                      'No companies match the current filters. Try adjusting your search or filter criteria.'
                    ) : category === 'All' ? (
                      'No companies found in the database.'
                    ) : (
                      <>No companies found for category: <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">{category}</span></>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mb-8">
                    {hasActiveFilters() ? (
                      'Clear filters or try a different search term.'
                    ) : (
                      'Try using the search or filters to find companies, or import contacts to get started.'
                    )}
                  </p>
                  {hasActiveFilters() && (
                    <button
                      onClick={handleClearFilters}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  className="overflow-y-auto" 
                  style={{ 
                    maxHeight: 'calc(100vh - 300px)',
                    overscrollBehavior: 'contain'
                  }}
                >
                  <div className="divide-y divide-gray-200">
                    {allCompaniesData.map((companyData) => {
                      const companyName = companyData.name;
                      const isExpanded = expandedCompanies.has(companyName);
                      return (
                        <div key={companyName} className="hover:bg-gray-50 transition-colors">
                          {/* Company Header */}
                          <div className="px-6 py-4">
                            <div className="flex items-center justify-between">
                              <div 
                                className="flex items-center gap-4 flex-1 cursor-pointer"
                                onClick={() => handleCompanyClick(companyName)}
                              >
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <span className="text-lg font-bold text-blue-700">
                                    {getCompanyInitials(companyName)}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">{companyName}</h3>
                                  <p className="text-sm text-gray-500">
                                    {companyData.count} {companyData.count === 1 ? 'person' : 'people'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCompany(companyName);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <svg
                                  className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          {/* Company Contacts Preview - Show message to click for details */}
                          {isExpanded && (
                            <div className="bg-gray-50 border-t border-gray-200">
                              <div className="px-6 py-4 text-center">
                                <p className="text-gray-600 mb-4">
                                  Click on the company name above to view all {companyData.count} {companyData.count === 1 ? 'contact' : 'contacts'}
                                </p>
                                <button
                                  onClick={() => handleCompanyClick(companyName)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  View All Contacts
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
          /* Details View */
          <div className="bg-white border border-gray-200 overflow-hidden animate-fade-in">
            <div 
              className="overflow-x-auto overflow-y-auto" 
              style={{ 
                maxHeight: 'calc(100vh - 300px)',
                overscrollBehavior: 'contain',
                scrollBehavior: 'auto'
              }}
            >
              <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="w-12 px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedContacts.length === contacts.length && contacts.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded cursor-pointer"
                      />
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                      style={{ minWidth: '150px' }}
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        NAME
                        <svg className={`w-4 h-4 flex-shrink-0 ${sortColumn === 'name' ? 'text-gray-900' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '140px' }}>
                      JOB TITLE
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '180px' }}>
                      COMPANY
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '130px' }}>
                      CONTACT NUMBER
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '180px' }}>
                      EMAIL
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '110px' }}>
                      LINKEDIN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '140px' }}>
                      INDUSTRY
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" style={{ minWidth: '180px' }}>
                      KEYWORDS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedContacts.map((contact) => (
                    <tr
                      key={contact._id}
                      onClick={() => handleContactClick(contact._id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact._id)}
                          onChange={() => handleSelectContact(contact._id)}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 underline hover:text-gray-700">
                          {contact.name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {contact.title || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-700">
                              {getCompanyInitials(contact.company)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900">
                            {contact.company || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {contact.firstPhone ? (
                            <a
                              href={`tel:${contact.firstPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-gray-700 hover:underline"
                            >
                              {contact.firstPhone}
                            </a>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAccessEmail(contact, e);
                              }}
                              className="hover:text-gray-700 hover:underline"
                            >
                              {contact.email}
                            </a>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(contact.personLinkedinUrl || contact.companyLinkedinUrl) ? (
                          <a
                            href={contact.personLinkedinUrl || contact.companyLinkedinUrl}
                            onClick={(e) => e.stopPropagation()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors whitespace-nowrap"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            <span>LinkedIn</span>
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {contact.industry || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {contact.keywords ? (
                          <div 
                            className="text-sm text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const keywords = contact.keywords.split(',').map(k => k.trim()).filter(k => k);
                              if (keywords.length > 3) {
                                toggleKeywords(contact._id);
                              }
                            }}
                            title={contact.keywords}
                          >
                            {formatKeywords(contact)}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} contacts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (currentPage > 1) {
                        const newPage = currentPage - 1;
                        const params = { page: newPage.toString() };
                        if (category && category !== 'All') {
                          params.category = category;
                        }
                        if (searchParam) params.search = searchParam;
                        setSearchParams(params, { replace: true });
                      }
                    }}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            const params = { page: pageNum.toString() };
                            if (category && category !== 'All') {
                              params.category = category;
                            }
                            if (searchParam) params.search = searchParam;
                            setSearchParams(params, { replace: true });
                          }}
                          className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
                            currentPage === pageNum
                              ? 'bg-gray-900 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      if (currentPage < pagination.totalPages) {
                        const newPage = currentPage + 1;
                        const params = { page: newPage.toString() };
                        if (category && category !== 'All') {
                          params.category = category;
                        }
                        if (searchParam) params.search = searchParam;
                        setSearchParams(params, { replace: true });
                      }
                    }}
                    disabled={currentPage >= pagination.totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
