// API Configuration and utility functions
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3004/api';

/**
 * Make API requests with proper error handling and token management
 */
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userData');
        window.location.href = '/';
      }
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

/**
 * Auth endpoints
 */
export const authAPI = {
  login: (email, password, role) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    }),

  register: (name, email, password, role, additionalData = {}) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        ...additionalData,
      }),
    }),

  getCurrentUser: () => apiCall('/auth/me'),

  verifyToken: () => apiCall('/auth/verify'),
};

/**
 * Teacher endpoints
 */
export const teacherAPI = {
  getStudents: () =>
    apiCall('/teacher/students', { method: 'GET' }),

  addStudent: (studentData) =>
    apiCall('/teacher/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    }),

  updateStudent: (studentId, studentData) =>
    apiCall(`/teacher/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    }),

  deleteStudent: (studentId) =>
    apiCall(`/teacher/students/${studentId}`, {
      method: 'DELETE',
    }),

  getAttendance: (studentId) =>
    apiCall(`/teacher/attendance/${studentId}`, { method: 'GET' }),

  recordAttendance: (attendanceData) =>
    apiCall('/teacher/attendance', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    }),

  recordMarks: (marksData) =>
    apiCall('/teacher/marks', {
      method: 'POST',
      body: JSON.stringify(marksData),
    }),

  recordBehavior: (behaviorData) =>
    apiCall('/teacher/behavior', {
      method: 'POST',
      body: JSON.stringify(behaviorData),
    }),
};

/**
 * Admin endpoints
 */
export const adminAPI = {
  getStudents: () =>
    apiCall('/admin/students', { method: 'GET' }),

  getTeachers: () =>
    apiCall('/admin/teachers', { method: 'GET' }),

  getReports: () =>
    apiCall('/admin/reports', { method: 'GET' }),

  getFees: () =>
    apiCall('/admin/fees', { method: 'GET' }),
};

/**
 * Parent endpoints (read-only access to their child's data)
 */
export const parentAPI = {
  getChildAttendance: () =>
    apiCall('/parent/attendance', { method: 'GET' }),

  getChildMarks: () =>
    apiCall('/parent/marks', { method: 'GET' }),

  getChildBehavior: () =>
    apiCall('/parent/behavior', { method: 'GET' }),

  getFeeStatus: () =>
    apiCall('/parent/fees', { method: 'GET' }),
};

export default apiCall;
