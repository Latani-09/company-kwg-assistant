import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import { ApiError } from "../api/client";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const userId = params.get("uid") ?? "";
  const username = params.get("username") ?? "";
  const token = params.get("token") ?? "";
  const linkIncomplete = !userId || !username || !token;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await resetPassword({ user_id: userId, username, token, new_password: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface min-h-screen flex items-center justify-center p-md md:p-margin-desktop relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-0">
        <span className="material-symbols-outlined text-[800px] text-primary" style={{ fontVariationSettings: "'FILL' 0" }}>
          lock_reset
        </span>
      </div>

      <div className="glass-panel rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] w-full max-w-[28rem] z-10 relative overflow-hidden bg-surface-container-lowest">
        <div className="p-lg border-b border-surface-container-highest text-center">
          <h1 className="font-h3 text-h3 text-primary tracking-tight">Reset Password</h1>
          {username && (
            <p className="font-small text-small text-on-surface-variant mt-sm">for @{username}</p>
          )}
        </div>

        <div className="p-lg">
          {linkIncomplete ? (
            <div className="text-center space-y-md">
              <p className="font-body-md text-body-md text-on-surface">
                This reset link is invalid or incomplete. Please request a new one from the login page.
              </p>
              <Link
                className="inline-block bg-surface-container border border-outline-variant hover:bg-surface-container-high transition-colors text-primary font-small text-small py-sm px-lg rounded-lg"
                to="/"
              >
                Back to Login
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-md">
              <div className="flex items-center justify-center gap-sm text-on-tertiary-container">
                <span className="material-symbols-outlined text-[24px]">check_circle</span>
                <h3 className="font-h3 text-h3">Password updated</h3>
              </div>
              <p className="font-body-md text-body-md text-on-surface">
                Your password has been reset. You can now log in with your new password.
              </p>
              <Link
                className="inline-block w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-small text-small py-sm rounded-lg transition-colors"
                to="/"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <form className="space-y-md" onSubmit={handleSubmit}>
              <div>
                <label className="block font-label text-label text-on-surface mb-xs" htmlFor="new-password">
                  New Password
                </label>
                <input
                  id="new-password"
                  className="input-field w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant"
                  placeholder="••••••••"
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label text-label text-on-surface mb-xs" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  className="input-field w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant"
                  placeholder="••••••••"
                  required
                  type="password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                className="w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-small text-small py-sm rounded-lg transition-colors mt-lg disabled:opacity-60"
                type="submit"
                disabled={busy}
              >
                {busy ? "Updating…" : "Update Password"}
              </button>
              {error && (
                <div className="p-sm rounded-md font-small text-sm text-center bg-error-container text-on-error-container">
                  {error}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
