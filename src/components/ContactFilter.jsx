import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function ContactFilter({ category, searchParam, onApplyFilters, onClearFilters }) {
  const [searchParams] = useSearchParams();
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef(null);

  // Get filter params from URL
  const filterKeywords = searchParams.get('filterKeywords') || '';
  const filterCity = searchParams.get('filterCity') || '';
  const filterState = searchParams.get('filterState') || '';
  const filterCountry = searchParams.get('filterCountry') || '';
  const filterHasLinkedIn = searchParams.get('filterHasLinkedIn') || '';
  const filterHasEmail = searchParams.get('filterHasEmail') || '';
  const filterHasPhone = searchParams.get('filterHasPhone') || '';

  const [filters, setFilters] = useState({
    keywords: '',
    city: '',
    state: '',
    country: '',
    hasLinkedIn: '',
    hasEmail: '',
    hasPhone: ''
  });

  // Sync filters with URL params
  useEffect(() => {
    setFilters({
      keywords: filterKeywords,
      city: filterCity,
      state: filterState,
      country: filterCountry,
      hasLinkedIn: filterHasLinkedIn,
      hasEmail: filterHasEmail,
      hasPhone: filterHasPhone
    });
  }, [filterKeywords, filterCity, filterState, filterCountry, filterHasLinkedIn, filterHasEmail, filterHasPhone]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilter]);

  const handleFilterChange = (filterName, value) => {
    // Trim whitespace for text inputs
    const processedValue = typeof value === 'string' ? value.trim() : value;
    setFilters(prev => ({
      ...prev,
      [filterName]: processedValue
    }));
  };

  const hasActiveFilters = () => {
    return !!(filterKeywords || filterCity || filterState || filterCountry || 
              filterHasLinkedIn || filterHasEmail || filterHasPhone);
  };

  const handleApplyFilters = () => {
    // Validate and clean filters before applying
    const cleanedFilters = {
      keywords: filters.keywords?.trim() || '',
      city: filters.city?.trim() || '',
      state: filters.state?.trim() || '',
      country: filters.country?.trim() || '',
      hasLinkedIn: filters.hasLinkedIn || '',
      hasEmail: filters.hasEmail || '',
      hasPhone: filters.hasPhone || ''
    };
    
    onApplyFilters(cleanedFilters);
    setShowFilter(false);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      keywords: '',
      city: '',
      state: '',
      country: '',
      hasLinkedIn: '',
      hasEmail: '',
      hasPhone: ''
    };
    setFilters(emptyFilters);
    onClearFilters();
    setShowFilter(false);
  };
  
  const getActiveFilterCount = () => {
    return [filterKeywords, filterCity, filterState, filterCountry, 
            filterHasLinkedIn, filterHasEmail, filterHasPhone]
      .filter(v => v !== '' && v !== null && v !== undefined).length;
  };

  return (
    <div className="relative" ref={filterRef}>
      <button
        onClick={() => setShowFilter(!showFilter)}
        className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg transition-all duration-200 font-semibold text-sm shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
          hasActiveFilters() 
            ? 'bg-blue-50 border-2 border-blue-500 text-blue-700 hover:bg-blue-100' 
            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100'
        }`}
        title="Filter contacts"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="hidden sm:inline">Filter</span>
        {hasActiveFilters() && (
          <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-semibold">
            {getActiveFilterCount()}
          </span>
        )}
      </button>

      {/* Filter Dropdown Panel */}
      {showFilter && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 animate-fade-in-down">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilter(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Keyword Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keyword
                  <span className="text-gray-400 font-normal ml-1">(searches in keywords field)</span>
                </label>
                <input
                  type="text"
                  value={filters.keywords}
                  onChange={(e) => handleFilterChange('keywords', e.target.value)}
                  placeholder="Enter keyword..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyFilters();
                    }
                  }}
                />
              </div>

              {/* City Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                  <span className="text-gray-400 font-normal ml-1">(case-insensitive)</span>
                </label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  placeholder="Enter city name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyFilters();
                    }
                  }}
                />
              </div>

              {/* State Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                  <span className="text-gray-400 font-normal ml-1">(case-insensitive)</span>
                </label>
                <input
                  type="text"
                  value={filters.state}
                  onChange={(e) => handleFilterChange('state', e.target.value)}
                  placeholder="Enter state name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyFilters();
                    }
                  }}
                />
              </div>

              {/* Country Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                  <span className="text-gray-400 font-normal ml-1">(case-insensitive)</span>
                </label>
                <input
                  type="text"
                  value={filters.country}
                  onChange={(e) => handleFilterChange('country', e.target.value)}
                  placeholder="Enter country name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyFilters();
                    }
                  }}
                />
              </div>

              {/* Has Email Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Has Email
                  <span className="text-gray-400 font-normal ml-1">(valid email format)</span>
                </label>
                <select
                  value={filters.hasEmail}
                  onChange={(e) => handleFilterChange('hasEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors cursor-pointer"
                >
                  <option value="">All Contacts</option>
                  <option value="yes">Has Valid Email</option>
                  <option value="no">No Valid Email</option>
                </select>
              </div>

              {/* Has LinkedIn Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Has LinkedIn
                  <span className="text-gray-400 font-normal ml-1">(person or company)</span>
                </label>
                <select
                  value={filters.hasLinkedIn}
                  onChange={(e) => handleFilterChange('hasLinkedIn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors cursor-pointer"
                >
                  <option value="">All Contacts</option>
                  <option value="yes">Has LinkedIn URL</option>
                  <option value="no">No LinkedIn URL</option>
                </select>
              </div>

              {/* Has Phone Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Has Phone
                  <span className="text-gray-400 font-normal ml-1">(phone number available)</span>
                </label>
                <select
                  value={filters.hasPhone}
                  onChange={(e) => handleFilterChange('hasPhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors cursor-pointer"
                >
                  <option value="">All Contacts</option>
                  <option value="yes">Has Phone Number</option>
                  <option value="no">No Phone Number</option>
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleClearFilters}
                disabled={!hasActiveFilters()}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasActiveFilters()
                    ? 'text-gray-700 bg-gray-100 hover:bg-gray-200 cursor-pointer'
                    : 'text-gray-400 bg-gray-50 cursor-not-allowed'
                }`}
              >
                Clear All
              </button>
              <button
                onClick={handleApplyFilters}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Apply Filters
              </button>
            </div>
            
            {/* Active Filters Summary */}
            {hasActiveFilters() && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Active filters:</p>
                <div className="flex flex-wrap gap-2">
                  {filterKeywords && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                      Keyword: {filterKeywords}
                    </span>
                  )}
                  {filterCity && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                      City: {filterCity}
                    </span>
                  )}
                  {filterState && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                      State: {filterState}
                    </span>
                  )}
                  {filterCountry && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                      Country: {filterCountry}
                    </span>
                  )}
                  {filterHasEmail && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                      Email: {filterHasEmail === 'yes' ? 'Yes' : 'No'}
                    </span>
                  )}
                  {filterHasLinkedIn && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                      LinkedIn: {filterHasLinkedIn === 'yes' ? 'Yes' : 'No'}
                    </span>
                  )}
                  {filterHasPhone && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                      Phone: {filterHasPhone === 'yes' ? 'Yes' : 'No'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
