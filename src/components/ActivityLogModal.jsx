import { useState, useEffect } from 'react';
import API from '../api/axios';

export default function ActivityLogModal({ isOpen, onClose, type, contactName, companyName, projectId, phoneNumber, email, linkedInProfileUrl }) {
  const [formData, setFormData] = useState({
    template: '',
    outcome: '',
    conversationNotes: '',
    nextAction: '',
    nextActionDate: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger animation after modal is mounted
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getIcon = () => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'call':
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className={`${iconClass} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
        );
      case 'email':
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className={`${iconClass} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case 'linkedin':
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
            <svg className={`${iconClass} text-white`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'call':
        return 'Log Call Activity';
      case 'email':
        return 'Log Email Activity';
      case 'linkedin':
        return 'Log LinkedIn Activity';
      default:
        return 'Log Activity';
    }
  };

  const getGradientClass = () => {
    switch (type) {
      case 'call':
        return 'from-green-50 to-emerald-50';
      case 'email':
        return 'from-blue-50 to-cyan-50';
      case 'linkedin':
        return 'from-blue-50 to-indigo-50';
      default:
        return 'from-gray-50 to-gray-100';
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.outcome) {
      newErrors.outcome = 'Outcome is required';
    }

    if (!formData.conversationNotes || formData.conversationNotes.trim().length < 50) {
      newErrors.conversationNotes = 'Conversation notes must be at least 50 characters';
    }

    if (!formData.nextAction) {
      newErrors.nextAction = 'Next action is required';
    }

    if (!formData.nextActionDate) {
      newErrors.nextActionDate = 'Next action date is required';
    } else {
      // Validate that next action date is within 7 days
      const selectedDate = new Date(formData.nextActionDate);
      const today = new Date();
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 7);
      
      if (selectedDate > maxDate) {
        newErrors.nextActionDate = 'Next action must be scheduled within 7 days';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      // Include contact name in conversation notes for better filtering
      const notesWithContact = contactName && contactName !== 'N/A' 
        ? `${formData.conversationNotes}\n\n[Contact: ${contactName}${email ? ` | ${email}` : ''}]`
        : formData.conversationNotes;
      
      const response = await API.post('/activities', {
        projectId,
        type,
        template: formData.template,
        outcome: formData.outcome,
        conversationNotes: notesWithContact,
        nextAction: formData.nextAction,
        nextActionDate: formData.nextActionDate
      });

      if (response.data.success) {
        // Reset form and close modal
        setFormData({
          template: '',
          outcome: '',
          conversationNotes: '',
          nextAction: '',
          nextActionDate: ''
        });
        onClose();
      } else {
        setErrors({ submit: response.data.error || 'Failed to save activity' });
      }
    } catch (error) {
      console.error('Error saving activity:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save activity';
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      template: '',
      outcome: '',
      conversationNotes: '',
      nextAction: '',
      nextActionDate: ''
    });
    setErrors({});
    onClose();
  };

  const getCharacterCountColor = () => {
    const count = formData.conversationNotes.length;
    if (count < 50) return 'text-red-500';
    if (count < 100) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div 
      className={`fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Gradient */}
        <div className={`bg-gradient-to-r ${getGradientClass()} border-b border-gray-200 p-4 flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="animate-pulse-once">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-0.5">{getTitle()}</h2>
                <p className="text-xs text-gray-600 font-medium">{contactName} - {companyName}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-all duration-200 group"
            >
              <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 overflow-y-auto flex-1">
          <div className="space-y-4">
            {/* Phone Number Display (Only for Call Activity) */}
            {type === 'call' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className={`text-sm ${phoneNumber ? 'text-gray-900 font-medium' : 'text-gray-500 italic'}`}>
                    {phoneNumber || 'No phone number'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Phone number from project contact information
                </p>
              </div>
            )}

            {/* Email Display (Only for Email Activity) */}
            {type === 'email' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-sm ${email ? 'text-gray-900 font-medium' : 'text-gray-500 italic'}`}>
                    {email || 'No email'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Email address from project contact information
                </p>
              </div>
            )}

            {/* LinkedIn Profile Display (Only for LinkedIn Activity) */}
            {type === 'linkedin' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  LinkedIn Profile
                </label>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  {linkedInProfileUrl ? (
                    <a
                      href={linkedInProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 font-medium hover:text-blue-700 hover:underline flex items-center gap-1 transition-colors"
                    >
                      {linkedInProfileUrl}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-sm text-gray-500 italic">
                      No LinkedIn Profile
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  LinkedIn profile URL from project contact information
                </p>
              </div>
            )}

            {/* Select Template */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Select Template (Optional)
              </label>
              <select
                value={formData.template}
                onChange={(e) => handleChange('template', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400"
              >
                <option value="">Select an option</option>
                <option value="no-template">No Template</option>
                {type === 'call' ? (
                  <>
                    <option value="introduction-call-script">Introduction Call Script</option>
                    <option value="follow-up-call-script">Follow-up Call Script</option>
                  </>
                ) : type === 'email' ? (
                  <>
                    <option value="introduction-email">Introduction Email</option>
                    <option value="follow-up-email">Follow-up Email</option>
                    <option value="value-proposition-email">Value Proposition Email</option>
                  </>
                ) : type === 'linkedin' ? (
                  <>
                    <option value="connection-request-message">Connection Request Message</option>
                    <option value="introduction-message">Introduction Message</option>
                    <option value="follow-up-message">Follow-up Message</option>
                  </>
                ) : null}
              </select>
              <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Use a pre-defined template for consistency
              </p>
            </div>

            {/* Outcome */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Outcome <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.outcome}
                onChange={(e) => handleChange('outcome', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 ${
                  errors.outcome ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                <option value="">Select an option</option>
                {type === 'call' ? (
                  <>
                    <option value="connected-had-conversation">Connected - Had Conversation</option>
                    <option value="left-voicemail">Left Voicemail</option>
                    <option value="no-answer">No Answer</option>
                    <option value="wrong-number">Wrong Number</option>
                    <option value="not-interested">Not Interested</option>
                  </>
                ) : type === 'email' ? (
                  <>
                    <option value="email-sent-successfully">Email Sent Successfully</option>
                    <option value="email-bounced">Email Bounced</option>
                    <option value="received-reply">Received Reply</option>
                    <option value="out-of-office-response">Out of Office Response</option>
                  </>
                ) : type === 'linkedin' ? (
                  <>
                    <option value="connection-request-sent">Connection Request Sent</option>
                    <option value="message-sent">Message Sent</option>
                    <option value="connection-accepted">Connection Accepted</option>
                    <option value="received-reply">Received Reply</option>
                  </>
                ) : (
                  <>
                    <option value="interested">Interested</option>
                    <option value="not-interested">Not Interested</option>
                    <option value="follow-up">Follow-up Required</option>
                    <option value="no-response">No Response</option>
                    <option value="meeting-scheduled">Meeting Scheduled</option>
                  </>
                )}
              </select>
              {errors.outcome && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1 animate-shake">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.outcome}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">What was the result of this interaction?</p>
            </div>

            {/* Conversation Notes */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Conversation Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.conversationNotes}
                onChange={(e) => handleChange('conversationNotes', e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-y font-sans ${
                  errors.conversationNotes ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Document key points, objections, interests, and next steps discussed..."
              />
              {errors.conversationNotes && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1 animate-shake">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {errors.conversationNotes}
                </p>
              )}
            </div>

            {/* Next Action and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Next Action <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.nextAction}
                  onChange={(e) => handleChange('nextAction', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 ${
                    errors.nextAction ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select an option</option>
                  <option value="follow-up-call">Follow-up Call</option>
                  <option value="send-proposal">Send Proposal</option>
                  <option value="schedule-meeting">Schedule Meeting</option>
                  <option value="send-email">Send Email</option>
                  <option value="connect-linkedin">Connect on LinkedIn</option>
                </select>
                {errors.nextAction && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1 animate-shake">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.nextAction}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">What should happen next?</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Next Action Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.nextActionDate}
                    onChange={(e) => handleChange('nextActionDate', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 ${
                      errors.nextActionDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                {errors.nextActionDate && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1 animate-shake">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.nextActionDate}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">When should this happen?</p>
              </div>
            </div>

            {/* Quality Check Requirements */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-blue-900 mb-2">Quality Check Requirements:</h3>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>Detailed notes are required for accurate tracking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>Next action must be scheduled within 7 days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>All fields are mandatory for activity validation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 animate-shake">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-medium text-red-700">{errors.submit}</p>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Activity
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
