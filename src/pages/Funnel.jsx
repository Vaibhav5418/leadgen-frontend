import { useParams, useNavigate } from 'react-router-dom';

export default function Funnel() {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleButtonClick = (type) => {
    navigate(`/projects/${id}?funnel=${type}`);
  };

  const channels = [
    {
      id: 'cold-calling',
      title: 'Cold Calling',
      description: 'Manage phone outreach and call activities',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      color: 'green',
      accentColor: 'emerald'
    },
    {
      id: 'email',
      title: 'Email',
      description: 'Track email campaigns and responses',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'blue',
      accentColor: 'blue'
    },
    {
      id: 'linkedin',
      title: 'LinkedIn',
      description: 'Manage LinkedIn connections and messages',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
        </svg>
      ),
      color: 'indigo',
      accentColor: 'indigo'
    }
  ];

  const getColorClasses = (color, accentColor) => {
    const colorMap = {
      green: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        hoverBorder: 'hover:border-emerald-300',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        title: 'text-gray-900',
        description: 'text-gray-600',
        hoverBg: 'hover:bg-emerald-50',
        hoverShadow: 'hover:shadow-lg'
      },
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        hoverBorder: 'hover:border-blue-300',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        title: 'text-gray-900',
        description: 'text-gray-600',
        hoverBg: 'hover:bg-blue-50',
        hoverShadow: 'hover:shadow-lg'
      },
      indigo: {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        hoverBorder: 'hover:border-indigo-300',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        title: 'text-gray-900',
        description: 'text-gray-600',
        hoverBg: 'hover:bg-indigo-50',
        hoverShadow: 'hover:shadow-lg'
      }
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="mb-12">
          <button
            onClick={() => navigate(`/projects/${id}`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 mb-8 transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Prospect Management
          </button>
          
          <div className="mb-2">
            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-3">
              Sales Funnel
            </h1>
            <div className="w-16 h-0.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 rounded-full"></div>
          </div>
          <p className="text-base text-gray-600 mt-4">
            Select a channel to view and manage prospects
          </p>
        </div>

        {/* Channel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
          {channels.map((channel) => {
            const colors = getColorClasses(channel.color, channel.accentColor);
            return (
              <button
                key={channel.id}
                onClick={() => handleButtonClick(channel.id)}
                className={`group relative bg-white border-2 ${colors.border} ${colors.hoverBorder} rounded-xl p-8 text-left transition-all duration-200 ${colors.hoverBg} ${colors.hoverShadow} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${channel.accentColor}-500`}
              >
                {/* Icon Container */}
                <div className={`w-14 h-14 ${colors.iconBg} rounded-lg flex items-center justify-center mb-5 ${colors.iconColor} transition-colors duration-200`}>
                  {channel.icon}
                </div>
                
                {/* Content */}
                <div>
                  <h3 className={`text-xl font-semibold ${colors.title} mb-2`}>
                    {channel.title}
                  </h3>
                  <p className={`text-sm ${colors.description} leading-relaxed`}>
                    {channel.description}
                  </p>
                </div>

                {/* Subtle Arrow Indicator */}
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg className={`w-5 h-5 ${colors.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

