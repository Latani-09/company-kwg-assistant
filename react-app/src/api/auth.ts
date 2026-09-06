import { apiFetch } from "./client";
import type { Token, User, UserSignup } from "./types";

export function login(username: string, password: string): Promise<Token> {
  const body = new URLSearchParams({ username, password });
  return apiFetch<Token>("/auth/login", { method: "POST", body, auth: false });
}

export function signup(payload: UserSignup): Promise<User> {
  return apiFetch<User>("/auth/signup", { method: "POST", body: payload, auth: false });
}

export function me(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>("/auth/change-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
