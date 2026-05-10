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
  trigger: () => api.post('/ingestion/trigger'),
};

export const analysisApi = {
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

export const profileApi = {
  update: (data: { displayName?: string; bio?: string }) =>
    api.patch('/builder/profile', data),
};

export const sourcesApi = {
  getSummary: () => api.get('/sources/summary'),
  // LinkedIn
  saveLinkedIn: (data: object) => api.post('/sources/linkedin', data),
  getLinkedIn: () => api.get('/sources/linkedin'),
  deleteLinkedIn: () => api.delete('/sources/linkedin'),
  // Twitter
  saveTwitter: (handle: string) => api.post('/sources/twitter', { handle }),
  getTwitter: () => api.get('/sources/twitter'),
  deleteTwitter: () => api.delete('/sources/twitter'),
  // Hackathons
  addHackathon: (data: object) => api.post('/sources/hackathon', data),
  getHackathons: () => api.get('/sources/hackathon'),
  updateHackathon: (id: string, data: object) => api.put(`/sources/hackathon/${id}`, data),
  deleteHackathon: (id: string) => api.delete(`/sources/hackathon/${id}`),
  // Resume
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/sources/resume', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getResume: () => api.get('/sources/resume'),
  deleteResume: () => api.delete('/sources/resume'),
};

export const formsApi = {
  create: (data: object) => api.post('/forms', data),
  list: () => api.get('/forms'),
  get: (id: string) => api.get(`/forms/${id}`),
  update: (id: string, data: object) => api.patch(`/forms/${id}`, data),
  remove: (id: string) => api.delete(`/forms/${id}`),
  sendEmail: (id: string, data: object) => api.post(`/forms/${id}/send-email`, data),
  listSubmissions: (id: string) => api.get(`/forms/${id}/submissions`),
  getSubmission: (submissionId: string) => api.get(`/forms/submissions/${submissionId}`),
  reanalyze: (submissionId: string) => api.post(`/forms/submissions/${submissionId}/reanalyze`),
  getPublicForm: (token: string) => api.get(`/forms/public/${token}`),
  submitForm: (token: string, formData: FormData) =>
    api.post(`/forms/public/${token}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
