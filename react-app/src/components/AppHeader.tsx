import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AppHeader() {
  const { user, logout } = useAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `font-body-md text-body-md px-xs pb-1 transition-colors ${
      isActive
        ? "text-secondary font-bold border-b-2 border-secondary"
        : "text-on-surface-variant hover:text-secondary hover:bg-surface-container-low"
    }`;

  return (
    <header className="bg-surface border-b border-outline-variant flex justify-between items-center w-full px-lg py-md max-w-[1200px] mx-auto z-10 relative">
      <div className="flex items-center gap-xl">
        <h1 className="font-h3 text-h3 font-bold text-primary">Knowledge Assistant</h1>
        <nav className="hidden md:flex items-center gap-lg">
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          {user?.role === "superAdmin" && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-md">
        <span className="font-label text-label text-on-surface-variant hidden sm:inline">
          {user ? `${user.username} · ${user.role === "superAdmin" ? "Super Admin" : "App User"}` : ""}
        </span>
        <div className="h-6 w-px bg-outline-variant mx-sm" />
        <button
          onClick={logout}
          className="font-label text-label text-on-surface-variant hover:text-primary flex items-center gap-xs"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
