import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:3000', // URL del backend NestJS
});

// Interceptor para inyectar el token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
