import { expect, test } from "@playwright/test";
import path from "node:path";

const SAMPLE = path.resolve(__dirname, "../data/samples/synthetic_sample_03.png");

test.describe("analyze → result → history", () => {
  test("uploads a sample, receives a (mock) prediction and finds it in history", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.getByRole("heading", { name: /raw cotton cultivar identification/i })).toBeVisible();

    await page.getByTestId("file-input").setInputFiles(SAMPLE);
    await expect(page.getByText("synthetic_sample_03.png")).toBeVisible();

    await page.getByRole("button", { name: /analyze cotton/i }).click();
    await page.waitForURL(/\/results\/[a-f0-9]+/);

    await expect(page.getByTestId("predicted-class")).toBeVisible();
    await expect(page.getByTestId("top-predictions")).toBeVisible();
    await expect(page.getByText(/calibrated confidence/i).first()).toBeVisible();

    // In mock mode the result must be clearly labelled as a demo.
    const modeBanner = page.getByTestId("mode-banner");
    if (await modeBanner.isVisible()) {
      await expect(page.getByTestId("mock-notice")).toContainText(/trained model not yet installed/i);
    }

    const id = page.url().split("/results/")[1];
    await page.goto("/history");
    await expect(page.getByRole("link", { name: /giza|unknown|variety/i }).first()).toBeVisible();
    await expect(page.locator(`a[href="/results/${id}"]:visible`).first()).toBeVisible();
  });

  test("rejects a non-image file client-side", async ({ page }) => {
    await page.goto("/analyze");
    await page.getByTestId("file-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("alert").filter({ hasText: /unsupported file type/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /analyze cotton/i })).toBeDisabled();
  });

  test("shows a custom 404 page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByText(/this page does not exist/i)).toBeVisible();
  });
});
