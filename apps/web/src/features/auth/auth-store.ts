import type { AuthSession, Pharmacy, User } from "@pharmacy-os/types";
import { create } from "zustand";

import { loginRequest, setAccessToken } from "../../lib/api";


interface AuthState {
  accessToken: string | null;
  user: User | null;
  pharmacy: Pharmacy | null;
  permissions: string[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  hydrate: () => void;
  logout: () => void;
  setSession: (session: AuthSession) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("pharmacy-os-access-token"),
  user: null,
  pharmacy: null,
  permissions: [],
  isAuthenticated: Boolean(localStorage.getItem("pharmacy-os-access-token")),
  login: async (email, password) => {
    const session = await loginRequest(email, password);
    setAccessToken(session.accessToken);
    set({
      accessToken: session.accessToken,
      user: session.user,
      pharmacy: session.pharmacy,
      permissions: session.permissions,
      isAuthenticated: true
    });
  },
  hydrate: () => {
    const accessToken = localStorage.getItem("pharmacy-os-access-token");
    set({ accessToken, isAuthenticated: Boolean(accessToken) });
  },
  logout: () => {
    setAccessToken(null);
    set({ accessToken: null, user: null, pharmacy: null, permissions: [], isAuthenticated: false });
  },
  setSession: (session) => {
    setAccessToken(session.accessToken);
    set({
      accessToken: session.accessToken,
      user: session.user,
      pharmacy: session.pharmacy,
      permissions: session.permissions,
      isAuthenticated: true
    });
  }
}));
