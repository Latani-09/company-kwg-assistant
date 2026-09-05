import { expect, test, type Page } from "@playwright/test";

const grantedUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  username: "tester",
  position: "Analyst",
  role: "user",
  status: "granted",
  created_at: "2026-09-05T00:00:00Z",
  sectors: [],
};

async function mockGrantedUserApi(page: Page) {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "test-token", token_type: "bearer" }),
    }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(grantedUser) }),
  );
  await page.route("**/api/v1/sectors", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

async function mockSectorsApi(page: Page) {
  await page.route("**/api/v1/sectors", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "sector-1", key: "company", label: "Company", is_custom: false }]),
    }),
  );
}

test.describe("authentication and route guards", () => {
  test("renders the login form and validates required fields", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Knowledge Assistant");
    await expect(page.getByRole("heading", { name: "KnowledgeAssistant" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();

    await page.getByRole("button", { name: /Access Workspace/ }).click();
    await expect(page.locator("input:invalid")).toHaveCount(2);
  });

  test("renders the sign-up form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Up" }).click();

    await expect(page.getByRole("textbox", { name: "Full Name" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Corporate Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Position" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request Access" })).toBeVisible();
  });

  test("requires a sector before submitting signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.getByRole("textbox", { name: "Full Name" }).fill("New User");
    await page.getByRole("textbox", { name: "Username" }).fill("newuser");
    await page.getByRole("textbox", { name: "Corporate Email" }).fill("newuser@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password");
    await page.getByRole("textbox", { name: "Position" }).fill("Analyst");
    await page.getByRole("button", { name: "Request Access" }).click();

    await expect(page.getByText("Select at least one sector.")).toBeVisible();
  });

  test("submits signup and shows pending access confirmation", async ({ page }) => {
    await mockSectorsApi(page);
    await page.route("**/api/v1/auth/signup", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ...grantedUser, status: "pending" }),
      }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.getByRole("textbox", { name: "Full Name" }).fill("New User");
    await page.getByRole("textbox", { name: "Username" }).fill("newuser");
    await page.getByRole("textbox", { name: "Corporate Email" }).fill("newuser@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password");
    await page.getByRole("textbox", { name: "Position" }).fill("Analyst");
    await page.getByRole("button", { name: "Company" }).click();
    await page.getByRole("button", { name: "Request Access" }).click();

    await expect(page.getByRole("heading", { name: "Access Pending" })).toBeVisible();
    await expect(page.getByText(/request has been submitted/i)).toBeVisible();
  });

  test("shows an error for invalid signin credentials", async ({ page }) => {
    await page.route("**/api/v1/auth/login", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "invalid_credentials" }) }),
    );
    await page.goto("/");
    await page.getByRole("textbox", { name: "Username" }).fill("wrong-user");
    await page.getByRole("textbox", { name: "Password" }).fill("wrong-password");
    await page.getByRole("button", { name: /Access Workspace/ }).click();

    await expect(page.getByText("Invalid username or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("redirects unauthenticated users from the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "KnowledgeAssistant" })).toBeVisible();
  });

  test("logs in and opens the dashboard", async ({ page }) => {
    await mockGrantedUserApi(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Username" }).fill("tester");
    await page.getByRole("textbox", { name: "Password" }).fill("password");
    await page.getByRole("button", { name: /Access Workspace/ }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Assistant", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  });

  test("redirects a regular user away from the admin page", async ({ page }) => {
    await mockGrantedUserApi(page);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Username" }).fill("tester");
    await page.getByRole("textbox", { name: "Password" }).fill("password");
    await page.getByRole("button", { name: /Access Workspace/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});