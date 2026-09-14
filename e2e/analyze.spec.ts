import { expect, test } from "@playwright/test";

test.describe("final stage WIP", () => {
  test("shows the final-stage status page", async ({ page }) => {
    await page.goto("/analyze");

    await expect(page.getByRole("heading", { name: /what remains before cultivar classification/i })).toBeVisible();
    await expect(page.getByText("Dataset access", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Final model training", { exact: true })).toBeVisible();
    await expect(page.getByText("Not started", { exact: true })).toBeVisible();
    await expect(page.getByText("Final results", { exact: true })).toBeVisible();
    await expect(page.getByText("Not available", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: /catgo egyptian cotton fibre dataset/i })).toBeVisible();
    await expect(page.getByText(/Train four controlled routes/i)).toBeVisible();
  });

  test("shows a custom 404 page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByText(/this page does not exist/i)).toBeVisible();
  });
});
