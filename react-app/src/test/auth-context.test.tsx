import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";

import * as authApi from "../api/auth";
import { ApiError, getToken } from "../api/client";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { testUser } from "./test-utils";

vi.mock("../api/auth", () => ({
  login: vi.fn(),
  signup: vi.fn(),
  me: vi.fn(),
}));

function AuthProbe() {
  const { user, loading, login, signup, logout } = useAuth();
  const [loginResult, setLoginResult] = useState("");
  const [signupResult, setSignupResult] = useState("");

  return (
    <div>
      <output data-testid="loading">{String(loading)}</output>
      <output data-testid="user">{user?.username ?? "signed-out"}</output>
      <output data-testid="role">{user?.role ?? "none"}</output>
      <output data-testid="sectors">{user?.sectors.map((sector) => sector.key).join(",") ?? ""}</output>
      <output data-testid="login-result">{loginResult}</output>
      <output data-testid="signup-result">{signupResult}</output>
      <button onClick={() => void login("test-user", "password").then((result) => setLoginResult(result.ok ? "ok" : result.reason))}>
        Login
      </button>
      <button
        onClick={() =>
          void signup({
            name: "New User",
            email: "new@example.com",
            username: "new-user",
            password: "password",
            position: "Analyst",
            sectors: [{ key: "product", label: "Product" }],
          }).then((result) => setSignupResult(result.ok ? "ok" : result.message))
        }
      >
        Signup
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function renderAuthProbe() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(authApi.me).mockResolvedValue(testUser);
  });

  it("logs in, stores the token, and exposes the user", async () => {
    vi.mocked(authApi.login).mockResolvedValue({ access_token: "token-123", token_type: "bearer" });
    renderAuthProbe();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("test-user"));
    expect(getToken()).toBe("token-123");
    expect(authApi.me).toHaveBeenCalled();
    expect(screen.getByTestId("role").textContent).toBe("user");
    expect(screen.getByTestId("sectors").textContent).toBe("product");
  });

  it("handles invalid login without setting a token", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, "Incorrect username or password"));
    renderAuthProbe();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("signed-out"));
    expect(getToken()).toBeNull();
  });

  it("creates an account through signup", async () => {
    vi.mocked(authApi.signup).mockResolvedValue(testUser);
    renderAuthProbe();

    fireEvent.click(screen.getByRole("button", { name: "Signup" }));

    await waitFor(() => expect(authApi.signup).toHaveBeenCalledWith(expect.objectContaining({ username: "new-user" })));
    expect(screen.getByTestId("user").textContent).toBe("signed-out");
  });

  it.each([
    ["pending_access", "pending"],
    ["access_revoked", "revoked"],
  ])("maps %s login errors to the access state", async (detail, expected) => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(403, detail));
    renderAuthProbe();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(screen.getByTestId("login-result").textContent).toBe(expected));
  });

  it("returns signup validation errors to the caller", async () => {
    vi.mocked(authApi.signup).mockRejectedValue(new ApiError(400, "Email already registered"));
    renderAuthProbe();

    fireEvent.click(screen.getByRole("button", { name: "Signup" }));

    await waitFor(() => expect(screen.getByTestId("signup-result").textContent).toBe("Email already registered"));
  });

  it("recovers a stored token on mount", async () => {
    localStorage.setItem("kwg_token", "restored-token");
    renderAuthProbe();

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("test-user"));
    expect(authApi.me).toHaveBeenCalled();
  });

  it("clears an expired token when bootstrap fails", async () => {
    localStorage.setItem("kwg_token", "expired-token");
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, "Could not validate credentials"));
    renderAuthProbe();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("signed-out");
    expect(getToken()).toBeNull();
  });

  it("clears the token and user on logout", async () => {
    vi.mocked(authApi.login).mockResolvedValue({ access_token: "token-123", token_type: "bearer" });
    renderAuthProbe();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("test-user"));

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(screen.getByTestId("user").textContent).toBe("signed-out");
    expect(getToken()).toBeNull();
  });
});
