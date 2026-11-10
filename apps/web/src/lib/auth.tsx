"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "./api";
import type { User } from "./types";

// The JWT is kept in localStorage for this academic project; the API re-checks
// roles and account status on every request, so the client never decides access.
const TOKEN_KEY = "cinemind_token";

interface AuthState {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readToken();
    if (!saved) {
      setReady(true);
      return;
    }
    apiFetch<{ user: User }>("/auth/me", { token: saved })
      .then((res) => {
        setToken(saved);
        setUser(res.user);
      })
      .catch(() => writeToken(null))
      .finally(() => setReady(true));
  }, []);

  const accept = (res: { token: string; user: User }) => {
    writeToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const login = useCallback(async (email: string, password: string) => {
    accept(await apiFetch("/auth/login", { method: "POST", body: { email, password } }));
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    accept(await apiFetch("/auth/register", { method: "POST", body: { username, email, password } }));
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    writeToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const can = useCallback((permission: string) => !!user?.permissions.includes(permission), [user]);

  return (
    <AuthContext.Provider value={{ user, token, ready, login, register, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
