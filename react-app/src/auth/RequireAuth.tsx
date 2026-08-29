import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/" replace state={{ from }} />;
  }
  return <>{children}</>;
}
