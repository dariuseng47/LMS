import axios from 'axios';

import { CONFIG } from 'src/config-global';

import { STORAGE_KEY } from 'src/auth/context/jwt/constant';

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: '/api/calendar',
  auth: {
    me: '/auth/me',
    signIn: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },
  hospitals: {
    list: '/hospitals',
    details: (id) => `/hospitals/${id}`,
    dashboardSummary: (id) => `/hospitals/${id}/dashboard-summary`,
  },
  users: {
    list: '/users',
    details: (id) => `/users/${id}`,
  },
  fabricCategories: {
    list: '/fabric-categories',
  },
  fabricLots: {
    list: '/fabric-lots',
  },
  fabricItems: {
    list: '/fabric-items',
    details: (epc) => `/fabric-items/${epc}`,
    hold: (id) => `/fabric-items/${id}/hold`,
    decommission: (id) => `/fabric-items/${id}/decommission`,
  },
  devices: {
    list: '/devices',
  },
  departments: {
    list: '/departments',
    details: (id) => `/departments/${id}`,
  },
  cabinets: {
    list: '/cabinets',
    details: (id) => `/cabinets/${id}`,
    parLevels: (id) => `/cabinets/${id}/par-levels`,
  },
  scanSessions: {
    list: '/scan-sessions',
    details: (id) => `/scan-sessions/${id}`,
    report: (id) => `/scan-sessions/${id}/report`,
    confirm: (id) => `/scan-sessions/${id}/confirm`,
    cancel: (id) => `/scan-sessions/${id}/cancel`,
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/api/product/list',
    details: '/api/product/details',
    search: '/api/product/search',
  },
};

// withCredentials: true — จำเป็นสำหรับส่ง HttpOnly refresh_token cookie ไปกับ /auth/refresh
const axiosInstance = axios.create({ baseURL: CONFIG.serverUrl, withCredentials: true });

// คิวรอ request อื่นที่โดน 401 พร้อมกันระหว่างกำลัง refresh อยู่ (กันยิง /auth/refresh ซ้ำซ้อน)
let isRefreshing = false;
let pendingQueue = [];

function resolvePendingQueue(error, accessToken) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(accessToken);
  });
  pendingQueue = [];
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthFlowEndpoint =
      originalRequest?.url === endpoints.auth.signIn || originalRequest?.url === endpoints.auth.refresh;

    // 401 นอก auth flow เอง -> ลอง refresh token แล้ว retry request เดิมอัตโนมัติ (seamless refresh)
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthFlowEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((accessToken) => {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axiosInstance.post(endpoints.auth.refresh);
        const { accessToken } = data;

        sessionStorage.setItem(STORAGE_KEY, accessToken);
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        resolvePendingQueue(null, accessToken);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        resolvePendingQueue(refreshError, null);
        sessionStorage.removeItem(STORAGE_KEY);
        delete axiosInstance.defaults.headers.common.Authorization;
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject((error.response && error.response.data) || 'Something went wrong!');
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args) => {
  try {
    const [url, config] = Array.isArray(args) ? args : [args];

    const res = await axiosInstance.get(url, { ...config });

    return res.data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
};
