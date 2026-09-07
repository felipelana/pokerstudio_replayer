import { create } from 'zustand';
import { accountApi, type Me } from '@/infrastructure/http/accountApi';
import { ApiError } from '@/infrastructure/http/client';
import { useAppStore } from './store';

export type AuthPhase = 'loading' | 'anonymous' | 'authenticated' | 'offline';

interface AuthState {
  phase: AuthPhase;
  user?: Me;
  /** Loads the current session; falls back to offline when the API is down. */
  refresh(): Promise<void>;
  login(email: string, password: string, rememberMe?: boolean): Promise<void>;
  logout(): Promise<void>;
  setUser(user: Me | undefined): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  phase: 'loading',

  async refresh() {
    try {
      const user = await accountApi.me();
      set({ user, phase: 'authenticated' });
      void useAppStore.getState().syncSkinsFromAccount();
    } catch (err) {
      // 401 means "not signed in"; anything else means the API is unreachable,
      // and the replayer keeps working on local data instead of blocking.
      set(err instanceof ApiError ? { user: undefined, phase: 'anonymous' } : { user: undefined, phase: 'offline' });
    }
  },

  async login(email, password, rememberMe) {
    const user = await accountApi.login(email, password, rememberMe);
    set({ user, phase: 'authenticated' });
    void useAppStore.getState().syncSkinsFromAccount();
  },

  async logout() {
    try {
      await accountApi.logout();
    } finally {
      set({ user: undefined, phase: 'anonymous' });
    }
  },

  setUser(user) {
    set({ user, phase: user ? 'authenticated' : 'anonymous' });
  },
}));
