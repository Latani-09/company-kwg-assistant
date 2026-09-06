import { useState, type FormEvent } from "react";
import { NavLink } from "react-router-dom";
import { changePassword } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "./Modal";

export function AppHeader() {
  const { user, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `font-body-md text-body-md px-xs pb-1 transition-colors ${
      isActive
        ? "text-secondary font-bold border-b-2 border-secondary"
        : "text-on-surface-variant hover:text-secondary hover:bg-surface-container-low"
    }`;

  function closeChangePassword() {
    if (savingPassword) return;
    setChangePasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(null);
    setPasswordError(false);
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(false);
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      setPasswordError(true);
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      logout();
    } catch (error) {
      setPasswordMessage(error instanceof ApiError ? error.detail : "Unable to change password.");
      setPasswordError(true);
    } finally {
      setSavingPassword(false);
    }
  }

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
          onClick={() => setChangePasswordOpen(true)}
          className="font-label text-label text-on-surface-variant hover:text-primary flex items-center gap-xs"
        >
          Change password
        </button>
        <button
          onClick={logout}
          className="font-label text-label text-on-surface-variant hover:text-primary flex items-center gap-xs"
        >
          Logout
        </button>
      </div>

      <Modal open={changePasswordOpen} onClose={closeChangePassword}>
        <div className="p-md border-b border-surface-variant flex justify-between items-center">
          <h2 className="font-h3 text-h3 text-primary">Change password</h2>
          <button
            type="button"
            className="text-on-surface-variant hover:text-primary"
            onClick={closeChangePassword}
            aria-label="Close change password dialog"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form className="p-md space-y-md" onSubmit={handleChangePassword}>
          <div>
            <label className="block font-small text-small text-primary mb-xs" htmlFor="current-password">
              Current password
            </label>
            <input
              id="current-password"
              className="w-full bg-surface border border-outline-variant rounded-md py-sm px-sm text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              required
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="block font-small text-small text-primary mb-xs" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              className="w-full bg-surface border border-outline-variant rounded-md py-sm px-sm text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              required
              minLength={8}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="block font-small text-small text-primary mb-xs" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              className="w-full bg-surface border border-outline-variant rounded-md py-sm px-sm text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              required
              minLength={8}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {passwordMessage && (
            <p className={`font-small text-small ${passwordError ? "text-error" : "text-secondary"}`}>
              {passwordMessage}
            </p>
          )}
          <div className="pt-sm flex justify-end gap-sm">
            <button
              type="button"
              className="px-md py-sm border border-outline-variant rounded-lg font-small text-small text-on-surface-variant hover:bg-surface-container-low transition-colors"
              onClick={closeChangePassword}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPassword}
              className="px-md py-sm bg-secondary text-on-secondary rounded-lg font-small text-small hover:bg-secondary/90 transition-colors disabled:opacity-60"
            >
              {savingPassword ? "Saving..." : "Change password"}
            </button>
          </div>
        </form>
      </Modal>
    </header>
  );
}
