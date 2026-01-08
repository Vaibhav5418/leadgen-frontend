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
    // Ignore canceled requests - these are expected when components unmount or requests are aborted
    // Check multiple ways axios might indicate a canceled request
    const isCanceled = 
      (axios.isCancel && axios.isCancel(error)) ||
      error.name === 'CanceledError' || 
      error.message === 'canceled' || 
      error.code === 'ERR_CANCELED' ||
      (error.config && error.config.signal && error.config.signal.aborted);
    
    if (isCanceled) {
      // Silently handle canceled requests - don't log as errors
      return Promise.reject(error);
    }
    
    // Enhanced error logging with detailed information
    if (error.response) {
      // Server responded with error status
      console.error('API Error Response:', error.response.status, error.response.statusText);
      console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
      console.error('Request URL:', error.config?.baseURL + error.config?.url);
      console.error('Request Method:', error.config?.method?.toUpperCase());
    } else if (error.request) {
      // Request made but no response received
      console.error('API Network Error - No response received');
      console.error('Error Message:', error.message);
      console.error('Error Code:', error.code);
      console.error('Request URL:', error.config?.baseURL + error.config?.url);
    } else {
      // Error setting up request (only log if not a cancellation)
      console.error('API Request Setup Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default API;
