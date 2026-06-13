import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('fp_token');
    if (!token) {
      set({ user: null, loading: false });
      return;
    }

    try {
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }

      const json = await response.json();
      const user = json.data || json;
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    let json;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok) {
      const message = (json && json.message) || response.statusText;
      throw new Error(message);
    }

    const token = (json.data && json.data.token) || json.token;
    const user = (json.data && json.data.user) || json.user;

    localStorage.setItem('fp_token', token);
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('fp_token');
    set({ user: null });
  },
}));
