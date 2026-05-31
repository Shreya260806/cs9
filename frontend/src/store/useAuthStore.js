import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      authChecked: false,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
      setAuthChecked: (authChecked) => set({ authChecked }),
    }),
    {
      name: 'rogare-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
)

export default useAuthStore
