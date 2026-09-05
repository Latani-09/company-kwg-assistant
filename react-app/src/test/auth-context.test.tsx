import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

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

  return (
    <div>
      <output data-testid="loading">{String(loading)}</output>
      <output data-testid="user">{user?.username ?? "signed-out"}</output>
      <button onClick={() => void login("test-user", "password")}>
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
          })
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

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("test-user"));
    expect(getToken()).toBe("token-123");
    expect(authApi.me).toHaveBeenCalled();
  });

  it("handles invalid login without setting a token", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, "Incorrect username or password"));
    renderAuthProbe();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("signed-out"));
    expect(getToken()).toBeNull();
  });

  it("creates an account through signup", async () => {
    vi.mocked(authApi.signup).mockResolvedValue(testUser);
    renderAuthProbe();

    fireEvent.click(screen.getByRole("button", { name: "Signup" }));

    await waitFor(() => expect(authApi.signup).toHaveBeenCalledWith(expect.objectContaining({ username: "new-user" })));
    expect(screen.getByTestId("user")).toHaveTextContent("signed-out");
  });

  it("recovers a stored token on mount", async () => {
    localStorage.setItem("kwg_token", "restored-token");
    renderAuthProbe();

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("test-user"));
    expect(authApi.me).toHaveBeenCalled();
  });

  it("clears an expired token when bootstrap fails", async () => {
    localStorage.setItem("kwg_token", "expired-token");
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, "Could not validate credentials"));
    renderAuthProbe();

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("signed-out");
    expect(getToken()).toBeNull();
  });

  it("clears the token and user on logout", async () => {
    vi.mocked(authApi.login).mockResolvedValue({ access_token: "token-123", token_type: "bearer" });
    renderAuthProbe();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("test-user"));

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(screen.getByTestId("user")).toHaveTextContent("signed-out");
    expect(getToken()).toBeNull();
  });
});
