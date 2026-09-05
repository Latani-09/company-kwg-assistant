import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";

import type { Sector, User } from "../api/types";

export const testSectors: Sector[] = [
  { id: "sector-product", key: "product", label: "Product", is_custom: false },
  { id: "sector-company", key: "company", label: "Company", is_custom: false },
];

export const testUser: User = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  username: "test-user",
  position: "Analyst",
  role: "user",
  status: "granted",
  created_at: "2026-01-01T00:00:00Z",
  sectors: [testSectors[0]],
};

export function mockJsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function renderWithRouter(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter>{children}</MemoryRouter>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
