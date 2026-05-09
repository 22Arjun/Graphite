import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('graphite_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle global errors (e.g., 401 Unauthorized)
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('graphite_token');
      window.dispatchEvent(new Event('auth-unauthorized'));
    }
    return Promise.reject(error);
  }
);

// -------------------------------------------------------
// Typed API helpers
// -------------------------------------------------------

export const ingestionApi = {
  trigger: (fullSync = false) =>
    api.post('/ingestion/trigger', { fullSync }),
  getJobs: () =>
    api.get('/ingestion/jobs'),
};

export const analysisApi = {
  triggerRepo: (repositoryId: string) =>
    api.post(`/analysis/trigger/${repositoryId}`),
  getStatus: (repositoryId: string) =>
    api.get(`/analysis/status/${repositoryId}`),
};

export const graphApi = {
  getBuilderGraph: () =>
    api.get('/graph/builder'),
  build: () =>
    api.post('/graph/build'),
};

export const recommendationApi = {
  getCollaborators: (limit = 5) =>
    api.get(`/recommendation/collaborators?limit=${limit}`),
};

export const scoringApi = {
  compute: () =>
    api.post('/scoring/compute'),
  getDimensions: () =>
    api.get('/scoring/dimensions'),
};
