import { expect, test, type Page } from "@playwright/test";
import type { QAEntry } from "../src/api/types";

const sector = { id: "sector-1", key: "company", label: "Company", is_custom: false };
const user = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  username: "tester",
  position: "Analyst",
  role: "user",
  status: "granted",
  created_at: "2026-09-05T00:00:00Z",
  sectors: [sector],
};

async function mockUserSession(page: Page) {
  await page.addInitScript(() => localStorage.setItem("kwg_token", "test-token"));
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }),
  );
  await page.route("**/api/v1/knowledge/qa?sector=sector-1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

test.describe("dashboard and knowledge base", () => {
  test("submits a chat question and renders the grounded answer source", async ({ page }) => {
    await mockUserSession(page);
    await page.route("**/api/v1/chat/query", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ question: "What is our policy?" });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "The policy is documented in the handbook.",
          sources: [{ id: "qa-1", question: "What is our policy?", answer: "The policy is documented in the handbook.", source: "Handbook-1" }],
          is_gap: false,
          confidence: 0.92,
        }),
      });
    });
    await page.goto("/dashboard");
    await page.getByPlaceholder("Ask a question...").fill("What is our policy?");
    await page.getByRole("button", { name: "send" }).click();

    await expect(page.getByText("The policy is documented in the handbook.")).toBeVisible();
    await expect(page.getByText("Handbook-1")).toBeVisible();
  });

  test("renders a knowledge gap response", async ({ page }) => {
    await mockUserSession(page);
    await page.route("**/api/v1/chat/query", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ answer: null, sources: [], is_gap: true, confidence: 0.1 }),
      }),
    );
    await page.goto("/dashboard");
    await page.getByPlaceholder("Ask a question...").fill("Unknown question");
    await page.getByRole("button", { name: "send" }).click();

    await expect(page.getByText("Gap Logged")).toBeVisible();
    await expect(page.getByText(/flagged this gap for review/i)).toBeVisible();
  });

  test("creates and deletes a knowledge-base document", async ({ page }) => {
    await mockUserSession(page);
    let entries: QAEntry[] = [];
    await page.route("**/api/v1/knowledge/qa*", async (route) => {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({
          sector_id: "sector-1",
          question: "Onboarding steps",
          answer: "Complete the onboarding checklist.",
          source: "Guide-1",
          gap_id: null,
        });
        entries = [{
          id: "qa-1",
          sector_id: "sector-1",
          question: "Onboarding steps",
          answer: "Complete the onboarding checklist.",
          source: "Guide-1",
          created_by: "user-1",
          created_at: "2026-09-05T00:00:00Z",
          updated_at: "2026-09-05T00:00:00Z",
        }];
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(entries[0]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(entries) });
    });
    await page.route("**/api/v1/knowledge/qa/qa-1", async (route) => {
      expect(route.request().method()).toBe("DELETE");
      entries = [];
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Add New Document" }).click();
    const documentForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save Document" }) });
    await documentForm.locator("input").nth(0).fill("Onboarding steps");
    await documentForm.locator("textarea").fill("Complete the onboarding checklist.");
    await documentForm.locator("input").nth(1).fill("Guide-1");
    await documentForm.getByRole("button", { name: "Save Document" }).click();
    await expect(page.getByText("Onboarding steps")).toBeVisible();

    await page.locator('button:has-text("delete")').click();
    await expect(page.getByText("Onboarding steps")).toHaveCount(0);
  });
});