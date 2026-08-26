import { apiFetch } from "./client";
import type { AdminUser, UserStatus } from "./types";

export function listUsers(filters?: { status?: UserStatus; sector?: string }): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>("/admin/users", { params: filters });
}

export function updateAccess(userId: string, status: UserStatus): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${userId}/access`, { method: "PATCH", body: { status } });
}
