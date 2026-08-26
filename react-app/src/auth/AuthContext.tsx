import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { ApiError, getToken, setToken } from "../api/client";
import type { User, UserSignup } from "../api/types";

export type LoginOutcome = { ok: true } | { ok: false; reason: "invalid" | "pending" | "revoked" };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginOutcome>;
  signup: (payload: UserSignup) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<LoginOutcome> => {
    try {
      const token = await authApi.login(username, password);
      setToken(token.access_token);
      const me = await authApi.me();
      setUser(me);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.detail === "pending_access") return { ok: false, reason: "pending" };
        if (err.detail === "access_revoked") return { ok: false, reason: "revoked" };
      }
      return { ok: false, reason: "invalid" };
    }
  }, []);

  const signup = useCallback(async (payload: UserSignup) => {
    try {
      await authApi.signup(payload);
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : "Something went wrong. Please try again.";
      return { ok: false as const, message };
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
