import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SectorChips } from "../components/SectorChips";
import type { SignupSectorInput } from "../api/types";

type Tab = "login" | "signup";
type StatusModal = { kind: "pending" | "revoked" } | null;

export function AuthPage() {
  const { user, login, signup } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [statusModal, setStatusModal] = useState<StatusModal>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPosition, setSignupPosition] = useState("");
  const [signupSectors, setSignupSectors] = useState<SignupSectorInput[]>([]);
  const [signupBusy, setSignupBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  function switchTab(next: Tab) {
    setTab(next);
    setMessage(null);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoginBusy(true);
    const result = await login(loginUsername, loginPassword);
    setLoginBusy(false);
    if (result.ok) return;
    if (result.reason === "pending" || result.reason === "revoked") {
      setStatusModal({ kind: result.reason });
    } else {
      setMessage({ text: "Invalid username or password.", error: true });
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (signupSectors.length === 0) {
      setMessage({ text: "Select at least one sector.", error: true });
      return;
    }
    setSignupBusy(true);
    const result = await signup({
      name: signupName,
      username: signupUsername,
      email: signupEmail,
      password: signupPassword,
      position: signupPosition,
      sectors: signupSectors,
    });
    setSignupBusy(false);
    if (result.ok) {
      setStatusModal({ kind: "pending" });
      setSignupName("");
      setSignupUsername("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupPosition("");
      setSignupSectors([]);
    } else {
      setMessage({ text: result.message, error: true });
    }
  }

  function closeModal() {
    setStatusModal(null);
    switchTab("login");
  }

  const tabButtonClass = (isActive: boolean) =>
    `flex-1 py-md font-label text-label transition-colors border-b-2 ${
      isActive
        ? "text-primary border-secondary bg-surface-container-lowest"
        : "text-on-surface-variant border-transparent hover:bg-surface-container-low"
    }`;

  return (
    <div className="bg-surface min-h-screen flex items-center justify-center p-md md:p-margin-desktop relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-0">
        <span className="material-symbols-outlined text-[800px] text-primary" style={{ fontVariationSettings: "'FILL' 0" }}>
          lightbulb
        </span>
      </div>

      <div className="glass-panel rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] w-full max-w-[28rem] z-10 relative overflow-hidden bg-surface-container-lowest">
        <div className="p-lg border-b border-surface-container-highest text-center">
          <h1 className="font-h3 text-h3 text-primary tracking-tight">KnowledgeAssistant</h1>
          <p className="font-small text-small text-on-surface-variant mt-sm">Enterprise Intelligence Platform</p>
        </div>

        <div className="flex border-b border-surface-container-highest relative">
          <button className={tabButtonClass(tab === "login")} onClick={() => switchTab("login")}>
            Log In
          </button>
          <button className={tabButtonClass(tab === "signup")} onClick={() => switchTab("signup")}>
            Sign Up
          </button>
        </div>

        <div className="p-lg">
          {tab === "login" && (
            <div className="block animate-fade-in">
              <form className="space-y-md" onSubmit={handleLogin}>
                <div>
                  <label className="block font-label text-label text-on-surface mb-xs" htmlFor="login-username">
                    Username
                  </label>
                  <input
                    id="login-username"
                    className="input-field w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant"
                    placeholder="Enter username"
                    required
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-label text-label text-on-surface mb-xs" htmlFor="login-password">
                    Password
                  </label>
                  <input
                    id="login-password"
                    className="input-field w-full px-md py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant"
                    placeholder="••••••••"
                    required
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <button
                  className="w-full bg-[#3B82F6] hover:bg-blue-600 text-white font-small text-small py-sm rounded-lg transition-colors mt-lg flex items-center justify-center gap-xs disabled:opacity-60"
                  type="submit"
                  disabled={loginBusy}
                >
                  {loginBusy ? "Signing in…" : "Access Workspace"}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>
            </div>
          )}

          {tab === "signup" && (
            <div className="animate-fade-in">
              <form className="space-y-sm" onSubmit={handleSignup}>
                <div className="grid grid-cols-2 gap-sm">
                  <div>
                    <label className="block font-label text-label text-on-surface mb-xs" htmlFor="signup-name">
                      Full Name
                    </label>
                    <input
                      id="signup-name"
                      className="input-field w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant text-sm"
                      placeholder="Jane Doe"
                      required
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-label text-label text-on-surface mb-xs" htmlFor="signup-username">
                      Username
                    </label>
                    <input
                      id="signup-username"
                      className="input-field w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant text-sm"
                      placeholder="janedoe"
                      required
                      type="text"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-label text-label text-on-surface mb-xs" htmlFor="signup-email">
                    Corporate Email
                  </label>
                  <input
                    id="signup-email"
                    className="input-field w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant text-sm"
                    placeholder="jane@company.com"
                    required
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-sm">
                  <div>
                    <label className="block font-label text-label text-on-surface mb-xs" htmlFor="signup-password">
                      Password
                    </label>
                    <input
                      id="signup-password"
                      className="input-field w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant text-sm"
                      placeholder="••••••••"
                      required
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-label text-label text-on-surface mb-xs" htmlFor="signup-position">
                      Position
                    </label>
                    <input
                      id="signup-position"
                      className="input-field w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-on-surface placeholder:text-on-surface-variant text-sm"
                      placeholder="Analyst"
                      required
                      type="text"
                      value={signupPosition}
                      onChange={(e) => setSignupPosition(e.target.value)}
                    />
                  </div>
                </div>

                <SectorChips value={signupSectors} onChange={setSignupSectors} />

                <button
                  className="w-full bg-surface-container-highest border border-outline-variant hover:bg-surface-container transition-colors text-primary font-small text-small py-sm rounded-lg mt-md disabled:opacity-60"
                  type="submit"
                  disabled={signupBusy}
                >
                  {signupBusy ? "Submitting…" : "Request Access"}
                </button>
              </form>
            </div>
          )}

          {message && (
            <div
              className={`mt-md p-sm rounded-md font-small text-sm text-center ${
                message.error ? "bg-error-container text-on-error-container" : "bg-surface-container-highest text-primary"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>

      {statusModal && (
        <div className="fixed inset-0 bg-on-background/50 backdrop-blur-sm flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest p-lg rounded-xl shadow-lg max-w-[24rem] w-full border border-surface-container-highest">
            <div
              className={`flex items-center gap-sm mb-md ${
                statusModal.kind === "revoked" ? "text-error" : "text-on-tertiary-container"
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">
                {statusModal.kind === "revoked" ? "block" : "pending_actions"}
              </span>
              <h3 className="font-h3 text-h3">{statusModal.kind === "revoked" ? "Access Revoked" : "Access Pending"}</h3>
            </div>
            <p className="font-body-md text-body-md text-on-surface mb-lg">
              {statusModal.kind === "revoked"
                ? "Your workspace access has been revoked by an administrator. Contact your admin if you believe this is a mistake."
                : "Your request has been submitted to the platform administrators. You will receive an email once your workspace access is approved."}
            </p>
            <button
              className="w-full bg-surface-container border border-outline-variant hover:bg-surface-container-high transition-colors text-primary font-small text-small py-sm rounded-lg"
              onClick={closeModal}
            >
              Return to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
