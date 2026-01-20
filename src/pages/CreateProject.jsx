import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../api/axios';

const STEPS = [
  { id: 1, label: 'Company Details' },
  { id: 2, label: 'Contact Person' },
  { id: 3, label: 'Campaign Details' },
  { id: 4, label: 'Channels' },
  { id: 5, label: 'ICP Definition' },
  { id: 6, label: 'Team Allocation' }
];

export default function CreateProject() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingProject, setLoadingProject] = useState(isEditMode);
  const [error, setError] = useState(null);

  // Form data state
  const [formData, setFormData] = useState({
    // Step 1: Company Details
    companyName: '',
    website: '',
    city: '',
    country: '',
    industry: '',
    companySize: '',
    companyDescription: '',

    // Step 2: Contact Person
    contactPerson: {
      fullName: '',
      designation: '',
      email: '',
      phoneNumber: '',
      linkedInProfileUrl: ''
    },

    // Step 3: Campaign Details
    campaignDetails: {
      servicesOffered: {
        leadGeneration: false,
        marketResearch: false,
        appointmentSetting: false,
        dataEnrichment: false
      },
      expectationsFromUs: '',
      leadQuotaCommitted: 0,
      startDate: '',
      endDate: ''
    },

    // Step 4: Channels
    channels: {
      linkedInOutreach: false,
      coldEmail: false,
      coldCalling: false
    },

    // Step 5: ICP Definition
    icpDefinition: {
      targetIndustries: '',
      targetJobTitles: '',
      companySizeMin: 0,
      companySizeMax: 1000,
      geographies: '',
      keywords: '',
      exclusionCriteria: ''
    },

    // Step 6: Team Allocation
    assignedTo: '',
    teamMembers: [] // Array of email addresses
  });

  const updateFormData = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const updateNestedFormData = (parent, child, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [child]: value
      }
    }));
  };

  const updateServicesOffered = (service, value) => {
    setFormData(prev => ({
      ...prev,
      campaignDetails: {
        ...prev.campaignDetails,
        servicesOffered: {
          ...prev.campaignDetails.servicesOffered,
          [service]: value
        }
      }
    }));
  };

  // Fetch project data when in edit mode
  useEffect(() => {
    const fetchProject = async () => {
      if (!isEditMode) return;

      try {
        setLoadingProject(true);
        const response = await API.get(`/projects/${id}`);
        
        if (response.data.success) {
          const project = response.data.data;
          
          // Format dates for date inputs (YYYY-MM-DD)
          const formatDateForInput = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
          };

          // Convert arrays to comma-separated strings for ICP Definition
          const arrayToString = (arr) => {
            return Array.isArray(arr) ? arr.join(', ') : '';
          };

          setFormData({
            companyName: project.companyName || '',
            website: project.website || '',
            city: project.city || '',
            country: project.country || '',
            industry: project.industry || '',
            companySize: project.companySize || '',
            companyDescription: project.companyDescription || '',
            contactPerson: {
              fullName: project.contactPerson?.fullName || '',
              designation: project.contactPerson?.designation || '',
              email: project.contactPerson?.email || '',
              phoneNumber: project.contactPerson?.phoneNumber || '',
              linkedInProfileUrl: project.contactPerson?.linkedInProfileUrl || ''
            },
            campaignDetails: {
              servicesOffered: {
                leadGeneration: project.campaignDetails?.servicesOffered?.leadGeneration || false,
                marketResearch: project.campaignDetails?.servicesOffered?.marketResearch || false,
                appointmentSetting: project.campaignDetails?.servicesOffered?.appointmentSetting || false,
                dataEnrichment: project.campaignDetails?.servicesOffered?.dataEnrichment || false
              },
              expectationsFromUs: project.campaignDetails?.expectationsFromUs || '',
              leadQuotaCommitted: project.campaignDetails?.leadQuotaCommitted || 0,
              startDate: formatDateForInput(project.campaignDetails?.startDate),
              endDate: formatDateForInput(project.campaignDetails?.endDate)
            },
            channels: {
              linkedInOutreach: project.channels?.linkedInOutreach || false,
              coldEmail: project.channels?.coldEmail || false,
              coldCalling: project.channels?.coldCalling || false
            },
            icpDefinition: {
              targetIndustries: arrayToString(project.icpDefinition?.targetIndustries),
              targetJobTitles: arrayToString(project.icpDefinition?.targetJobTitles),
              companySizeMin: project.icpDefinition?.companySizeMin || 0,
              companySizeMax: project.icpDefinition?.companySizeMax || 1000,
              geographies: arrayToString(project.icpDefinition?.geographies),
              keywords: arrayToString(project.icpDefinition?.keywords),
              exclusionCriteria: arrayToString(project.icpDefinition?.exclusionCriteria)
            },
            assignedTo: project.assignedTo || '',
            teamMembers: Array.isArray(project.teamMembers) && project.teamMembers.length > 0 
              ? project.teamMembers 
              : []
          });
        }
      } catch (err) {
        console.error('Error fetching project:', err);
        setError(err.response?.data?.error || 'Couldn\'t load the project details. Try refreshing the page.');
      } finally {
        setLoadingProject(false);
      }
    };

    fetchProject();
  }, [id, isEditMode]);

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.companyName.trim()) {
          setError('Company Name is required');
          return false;
        }
        return true;
      case 2:
        if (!formData.contactPerson.fullName.trim()) {
          setError('Full Name is required');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError(null);
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleStepClick = (stepId) => {
    // If clicking the current step, do nothing
    if (stepId === currentStep) return;

    // If navigating forward, validate the current step before moving
    if (stepId > currentStep) {
      if (!validateStep(currentStep)) {
        return;
      }
    }

    setError(null);
    setCurrentStep(stepId);
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? All unsaved data will be lost.')) {
      navigate('/projects');
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare data for API
      const projectData = {
        ...formData,
        icpDefinition: {
          ...formData.icpDefinition,
          // Convert comma-separated strings to arrays
          targetIndustries: formData.icpDefinition.targetIndustries,
          targetJobTitles: formData.icpDefinition.targetJobTitles,
          geographies: formData.icpDefinition.geographies,
          keywords: formData.icpDefinition.keywords,
          exclusionCriteria: formData.icpDefinition.exclusionCriteria
        }
      };

      let response;
      if (isEditMode) {
        response = await API.put(`/projects/${id}`, projectData);
      } else {
        response = await API.post('/projects', projectData);
      }

      if (response.data.success) {
        navigate('/projects');
      } else {
        setError(response.data.error || `Couldn't ${isEditMode ? 'update' : 'create'} the project. Something went wrong.`);
      }
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} project:`, err);
      setError(err.response?.data?.error || err.message || `Something went wrong trying to ${isEditMode ? 'update' : 'create'} the project. Try again.`);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => updateFormData('companyName', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter company name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => updateFormData('website', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateFormData('city', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter city"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => updateFormData('country', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter country"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => updateFormData('industry', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter industry"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Size</label>
                <select
                  value={formData.companySize}
                  onChange={(e) => updateFormData('companySize', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select size</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="501-1000">501-1000</option>
                  <option value="1000+">1000+</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Description</label>
              <textarea
                value={formData.companyDescription}
                onChange={(e) => updateFormData('companyDescription', e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="Enter company description"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Contact Person</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.contactPerson.fullName}
                onChange={(e) => updateNestedFormData('contactPerson', 'fullName', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
              <input
                type="text"
                value={formData.contactPerson.designation}
                onChange={(e) => updateNestedFormData('contactPerson', 'designation', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter designation"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.contactPerson.email}
                  onChange={(e) => updateNestedFormData('contactPerson', 'email', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.contactPerson.phoneNumber}
                  onChange={(e) => updateNestedFormData('contactPerson', 'phoneNumber', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn Profile URL</label>
              <input
                type="url"
                value={formData.contactPerson.linkedInProfileUrl}
                onChange={(e) => updateNestedFormData('contactPerson', 'linkedInProfileUrl', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://linkedin.com/in/username"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Campaign Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Services Offered</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.campaignDetails.servicesOffered.leadGeneration}
                    onChange={(e) => updateServicesOffered('leadGeneration', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Lead Generation</span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.campaignDetails.servicesOffered.marketResearch}
                    onChange={(e) => updateServicesOffered('marketResearch', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Market Research</span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.campaignDetails.servicesOffered.appointmentSetting}
                    onChange={(e) => updateServicesOffered('appointmentSetting', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Appointment Setting</span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.campaignDetails.servicesOffered.dataEnrichment}
                    onChange={(e) => updateServicesOffered('dataEnrichment', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Data Enrichment</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expectations from Us</label>
              <textarea
                value={formData.campaignDetails.expectationsFromUs}
                onChange={(e) => updateNestedFormData('campaignDetails', 'expectationsFromUs', e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="Enter expectations"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lead Quota Committed</label>
              <input
                type="number"
                value={formData.campaignDetails.leadQuotaCommitted}
                onChange={(e) => updateNestedFormData('campaignDetails', 'leadQuotaCommitted', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.campaignDetails.startDate}
                    onChange={(e) => updateNestedFormData('campaignDetails', 'startDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.campaignDetails.endDate}
                    onChange={(e) => updateNestedFormData('campaignDetails', 'endDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Channels</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Channel Selection</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.channels.linkedInOutreach}
                    onChange={(e) => updateNestedFormData('channels', 'linkedInOutreach', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">LinkedIn Outreach</span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.channels.coldEmail}
                    onChange={(e) => updateNestedFormData('channels', 'coldEmail', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Cold Email</span>
                </label>
                <label className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.channels.coldCalling}
                    onChange={(e) => updateNestedFormData('channels', 'coldCalling', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Cold Calling</span>
                </label>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">ICP Definition</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Industries (comma-separated)</label>
              <input
                type="text"
                value={formData.icpDefinition.targetIndustries}
                onChange={(e) => updateNestedFormData('icpDefinition', 'targetIndustries', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Technology, Healthcare, Finance"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Job Titles (comma-separated)</label>
              <input
                type="text"
                value={formData.icpDefinition.targetJobTitles}
                onChange={(e) => updateNestedFormData('icpDefinition', 'targetJobTitles', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., CEO, CTO, VP Sales"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Size Min</label>
                <input
                  type="number"
                  value={formData.icpDefinition.companySizeMin}
                  onChange={(e) => updateNestedFormData('icpDefinition', 'companySizeMin', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Size Max</label>
                <input
                  type="number"
                  value={formData.icpDefinition.companySizeMax}
                  onChange={(e) => updateNestedFormData('icpDefinition', 'companySizeMax', parseInt(e.target.value) || 1000)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1000"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Geographies (comma-separated)</label>
              <input
                type="text"
                value={formData.icpDefinition.geographies}
                onChange={(e) => updateNestedFormData('icpDefinition', 'geographies', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., USA, UK, Canada"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Keywords (comma-separated)</label>
              <input
                type="text"
                value={formData.icpDefinition.keywords}
                onChange={(e) => updateNestedFormData('icpDefinition', 'keywords', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., SaaS, Cloud, AI"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Exclusion Criteria (comma-separated)</label>
              <input
                type="text"
                value={formData.icpDefinition.exclusionCriteria}
                onChange={(e) => updateNestedFormData('icpDefinition', 'exclusionCriteria', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Government, Non-profit"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Team Allocation</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
              <input
                type="text"
                value={formData.assignedTo}
                onChange={(e) => updateFormData('assignedTo', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter assigned person name"
              />
              <p className="mt-2 text-xs text-gray-500">
                Enter the name of the person assigned to manage this project
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Team Members</label>
                <button
                  type="button"
                  onClick={() => {
                    const newMembers = [...formData.teamMembers, ''];
                    updateFormData('teamMembers', newMembers);
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  + Add Member
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Add team member email addresses to grant them access to this project
              </p>
              
              {formData.teamMembers.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">No team members added yet</p>
                  <button
                    type="button"
                    onClick={() => updateFormData('teamMembers', [''])}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Add first team member
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.teamMembers.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const newMembers = [...formData.teamMembers];
                          newMembers[index] = e.target.value.trim();
                          updateFormData('teamMembers', newMembers);
                        }}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="team.member@example.com"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newMembers = formData.teamMembers.filter((_, i) => i !== index);
                          updateFormData('teamMembers', newMembers);
                        }}
                        className="px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove team member"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Team members will be able to access this project, view all activities, create/edit entries, and their activities will appear in Team Performance.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loadingProject) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditMode ? 'Edit Project' : 'Create New Project'}
      </h1>

      {/* Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            const isPending = step.id > currentStep;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className="flex flex-col items-center flex-1 focus:outline-none"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      isCompleted
                        ? 'bg-blue-600 text-white'
                        : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isActive ? 'text-blue-600' : isPending ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        {renderStepContent()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-900 font-medium"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button
              onClick={handlePrevious}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
          )}
          {currentStep < STEPS.length ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Project' : 'Create Project & Map ICP')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
