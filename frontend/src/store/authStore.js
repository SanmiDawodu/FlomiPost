import { create } from 'zustand'
import { authApi } from '../utils/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,

  init: async () => {
    try {
      const res = await authApi.me();
      set({ user: res.data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    const res = await authApi.login(email, password);
    set({ user: res.data.user ?? res.data });
    return res;
  },

  logout: async () => {
    await authApi.logout().catch(() => {});
    set({ user: null });
  },

  isAdmin:  () => get().user?.role === 'admin',
  isEditor: () => ['admin','editor'].includes(get().user?.role),
}));
