import axios from 'axios';

// Get base URL and ensure it ends with /api
const getBaseURL = () => {
  const envURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  // Remove trailing slash if present
  const cleanURL = envURL.replace(/\/$/, '');
  // Append /api if not already present
  return cleanURL.endsWith('/api') ? cleanURL : `${cleanURL}/api`;
};

const API = axios.create({
  baseURL: getBaseURL()
});

// Request interceptor
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  // Log the full URL for debugging (only in development)
  if (import.meta.env.DEV) {
    console.log('API Request:', req.method?.toUpperCase(), req.baseURL + req.url);
  }
  return req;
});

// Response interceptor for better error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging
    if (error.response) {
      // Server responded with error status
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url
      });
    } else if (error.request) {
      // Request made but no response received
      console.error('API Network Error:', {
        message: error.message,
        url: error.config?.baseURL + error.config?.url,
        code: error.code
      });
    } else {
      // Error setting up request
      console.error('API Request Setup Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default API;
