import { expect, test, type Page } from "@playwright/test";

const sector = { id: "sector-1", key: "company", label: "Company", is_custom: false };
const admin = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@example.com",
  username: "admin",
  position: "Administrator",
  role: "superAdmin",
  status: "granted",
  created_at: "2026-09-05T00:00:00Z",
  sectors: [],
};
const pendingUser = {
  id: "user-1",
  name: "Pending User",
  email: "pending@example.com",
  username: "pending",
  position: "Analyst",
  role: "user",
  status: "pending",
  created_at: "2026-09-05T00:00:00Z",
  sectors: [sector],
  granted: false,
};

async function mockAdminSession(page: Page) {
  await page.addInitScript(() => localStorage.setItem("kwg_token", "admin-token"));
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admin) }),
  );
  await page.route("**/api/v1/sectors", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([sector]) }),
  );
}

test.describe("admin workflows", () => {
  test("grants pending user access", async ({ page }) => {
    await mockAdminSession(page);
    await page.route("**/api/v1/admin/users", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([pendingUser]) }),
    );
    await page.route("**/api/v1/admin/gaps?status=open", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    await page.route("**/api/v1/admin/users/user-1/access", async (route) => {
      expect(route.request().method()).toBe("PATCH");
      expect(route.request().postDataJSON()).toEqual({ status: "granted" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...pendingUser, status: "granted", granted: true }),
      });
    });
    await page.goto("/admin");
    await expect(page.getByText("Pending User")).toBeVisible();
    await page.getByRole("button", { name: "Grant" }).click();

    await expect(page.getByRole("cell", { name: "Granted" })).toBeVisible();
    await expect(page.getByText("Access granted for Pending User")).toBeVisible();
  });

  test("filters users by search text", async ({ page }) => {
    await mockAdminSession(page);
    await page.route("**/api/v1/admin/users", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([pendingUser, { ...pendingUser, id: "user-2", name: "Other User" }]) }),
    );
    await page.route("**/api/v1/admin/gaps?status=open", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    await page.goto("/admin");
    await page.getByPlaceholder("Search...").fill("Other");

    await expect(page.getByText("Other User")).toBeVisible();
    await expect(page.getByText("Pending User")).toHaveCount(0);
  });

  test("assigns an open knowledge gap to an SME", async ({ page }) => {
    await mockAdminSession(page);
    const gap = {
      id: "gap-1",
      source_query_id: "query-1",
      question_text: "How do we onboard a customer?",
      asker_id: "user-1",
      status: "open",
      assigned_to_id: null,
      assigned_sector_id: null,
      created_at: "2026-09-05T00:00:00Z",
      assigned_at: null,
      resolved_at: null,
    };
    await page.route("**/api/v1/admin/users", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([pendingUser]) }),
    );
    await page.route("**/api/v1/admin/gaps?status=open", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([gap]) }),
    );
    await page.route("**/api/v1/admin/users?status=granted&sector=company", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ ...pendingUser, status: "granted", granted: true }]) }),
    );
    await page.route("**/api/v1/admin/gaps/gap-1/assign", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ assigned_sector_id: "sector-1", assigned_to_id: "user-1" });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...gap, status: "assigned", assigned_sector_id: "sector-1", assigned_to_id: "user-1" }) });
    });
    await page.goto("/admin");
    await page.getByRole("button", { name: "Knowledge Gaps" }).click();
    const row = page.getByRole("row").filter({ hasText: "How do we onboard a customer?" });
    await row.locator("select").nth(0).selectOption("sector-1");
    await row.locator("select").nth(1).selectOption("user-1");
    await row.getByRole("button", { name: "Assign" }).click();

    await expect(page.getByText("No knowledge gaps with status \"open\".")).toBeVisible();
  });
});