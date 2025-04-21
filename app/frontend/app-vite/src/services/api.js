import axios from 'axios';

// Create a base axios instance with default config
const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for API calls
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Make sure token exists and is not undefined
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Auth header set:', config.headers.Authorization);
    } else {
      console.log('No token found in localStorage', 'Url:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
api.interceptors.response.use(
  (response) => {
    // Log successful responses
    if (response.config.url.includes('/login') || response.config.url.includes('/register')) {
      console.log('Auth response:', response.data);
      
      // If this is a login/register response with a token, log it
      if (response.data.access_token) {
        console.log('Token received:', response.data.access_token);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    console.log('API Error:', error.response?.status, error.response?.data, 'URL:', originalRequest?.url);
    
    // Handle authentication errors (401)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      console.log('401 error, clearing token');
      // Clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Make sure all axios calls use the same instance
// Override global axios defaults to use our configured instance
axios.defaults.baseURL = api.defaults.baseURL;
axios.interceptors.request.use(api.interceptors.request.handlers[0].fulfilled, api.interceptors.request.handlers[0].rejected);
axios.interceptors.response.use(api.interceptors.response.handlers[0].fulfilled, api.interceptors.response.handlers[0].rejected);

// Authentication API calls
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getCurrentUser: () => api.get('/auth/user'),
  updateUser: (settings) => api.put('/auth/user', settings),
};

// Jobs API calls
export const jobsAPI = {
  getJobs: () => api.get('/api/jobs'),
  createJob: (jobData) => api.post('/api/jobs', jobData),
  deleteJob: (jobId) => api.delete(`/api/jobs/${jobId}`),
  updateJob: (jobId, jobData) => api.put(`/api/jobs/${jobId}`, jobData),
  getJobById: (jobId) => api.get(`/api/jobs/${jobId}`),
  searchJobs: (searchParams) => api.post('/api/search-jobs', searchParams),
  getSearchStatus: (searchId = null) => {
    if (searchId) {
      return api.get(`/api/search-status?search_id=${searchId}`);
    }
    return api.get('/api/search-status');
  },
};

// Conversations API calls
export const conversationsAPI = {
  getConversations: () => api.get('/api/conversations'),
  getConversation: (jobId) => api.get(`/api/jobs/${jobId}/conversation`),
  createConversation: (jobId) => api.post(`/api/jobs/${jobId}/conversation`),
  createMessage: (conversationId, messageData) => 
    api.post(`/api/conversations/${conversationId}/messages`, messageData),
  generateMessage: (data) => api.post('/api/generate-message', data),
};

export default api; 