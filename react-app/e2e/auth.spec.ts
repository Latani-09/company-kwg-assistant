import { expect, test } from "@playwright/test";

test("auth page opens and switches to signup", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "KnowledgeAssistant" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Access Workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page.getByLabel("Full Name")).toBeVisible();
  await expect(page.getByLabel("Corporate Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request Access" })).toBeVisible();
});
