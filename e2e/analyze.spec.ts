import { expect, test } from "@playwright/test";

test.describe("final stage WIP", () => {
  test("shows the final-stage status page", async ({ page }) => {
    await page.goto("/analyze");

    await expect(page.getByRole("heading", { name: /the decisive experiment has not started/i })).toBeVisible();
    await expect(page.getByText(/pending dataset access/i)).toBeVisible();
    await expect(page.getByText("~3,447", { exact: true })).toBeVisible();
    await expect(page.getByText("Final results", { exact: true })).toBeVisible();
    await expect(page.getByText(/four routes will answer one question/i)).toBeVisible();
    await expect(page.getByText(/ImageNet → Leaves → Seeds → Raw Cotton/i)).toBeVisible();
    await expect(page.getByText(/direct-transfer win or a negative-transfer result remains scientifically valid/i)).toBeVisible();
  });

  test("shows a custom 404 page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByText(/this page does not exist/i)).toBeVisible();
  });
});
