import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("preserves the pending cultivar experiment separately", async ({ page }) => {
  await page.goto("/final-stage");
  await expect(page.getByRole("heading", { name: "The final cultivar experiment comes next." })).toBeVisible();
  await expect(page.getByText("Final stage · Pending dataset access", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Four routes. One fair test." })).toBeVisible();
});

test("analyzes inline with a T label, recorded lab CSV and measured evaluation", async ({ page, request }) => {
  const status = await request.get("/api/backend/api/v1/quality/status");
  expect(status.ok()).toBeTruthy();
  const model = await status.json();
  await page.goto("/analyze");
  await expect(page.getByRole("heading", { name: "Cotton analysis & measured results." })).toBeVisible();
  if (model.status !== "ready") {
    await expect(page.getByRole("button", { name: "Analyze cotton", exact: true })).toBeDisabled();
    await expect(page.getByText("Model unavailable", { exact: true })).toBeVisible();
    return;
  }
  await expect(page.getByRole("heading", { name: "How the analysis works" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Measured model results" })).toBeVisible();
  if (model.matching) {
    const accuracy = page.locator("dl > div").filter({ has: page.getByText("Accuracy", { exact: true }) });
    await expect(accuracy).toContainText(`${(model.matching.accuracy * 100).toFixed(1)}%`);
    await expect(page.getByText(/Matching-method comparison from shared outer folds/)).toHaveCount(0);
    await expect(page.getByText("Open the confusion matrix and per-lot results")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "All numeric property results" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    if (model.matching.installed_name) {
      await expect(page.getByText(`Installed matcher: ${model.matching.installed_name}`, { exact: true })).toBeVisible();
      await expect(page.getByText(/Target: 85.0%/)).toContainText(model.matching.target_met ? "met in this exploratory" : "not yet met");
    }
  }
  const folder = path.join(process.cwd(), "Lab Reports", "40's T5");
  const filename = fs.readdirSync(folder).filter((name) => name.endsWith(".jpeg")).sort()[0];
  await page.locator('input[type="file"]').first().setInputFiles(path.join(folder, filename));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole("button", { name: "Analyze cotton", exact: true }).click();
  await expect(page).toHaveURL(/\/analyze\?analysis=[a-f0-9]+$/);
  const id = new URL(page.url()).searchParams.get("analysis");
  try {
    const saved = await (await request.get(`/api/backend/api/v1/quality/analyses/${id}`)).json();
    expect(saved.reference).not.toBeNull();
    const lot = saved.reference.lot_id;
    if (model.matching?.installed_model) {
      expect(saved.reference.method).toBe(model.matching.installed_model);
      expect(saved.reference.matcher_name).toBe(model.matching.installed_name);
    }
    await expect(page.getByTestId("matched-type")).toHaveText(`Matched reference: ${lot}`);
    await expect(page.getByTestId("lab-micronaire")).toHaveText(saved.reference.report.average.micronaire.toFixed(2));
    await expect(page.getByTestId("lab-colour_grade")).toHaveText(saved.reference.report.average.colour_grade);
    await expect(page.getByRole("link", { name: `Download ${lot} lab CSV` })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    const labCsv = await request.get(`/api/backend/api/v1/quality/analyses/${id}/reference.csv`);
    expect(labCsv.ok()).toBeTruthy();
    expect(await labCsv.text()).toContain("recorded_lab_profile_not_photo_measurement");
    await page.getByRole("tab", { name: "Model estimates", exact: true }).click();
    const prediction = saved.properties.find((p: { key: string }) => p.key === "micronaire");
    await expect(page.getByTestId("quality-micronaire")).toHaveText(prediction.value.toFixed(2));
    const csv = await request.get(`/api/backend/api/v1/quality/analyses/${id}/csv`);
    expect(csv.ok()).toBeTruthy();
    expect(await csv.text()).toContain("experimental_estimate");
    await page.reload();
    await expect(page.getByTestId("matched-type")).toHaveText(`Matched reference: ${lot}`);
    await expect(page.getByTestId("lab-micronaire")).toHaveText(saved.reference.report.average.micronaire.toFixed(2));
    await expect(page.getByRole("heading", { name: "Measured model results" })).toBeVisible();
    const pdf = await request.get("/api/backend/api/v1/quality/report");
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole("link", { name: "Saved analyses", exact: true }).click();
    await expect(page.locator(`a[href="/quality/${id}"]`)).toBeVisible();
  } finally {
    expect((await request.delete(`/api/backend/api/v1/quality/analyses/${id}`)).ok()).toBeTruthy();
  }
});

test("shows a custom 404 page", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByText(/this page does not exist/i)).toBeVisible();
});
