import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as adminUsersApi from "../api/adminUsers";
import * as gapsApi from "../api/gaps";
import * as sectorsApi from "../api/sectors";
import { AdminPage } from "../pages/AdminPage";
import type { AdminUser, Gap } from "../api/types";
import { testSectors, testUser } from "./test-utils";

vi.mock("../api/adminUsers", () => ({
  listUsers: vi.fn(),
  updateAccess: vi.fn(),
}));
vi.mock("../api/gaps", () => ({
  listGaps: vi.fn(),
  assignGap: vi.fn(),
  resolveGap: vi.fn(),
}));
vi.mock("../api/sectors", () => ({
  listSectors: vi.fn(),
}));
vi.mock("../components/AppHeader", () => ({
  AppHeader: () => <header>Header</header>,
}));
vi.mock("../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const grantedUser: AdminUser = {
  ...testUser,
  id: "user-granted",
  name: "Granted User",
  username: "granted-user",
  email: "granted@example.com",
  status: "granted",
  granted: true,
};

const pendingUser: AdminUser = {
  ...testUser,
  id: "user-pending",
  name: "Pending User",
  username: "pending-user",
  email: "pending@example.com",
  status: "pending",
  granted: false,
};

const openGap: Gap = {
  id: "gap-1",
  source_query_id: "query-1",
  question_text: "How do releases work?",
  asker_id: pendingUser.id,
  status: "open",
  assigned_to_id: null,
  assigned_sector_id: null,
  created_at: "2026-01-01T00:00:00Z",
  assigned_at: null,
  resolved_at: null,
};

const assignedGap: Gap = {
  ...openGap,
  status: "assigned",
  assigned_to_id: grantedUser.id,
  assigned_sector_id: testSectors[0].id,
  assigned_at: "2026-01-02T00:00:00Z",
};

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminUsersApi.listUsers).mockResolvedValue([grantedUser, pendingUser]);
    vi.mocked(adminUsersApi.updateAccess).mockResolvedValue({ ...pendingUser, status: "granted", granted: true });
    vi.mocked(sectorsApi.listSectors).mockResolvedValue(testSectors);
    vi.mocked(gapsApi.listGaps).mockResolvedValue([openGap]);
    vi.mocked(gapsApi.assignGap).mockResolvedValue(assignedGap);
    vi.mocked(gapsApi.resolveGap).mockResolvedValue({ ...assignedGap, status: "resolved" });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("displays users and filters them by status", async () => {
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText("Granted User")).toBeTruthy());
    expect(screen.getByText("Pending User")).toBeTruthy();

    const statusSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(statusSelect, { target: { value: "pending" } });

    expect(screen.queryByText("Granted User")).toBeNull();
    expect(screen.getByText("Pending User")).toBeTruthy();
    expect(statusSelect).toHaveProperty("value", "pending");
  });

  it("grants access and updates the user row", async () => {
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("Pending User")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() => expect(adminUsersApi.updateAccess).toHaveBeenCalledWith("user-pending", "granted"));
    expect(screen.getByText("Pending User").parentElement?.textContent).toContain("Granted");
  });

  it("requires confirmation before revoking access", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText("Granted User")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(adminUsersApi.updateAccess).not.toHaveBeenCalled();
  });

  it("assigns a gap to an SME and updates the gap status", async () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByRole("button", { name: "Knowledge Gaps" }));
    await waitFor(() => expect(screen.getByText("How do releases work?")).toBeTruthy());

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: testSectors[0].id } });
    await waitFor(() => expect(adminUsersApi.listUsers).toHaveBeenCalledWith({ status: "granted", sector: "product" }));
    fireEvent.change(selects[2], { target: { value: grantedUser.id } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() =>
      expect(gapsApi.assignGap).toHaveBeenCalledWith("gap-1", {
        assigned_sector_id: testSectors[0].id,
        assigned_to_id: grantedUser.id,
      }),
    );
    expect(screen.queryByText("How do releases work?")).toBeNull();
  });

  it("reloads gaps when the gap status filter changes", async () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByRole("button", { name: "Knowledge Gaps" }));
    await waitFor(() => expect(gapsApi.listGaps).toHaveBeenCalledWith("open"));

    const gapFilter = screen.getAllByRole("combobox")[0];
    fireEvent.change(gapFilter, { target: { value: "assigned" } });

    await waitFor(() => expect(gapsApi.listGaps).toHaveBeenCalledWith("assigned"));
    expect(gapFilter).toHaveProperty("value", "assigned");
  });
});
