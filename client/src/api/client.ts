import axios, { type AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // TODO: Dispatch logout action
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    client.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    client.post('/auth/login', data),
  logout: () => client.post('/auth/logout'),
  getCurrentUser: () => client.get('/auth/me'),
};

// Product endpoints
export const productsAPI = {
  getAll: (params?: { category?: string; search?: string }) =>
    client.get('/products', { params }),
  getById: (id: number) => client.get(`/products/${id}`),
  create: (data: any) => client.post('/products', data),
  update: (id: number, data: any) => client.patch(`/products/${id}`, data),
  delete: (id: number) => client.delete(`/products/${id}`),
};

// Cart endpoints
export const cartAPI = {
  getCart: () => client.get('/cart'),
  addItem: (data: { productId: number; quantity: number }) =>
    client.post('/cart/items', data),
  updateItem: (id: number, data: { quantity: number }) =>
    client.patch(`/cart/items/${id}`, data),
  removeItem: (id: number) => client.delete(`/cart/items/${id}`),
};

// Order endpoints
export const ordersAPI = {
  create: (data: any) => client.post('/orders', data),
  getAll: () => client.get('/orders'),
  getById: (id: number) => client.get(`/orders/${id}`),
};

export default client;
