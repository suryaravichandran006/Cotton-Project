import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.skip(process.env.ANALYSIS_ONLY !== "true", "Requires an analysis-only build and server");

test("only exposes the analysis page and its required endpoints", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cotton analysis & measured results." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open saved analyses" })).toHaveCount(0);
  const redirect = await request.get("/analyze?analysis=abc", { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toMatch(/\/\?analysis=abc$/);
  for (const url of ["/architecture", "/models/leaf", "/models/seed", "/quality/history", "/api/backend/api/v1/quality/analyses", "/api/backend/api/v1/predictions", "/api/backend/docs"]) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
  expect((await request.delete(`/api/backend/api/v1/quality/analyses/${"a".repeat(32)}`)).status()).toBe(404);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("analyzes, downloads and restores one result on the home page", async ({ page, request }) => {
  await page.goto("/");
  const model = await (await request.get("/api/backend/api/v1/quality/status")).json();
  expect(model.status).toBe("ready");
  const folder = path.join(process.cwd(), "Lab Reports", "40's T5");
  const photo = fs.readdirSync(folder).filter(name => name.endsWith(".jpeg")).sort()[0];
  await page.locator('input[type="file"]').first().setInputFiles(path.join(folder, photo));
  await page.getByRole("button", { name: "Analyze cotton", exact: true }).click();
  await expect(page).toHaveURL(/\/\?analysis=[a-f0-9]{32}$/);
  const id = new URL(page.url()).searchParams.get("analysis");
  try {
    await expect(page.getByTestId("matched-type")).toBeVisible();
    const result = await (await request.get(`/api/backend/api/v1/quality/analyses/${id}`)).json();
    await expect(page.getByTestId("lab-micronaire")).toHaveText(result.reference.report.average.micronaire.toFixed(2));
    expect((await request.get(result.image.url)).ok()).toBeTruthy();
    expect((await request.get(`/api/backend/api/v1/quality/analyses/${id}/reference.csv`)).ok()).toBeTruthy();
    expect((await request.get("/api/backend/api/v1/quality/report")).ok()).toBeTruthy();
    await expect(page.getByRole("link", { name: "Open saved result" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Saved analyses", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("matched-type")).toHaveText(`Matched reference: ${result.reference.lot_id}`);
    await expect(page.getByText(/Target: 85.0%/)).toHaveCount(0);
  } finally {
    // QA only: clean up our own upload directly through the private local API.
    if (id && process.env.QA_BACKEND_URL) {
      expect((await request.delete(`${process.env.QA_BACKEND_URL}/api/v1/quality/analyses/${id}`)).ok()).toBeTruthy();
    }
  }
});
