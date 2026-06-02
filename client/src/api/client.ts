import axios, { type AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export type ProductCategory = {
  id: number;
  name: string;
  slug: string;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  inventoryCount: number;
  createdAt: string;
  category: ProductCategory;
};

export type ProductListResponse = {
  products: Product[];
};

export type ProductDetailResponse = {
  product: Product;
};

export type ProductFormRequest = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  inventoryCount: number;
  categoryId: number;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt?: string;
};

export type AuthUserResponse = {
  user: User;
};

export type CartProduct = Pick<Product, 'id' | 'name' | 'price' | 'imageUrl' | 'inventoryCount' | 'category'>;

export type CartItem = {
  id: number;
  productId: number;
  quantity: number;
  lineTotal: string;
  product: CartProduct;
};

export type CartResponse = {
  items: CartItem[];
  subtotal: string;
};

export type CreateOrderRequest = {
  shipping: {
    fullName: string;
    address: string;
    city: string;
    zipCode: string;
  };
  payment: {
    cardNumber: string;
    expiry: string;
    cvc: string;
  };
};

export type OrderItem = {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  product: Pick<Product, 'id' | 'name' | 'imageUrl' | 'category'>;
};

export type Order = {
  id: number;
  userId: number;
  status: 'PENDING' | 'COMPLETED' | 'SHIPPED';
  totalAmount: string;
  createdAt: string;
  items: OrderItem[];
};

export type AdminOrder = Order & {
  customer: Pick<User, 'id' | 'name' | 'email'>;
};

export type CreateOrderResponse = {
  order: Order;
};

export type OrderDetailResponse = {
  order: Order;
};

export type AdminOrderListResponse = {
  orders: AdminOrder[];
};

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

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
      if (unauthorizedHandler) {
        unauthorizedHandler();
      } else {
        localStorage.removeItem('token');
      }
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
  getCurrentUser: () => client.get<AuthUserResponse>('/auth/me'),
};

// Product endpoints
export const productsAPI = {
  getAll: (params?: { category?: string; search?: string }) =>
    client.get<ProductListResponse>('/products', { params }),
  getById: (id: number) => client.get<ProductDetailResponse>(`/products/${id}`),
  create: (data: ProductFormRequest) => client.post<ProductDetailResponse>('/products', data),
  update: (id: number, data: ProductFormRequest) => client.patch<ProductDetailResponse>(`/products/${id}`, data),
  delete: (id: number) => client.delete(`/products/${id}`),
};

// Cart endpoints
export const cartAPI = {
  getCart: () => client.get<CartResponse>('/cart'),
  addItem: (data: { productId: number; quantity: number }) =>
    client.post<CartResponse>('/cart/items', data),
  updateItem: (id: number, data: { quantity: number }) =>
    client.patch<CartResponse>(`/cart/items/${id}`, data),
  removeItem: (id: number) => client.delete<CartResponse>(`/cart/items/${id}`),
};

// Order endpoints
export const ordersAPI = {
  create: (data: CreateOrderRequest) => client.post<CreateOrderResponse>('/orders', data),
  getAll: () => client.get<AdminOrderListResponse>('/orders'),
  getById: (id: number) => client.get<OrderDetailResponse>(`/orders/${id}`),
};

export default client;
