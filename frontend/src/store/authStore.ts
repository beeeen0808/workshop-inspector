import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  googleLogin: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      await AsyncStorage.setItem('auth_token', data.token);
      set({ user: data.user, token: data.token, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  register: async (username: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      await AsyncStorage.setItem('auth_token', data.token);
      set({ user: data.user, token: data.token, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  googleLogin: async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/google/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Google login failed');
      }

      const data = await response.json();
      set({ user: data.user, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.log('Logout error:', e);
    }
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadToken: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        set({ token });
        await get().checkAuth();
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      set({ isLoading: false });
    }
  },

  checkAuth: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (response.ok) {
        const user = await response.json();
        set({ user, isAuthenticated: true, isLoading: false });
        return true;
      }
    } catch (e) {
      console.log('Auth check error:', e);
    }
    set({ user: null, isAuthenticated: false, isLoading: false });
    return false;
  },
}));
