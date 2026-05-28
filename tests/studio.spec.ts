import { expect, test } from "@playwright/test";

test("filters rules and saves the current package into the bundle", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("Search label, source, target, transform").fill("identifier");
  await expect(page.getByText(/rules$/).first()).toContainText("/");

  await page.getByRole("button", { name: /Update in bundle|Add to bundle/ }).click();
  await expect(page.getByText("Saved in bundle")).toBeVisible();
});

test("duplicates a bundle package and previews the bundle manifest", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Duplicate" }).first().click();
  await expect(page.getByRole("button", { name: /Variant 2/ })).toBeVisible();
  await expect(page.getByText("interopmed-bundle.json")).toBeVisible();
});

test("loads a workflow template", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Workflow template").selectOption("labs");
  await expect(page.getByText("Loaded Lab result template.")).toBeVisible();
  await expect(page.getByRole("button", { name: "DiagnosticReport" })).toBeVisible();
});
