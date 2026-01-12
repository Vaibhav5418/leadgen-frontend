import { useState, useEffect } from 'react';
import API from '../api/axios';

export default function BulkActivityLogModal({ isOpen, onClose, type, selectedContacts, projectId, contacts }) {
  const [formData, setFormData] = useState({
    template: '',
    outcome: '',
    conversationNotes: '',
    nextAction: '',
    nextActionDate: '',
    phoneNumber: '',
    email: '',
    linkedInUrl: '',
    status: '',
    linkedInAccountName: '',
    lnRequestSent: '',
    connected: '',
    callNumber: '',
    callStatus: '',
    callDate: '',
    emailDate: '',
    linkedinDate: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [savingField, setSavingField] = useState({ phone: false, email: false, linkedin: false });
  const [showVariations, setShowVariations] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
      setProgress({ current: 0, total: selectedContacts.size, success: 0, failed: 0 });
      
      // Get current date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Set current date as default based on activity type
      setFormData(prev => ({
        ...prev,
        callDate: type === 'call' ? today : '',
        emailDate: type === 'email' ? today : '',
        linkedinDate: type === 'linkedin' ? today : ''
      }));
    } else {
      setIsVisible(false);
      setFormData({
        template: '',
        outcome: '',
        conversationNotes: '',
        nextAction: '',
        nextActionDate: '',
        phoneNumber: '',
        email: '',
        linkedInUrl: '',
        status: '',
        linkedInAccountName: '',
        lnRequestSent: '',
        connected: '',
        callNumber: '',
        callStatus: '',
        callDate: '',
        emailDate: '',
        linkedinDate: ''
      });
      setErrors({});
      setShowVariations(false);
    }
  }, [isOpen, selectedContacts.size]);

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
        return 'Bulk Log Call Activity';
      case 'email':
        return 'Bulk Log Email Activity';
      case 'linkedin':
        return 'Bulk Log LinkedIn Activity';
      default:
        return 'Bulk Log Activity';
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

    // Status is required for Email and LinkedIn activities
    if (type === 'email' && !formData.status) {
      newErrors.status = 'Status is required';
    }

    if (type === 'linkedin' && !formData.status) {
      newErrors.status = 'Status is required';
    }

    // Conversation Notes is now optional - no validation needed

    // Next action is now optional - no validation needed
    // But if nextAction is provided, nextActionDate should also be provided
    if (formData.nextAction && !formData.nextActionDate) {
      newErrors.nextActionDate = 'Next action date is required when next action is specified';
    }

    if (formData.nextActionDate) {
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
    const selectedContactsList = Array.from(selectedContacts);
    const contactsToProcess = contacts.filter(c => selectedContactsList.includes((c._id || c.name).toString()));
    
    setProgress({ current: 0, total: contactsToProcess.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    try {
      // Process each contact sequentially
      for (let i = 0; i < contactsToProcess.length; i++) {
        const contact = contactsToProcess[i];
        // Get contactId - ensure we have a valid MongoDB ObjectId string
        let contactId = null;
        if (contact._id) {
          contactId = contact._id.toString ? contact._id.toString() : contact._id;
          // Only use if it's a valid MongoDB ObjectId (24 hex characters)
          if (typeof contactId === 'string' && contactId.length !== 24) {
            contactId = null;
          }
        }
        
        setProgress(prev => ({ ...prev, current: i + 1 }));

        try {
          // Include contact name and contact info in conversation notes for proper identification
          const contactInfo = [];
          if (contact.name && contact.name !== 'N/A') {
            contactInfo.push(`Contact: ${contact.name}`);
          }
          const finalEmail = formData.email || contact.email;
          const finalPhone = formData.phoneNumber || contact.firstPhone;
          const finalLinkedIn = formData.linkedInUrl || contact.personLinkedinUrl || contact.companyLinkedinUrl;
          
          if (finalEmail) {
            contactInfo.push(`Email: ${finalEmail}`);
          }
          if (finalPhone) {
            contactInfo.push(`Phone: ${finalPhone}`);
          }
          if (finalLinkedIn) {
            contactInfo.push(`LinkedIn: ${finalLinkedIn}`);
          }
          if (contactId) {
            contactInfo.push(`ID: ${contactId}`);
          }
          
          const notesWithContact = formData.conversationNotes.trim()
            ? (contactInfo.length > 0
              ? `${formData.conversationNotes}\n\n[${contactInfo.join(' | ')}]`
              : formData.conversationNotes)
            : (contactInfo.length > 0
              ? `[${contactInfo.join(' | ')}]`
              : '');

          const activityData = {
            projectId,
            type,
            template: formData.template,
            outcome: null, // Outcome is not used for any activity types
            conversationNotes: notesWithContact,
            nextAction: formData.nextAction,
            nextActionDate: formData.nextActionDate,
            phoneNumber: finalPhone || null,
            email: finalEmail || null,
            linkedInUrl: finalLinkedIn || null,
            status: formData.status || null,
            linkedInAccountName: formData.linkedInAccountName || null,
            lnRequestSent: formData.lnRequestSent || null,
            connected: formData.connected || null,
            callNumber: formData.callNumber || null,
            callStatus: formData.callStatus || null,
            callDate: formData.callDate || null,
            emailDate: formData.emailDate || null,
            linkedinDate: formData.linkedinDate || null
          };

          // Only include contactId if it's a valid MongoDB ObjectId
          if (contactId) {
            activityData.contactId = contactId;
          }

          const response = await API.post('/activities', activityData);

          // If status is provided and contactId exists, update the contact's status in ProjectContact
          if (response.data.success && formData.status && contactId && projectId) {
            try {
              await API.put(`/projects/${projectId}/project-contacts/${contactId}`, {
                stage: formData.status
              });
            } catch (error) {
              console.error('Error updating contact status:', error);
              // Don't fail the activity save if status update fails
            }
          }

          successCount++;
          setProgress(prev => ({ ...prev, success: successCount }));
        } catch (error) {
          console.error(`Error saving activity for ${contact.name}:`, error);
          failedCount++;
          setProgress(prev => ({ ...prev, failed: failedCount }));
        }
      }

      // Reset form and close modal
      setFormData({
        template: '',
        outcome: '',
        conversationNotes: '',
        nextAction: '',
        nextActionDate: '',
        phoneNumber: '',
        email: '',
        linkedInUrl: '',
        status: '',
        linkedInAccountName: '',
        callNumber: '',
        callStatus: '',
        callDate: '',
        emailDate: '',
        linkedinDate: ''
      });
      
      // Show success message
      setTimeout(() => {
        onClose();
        // Refresh activities will be handled by parent component
      }, 1000);
    } catch (error) {
      console.error('Error in bulk activity logging:', error);
      setErrors({ submit: 'Failed to save some activities. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        template: '',
        outcome: '',
        conversationNotes: '',
        nextAction: '',
        nextActionDate: '',
        phoneNumber: '',
        email: '',
        linkedInUrl: '',
        status: '',
        linkedInAccountName: '',
        lnRequestSent: '',
        connected: '',
        callNumber: '',
        callStatus: '',
        callDate: '',
        emailDate: '',
        linkedinDate: ''
      });
      setErrors({});
      setSavingField({ phone: false, email: false, linkedin: false });
      onClose();
    }
  };

  const handleSaveField = async (field, value, dbField) => {
    const selectedContactsList = Array.from(selectedContacts);
    const contactsToSave = contacts.filter(c => {
      const contactId = c._id?.toString();
      return selectedContactsList.includes((c._id || c.name).toString()) && 
             contactId && 
             typeof contactId === 'string' && 
             contactId.length === 24;
    });

    if (contactsToSave.length === 0) {
      setErrors({ submit: 'No valid contacts selected to save.' });
      return;
    }

    setSavingField(prev => ({ ...prev, [field]: true }));
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const contact of contactsToSave) {
        try {
          const contactId = contact._id.toString();
          await API.put(`/contacts/${contactId}`, { [dbField]: value || '' });
          successCount++;
        } catch (error) {
          console.error(`Error saving ${field} for ${contact.name}:`, error);
          failedCount++;
        }
      }
      
      if (successCount > 0) {
        setErrors({});
        // Update form data to reflect saved value
        if (field === 'phone') {
          setFormData(prev => ({ ...prev, phoneNumber: value || '' }));
        } else if (field === 'email') {
          setFormData(prev => ({ ...prev, email: value || '' }));
        } else if (field === 'linkedin') {
          setFormData(prev => ({ ...prev, linkedInUrl: value || '' }));
        }
      }
      
      if (failedCount > 0) {
        setErrors({ submit: `Saved ${field} for ${successCount} contact(s), but ${failedCount} failed.` });
      }
    } catch (error) {
      console.error(`Error saving ${field}:`, error);
      setErrors({ submit: `Failed to save ${field}. Please try again.` });
    } finally {
      setSavingField(prev => ({ ...prev, [field]: false }));
    }
  };


  const selectedContactsList = contacts.filter(c => selectedContacts.has((c._id || c.name).toString()));

  // Check if selected contacts have existing data
  const hasExistingPhone = selectedContactsList.some(c => c.firstPhone);
  const hasExistingEmail = selectedContactsList.some(c => c.email);
  const hasExistingLinkedIn = selectedContactsList.some(c => c.personLinkedinUrl || c.companyLinkedinUrl);

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
              {showVariations && (
                <button
                  onClick={() => setShowVariations(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all duration-200 group"
                  title="Back to form"
                >
                  <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div className="animate-pulse-once">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-0.5">
                  {showVariations && type === 'linkedin' ? 'LinkedIn Message Variations' : 
                   showVariations && type === 'email' ? 'Email Variations' : 
                   getTitle()}
                </h2>
                {!showVariations && (
                  <p className="text-xs text-gray-600 font-medium">
                    {selectedContactsList.length} {selectedContactsList.length === 1 ? 'contact' : 'contacts'} selected
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-all duration-200 group disabled:opacity-50"
            >
              <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {loading && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-900">
                Processing {progress.current} of {progress.total} contacts...
              </span>
              <span className="text-sm font-semibold text-blue-700">
                {progress.success} success, {progress.failed} failed
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Selected Contacts List */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 max-h-32 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-700 mb-2">Selected Contacts:</p>
          <div className="flex flex-wrap gap-2">
            {selectedContactsList.slice(0, 10).map((contact) => (
              <span key={contact._id || contact.name} className="px-2 py-1 bg-white text-xs font-medium text-gray-700 rounded-md border border-gray-200">
                {contact.name || 'N/A'}
              </span>
            ))}
            {selectedContactsList.length > 10 && (
              <span className="px-2 py-1 bg-blue-100 text-xs font-semibold text-blue-700 rounded-md">
                +{selectedContactsList.length - 10} more
              </span>
            )}
          </div>
        </div>

        {/* Form or Variations View */}
        {showVariations && type === 'linkedin' ? (
          <div className="p-4 bg-gray-50 overflow-y-auto flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-yellow-100">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Existing</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Variation 1</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Variation 2</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Variation 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">1st message</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">I'm usually in touch with teams managing residential projects and leasing, so I was just curious how you manage bookings, rentals, and property maintenance across your units.</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">I mostly connect with people working in residential and leasing roles—it keeps me close to how things really move on a day-to-day basis.</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">The world today feels like one connected marketplace, and being part of the real estate ecosystem, I enjoy connecting with people who are building and managing things on the ground. Looking forward to connecting and exchanging perspectives.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">2nd Message</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">I've noticed that no two property teams manage bookings, rentals, and maintenance the same way. I'm always interested in hearing how others handle it in practice.</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">Always open to exchanging thoughts and learning how things are shaping up on your side. Would be great to stay connected.</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">We work closely with property teams to simplify how day-to-day operations are managed — from rentals and billing to maintenance — so things feel more connected and easier to handle.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">3rd Message</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">Everyday operational conversations around properties quietly offer the most value in understanding how things really work.</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">Enjoy grounded conversations around real work and real challenges. Happy to stay connected and exchange insights whenever it makes sense.</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">We believe real value often comes from reducing small operational frictions and giving teams better visibility into what's happening across their properties.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">4th Message</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">I'm always interested in seeing how teams optimize their workflows—do you have any strategies that make managing bookings and maintenance simpler?</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">I value thoughtful conversations with people close to the work. Whenever it feels right, I'd enjoy exchanging insights as things evolve on your side.</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">No worries if you didn't catch my earlier message. Just checking if you're up for a chat about possible ways we can team up and grow together.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : showVariations && type === 'email' ? (
          <div className="p-4 bg-gray-50 overflow-y-auto flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-yellow-100">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300 w-[15%]">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Variation 1</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Variation 2</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Variation 3</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 border border-gray-300">Variation 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">1st Email</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>I work closely with people involved in residential projects and leasing, and I enjoy staying connected with those who are close to the day-to-day side of property work.</p>
                          <p>At Terabits, we focus on making everyday property operations a little easier by keeping rentals, billing, and maintenance in one place.</p>
                          <p>Happy to connect.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>I usually stay in touch with people working close to residential projects and leasing. I've found those conversations tend to be the most honest and practical.</p>
                          <p>I'm part of the Terabits team, where we focus on making everyday property operations easier to manage.</p>
                          <p>Nice to connect.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p className="font-semibold">Subject: Exchanging notes on leasing & residential work</p>
                          <p>Hi {{Name}},</p>
                          <p>I usually stay in touch with people working on residential projects and leasing. I've found these conversations to be the most practical.</p>
                          <p>When it comes to daily management, where do you usually find the most friction or "extra work" in your current process?</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>I tend to reach out to people in residential leasing because the conversations are usually more practical.</p>
                          <p>I'm curious—when it comes to your daily management, where do things usually get stuck or feel like a "headache" for your team?</p>
                          <p>Nice to connect,</p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">2nd Email</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>Just wanted to follow up on my last note.</p>
                          <p>We usually speak with property teams who want a bit more clarity in their daily workflows without changing how they already operate.</p>
                          <p>Always good to stay in touch.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>Just sharing a short follow-up.</p>
                          <p>Most of our discussions with property teams revolve around simplifying rentals, maintenance, and billing without adding extra complexity to daily work.</p>
                          <p>Happy to stay in touch.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>Most of our discussions with property teams revolve around simplifying rentals, maintenance, and billing.</p>
                          <p>This is where Terabits usually steps in—we focus on making those everyday operations feel less like a chore so you can focus on the bigger picture.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>That's usually where we come in. At Terabits, we focus on making those messy parts—like rentals, maintenance, and billing—feel a lot more manageable.</p>
                          <p>We try to keep the tech simple so it actually helps the team instead of adding more work to their day.</p>
                          <p>Happy to stay in touch,</p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">3rd Email</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>One thing we often notice is that small improvements in visibility can make day-to-day property work feel much more manageable.</p>
                          <p>Thought I'd share that with you.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>One thing I often hear is that even small clarity in systems can make a big difference in day-to-day property operations.</p>
                          <p>Thought I'd share that with you.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>One thing I often hear is that small clarity in systems makes a big difference.</p>
                          <p>Specifically, we help by automating the repetitive stuff—like tracking maintenance requests or streamlining billing workflows—without adding extra complexity to your day-to-day work.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>One thing I've noticed is that just adding a bit of clarity to maintenance tracking or billing can save a lot of hours.</p>
                          <p>We mostly help by automating those repetitive tasks so they just happen in the background. It's a small change that usually makes the day-to-day much smoother.</p>
                          <p>Thought I'd share that.</p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-900 bg-yellow-50 border border-gray-300 align-top">4th Email</td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>I'll leave it here for now.</p>
                          <p>If at any point it feels useful to exchange notes around property operations or workflows, I'm always happy to connect.</p>
                          <p>Wishing you a great week ahead.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>I won't take more of your time.</p>
                          <p>If at any point it feels useful to exchange notes around property operations or workflows, I'm always happy to connect.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>I won't take more of your time.</p>
                          <p>If at any point it feels useful to exchange notes around property operations or workflows, I'm always happy to connect.</p>
                          <p>Take care.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 border border-gray-300 align-top">
                        <div className="space-y-2">
                          <p>Hi {{Name}},</p>
                          <p>I'll leave it here as I don't want to crowd your inbox.</p>
                          <p>If you ever want to swap notes on how to make property workflows easier, I'm always happy to chat.</p>
                          <p>Wishing you the best,</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 bg-gray-50 overflow-y-auto flex-1">
            <div className="space-y-4">
            {/* Select Template - Only for Email and LinkedIn Activities */}
            {type !== 'call' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    Select Template (Optional)
                  </label>
                  {(type === 'linkedin' || type === 'email') && (
                    <button
                      type="button"
                      onClick={() => setShowVariations(true)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {type === 'email' ? 'View Email Variations' : 'View Message Variations'}
                    </button>
                  )}
                </div>
                <select
                  value={formData.template}
                  onChange={(e) => handleChange('template', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select an option</option>
                  <option value="no-template">No Template</option>
                  {type === 'email' ? (
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
              </div>
            )}

            {/* LinkedIn Account Name Field (Only for LinkedIn Activity) - BEFORE Status */}
            {type === 'linkedin' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  LinkedIn Account Used <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={formData.linkedInAccountName}
                    onChange={(e) => handleChange('linkedInAccountName', e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter LinkedIn account name used to send connection"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Name of the LinkedIn account that sent the connection request
                </p>
              </div>
            )}

            {/* Ln Request Sent and Connected Fields (Only for LinkedIn Activity) */}
            {type === 'linkedin' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Ln Request Sent <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <select
                    value={formData.lnRequestSent}
                    onChange={(e) => handleChange('lnRequestSent', e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select an option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Existing Connect">Existing Connect</option>
                    <option value="Inactive Profile">Inactive Profile</option>
                    <option value="Irrelevant Profile">Irrelevant Profile</option>
                    <option value="Open to Work">Open to Work</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Status of the LinkedIn connection request
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Connected <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <select
                    value={formData.connected}
                    onChange={(e) => handleChange('connected', e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select an option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Whether the connection was established
                  </p>
                </div>
              </div>
            )}

            {/* Status Field (For Email and LinkedIn Activities) */}
            {(type === 'email' || type === 'linkedin') && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  disabled={loading}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.status ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select status</option>
                  {type === 'email' ? (
                    <>
                      <option value="No Reply">No Reply</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Out of Office">Out of Office</option>
                      <option value="Meeting Proposed">Meeting Proposed</option>
                      <option value="Meeting Scheduled">Meeting Scheduled</option>
                      <option value="Interested">Interested</option>
                      <option value="Wrong Person">Wrong Person</option>
                      <option value="Bounce">Bounce</option>
                      <option value="Opt-Out">Opt-Out</option>
                      <option value="Meeting Completed">Meeting Completed</option>
                    </>
                  ) : (
                    <>
                      <option value="CIP">CIP</option>
                      <option value="No Reply">No Reply</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Meeting Proposed">Meeting Proposed</option>
                      <option value="Meeting Scheduled">Meeting Scheduled</option>
                      <option value="In-Person Meeting">In-Person Meeting</option>
                      <option value="Meeting Completed">Meeting Completed</option>
                      <option value="SQL">SQL</option>
                      <option value="Tech Discussion">Tech Discussion</option>
                      <option value="WON">WON</option>
                      <option value="Lost">Lost</option>
                      <option value="Low Potential - Open">Low Potential - Open</option>
                      <option value="Potential Future">Potential Future</option>
                    </>
                  )}
                </select>
                {errors.status && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1 animate-shake">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.status}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {type === 'email' ? 'Update the contact status based on this email interaction' : 'Update the contact status based on this interaction'}
                </p>
              </div>
            )}

            {/* Call Number and Date Field (Only for Call Activity) - BEFORE Outcome */}
            {type === 'call' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Call <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <select
                      value={formData.callNumber}
                      onChange={(e) => handleChange('callNumber', e.target.value)}
                      disabled={loading}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select call number</option>
                      <option value="1st call">1st call</option>
                      <option value="2nd call">2nd call</option>
                      <option value="3rd call">3rd call</option>
                    </select>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="date"
                      value={formData.callDate}
                      onChange={(e) => handleChange('callDate', e.target.value)}
                      disabled={loading}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Select call date"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Select which call attempt this is and the date when the call was made
                </p>
              </div>
            )}

            {/* Call Status Field (Only for Call Activity) - AFTER Call Number */}
            {type === 'call' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Status <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <select
                  value={formData.callStatus}
                  onChange={(e) => handleChange('callStatus', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select status</option>
                  <option value="Interested">Interested</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Ring">Ring</option>
                  <option value="Busy">Busy</option>
                  <option value="Call Back">Call Back</option>
                  <option value="Hang Up">Hang Up</option>
                  <option value="Switch Off">Switch Off</option>
                  <option value="Future">Future</option>
                  <option value="Details Shared">Details Shared</option>
                  <option value="Demo Booked">Demo Booked</option>
                  <option value="Invalid">Invalid</option>
                  <option value="Existing">Existing</option>
                  <option value="Demo Completed">Demo Completed</option>
                </select>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Select the status of this call
                </p>
              </div>
            )}

            {/* Phone Number Input (Only for Call Activity) */}
            {type === 'call' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Phone Number <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => handleChange('phoneNumber', e.target.value)}
                      disabled={loading || savingField.phone}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Add phone number (e.g., +1 234-567-8900)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveField('phone', formData.phoneNumber, 'firstPhone')}
                    disabled={loading || savingField.phone}
                    className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                    title="Save to database for all selected contacts"
                  >
                    {savingField.phone ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {hasExistingPhone 
                    ? "Some selected contacts have phone numbers in database. Enter a value to override or leave empty to use existing data."
                    : "This will be applied to all selected contacts. Click Save to store in database for all contacts with valid IDs."}
                </p>
              </div>
            )}

            {/* Email Input (Only for Email Activity) */}
            {type === 'email' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Email Address <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      disabled={loading || savingField.email}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Add email address (e.g., contact@example.com)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveField('email', formData.email, 'email')}
                    disabled={loading || savingField.email}
                    className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                    title="Save to database for all selected contacts"
                  >
                    {savingField.email ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {hasExistingEmail 
                    ? "Some selected contacts have emails in database. Enter a value to override or leave empty to use existing data."
                    : "This will be applied to all selected contacts. Click Save to store in database for all contacts with valid IDs."}
                </p>
              </div>
            )}

            {/* Email Date Field (Only for Email Activity) */}
            {type === 'email' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Email Date <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="date"
                    value={formData.emailDate}
                    onChange={(e) => handleChange('emailDate', e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Select email date"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Select the date when the email was sent
                </p>
              </div>
            )}

            {/* LinkedIn URL Input (Only for LinkedIn Activity) */}
            {type === 'linkedin' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  LinkedIn Profile URL <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                    </div>
                    <input
                      type="url"
                      value={formData.linkedInUrl}
                      onChange={(e) => handleChange('linkedInUrl', e.target.value)}
                      disabled={loading || savingField.linkedin}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Add LinkedIn profile URL (e.g., https://linkedin.com/in/username)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveField('linkedin', formData.linkedInUrl, 'personLinkedinUrl')}
                    disabled={loading || savingField.linkedin}
                    className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                    title="Save to database for all selected contacts"
                  >
                    {savingField.linkedin ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {hasExistingLinkedIn 
                    ? "Some selected contacts have LinkedIn URLs in database. Enter a value to override or leave empty to use existing data."
                    : "This will be applied to all selected contacts. Click Save to store in database for all contacts with valid IDs."}
                </p>
              </div>
            )}

            {/* LinkedIn Date Field (Only for LinkedIn Activity) */}
            {type === 'linkedin' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  LinkedIn Date <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="date"
                    value={formData.linkedinDate}
                    onChange={(e) => handleChange('linkedinDate', e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Select LinkedIn date"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Select the date when the LinkedIn activity occurred
                </p>
              </div>
            )}

            {/* Conversation Notes */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Conversation Notes <span className="text-gray-400 text-xs font-normal">(Optional)</span>
              </label>
              <textarea
                value={formData.conversationNotes}
                onChange={(e) => handleChange('conversationNotes', e.target.value)}
                disabled={loading}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-y font-sans hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Document key points, objections, interests, and next steps discussed. This will be applied to all selected contacts... (Optional)"
              />
            </div>

            {/* Next Action and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Next Action <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                </label>
                <select
                  value={formData.nextAction}
                  onChange={(e) => handleChange('nextAction', e.target.value)}
                  disabled={loading}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.nextAction}
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Next Action Date <span className={formData.nextAction ? 'text-red-500' : 'text-gray-400 text-xs font-normal'}>
                    {formData.nextAction ? '*' : '(Optional)'}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.nextActionDate}
                    onChange={(e) => handleChange('nextActionDate', e.target.value)}
                    disabled={loading}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.nextActionDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.nextActionDate && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.nextActionDate}
                  </p>
                )}
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
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Log Activity for {selectedContactsList.length} {selectedContactsList.length === 1 ? 'Contact' : 'Contacts'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

