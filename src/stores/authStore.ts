import { create } from 'zustand'
import {
  getInitialAuthUser,
  signOut as signOutApi,
  subscribeToAuthChanges,
} from '@/lib/supabase/auth'
import type { AuthStatus, AuthUser } from '@/types/auth'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  /** Idempotent — safe to call from multiple mounts (e.g. React StrictMode). */
  initialize: () => Promise<void>
  setUser: (user: AuthUser | null) => void
  signOut: () => Promise<void>
}

let initialized = false

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  initialize: async () => {
    if (initialized) return
    initialized = true

    const user = await getInitialAuthUser()
    set({ user, status: user ? 'authenticated' : 'unauthenticated' })

    subscribeToAuthChanges((nextUser) => {
      set({ user: nextUser, status: nextUser ? 'authenticated' : 'unauthenticated' })
    })
  },

  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),

  signOut: async () => {
    await signOutApi()
    set({ user: null, status: 'unauthenticated' })
  },
}))
