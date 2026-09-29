import path from "node:path";

import { expect, test } from "@playwright/test";

const fixtures = {
  followers: path.resolve("tests/e2e/fixtures/followers_1.json"),
  following: path.resolve("tests/e2e/fixtures/following.json"),
};

test("imports, filters, keeps, reviews, and persists cleanup progress", async ({ page }) => {
  await page.goto("/");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import Instagram data" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([fixtures.followers, fixtures.following]);

  await expect(page.getByRole("status")).toContainText("Import complete");
  await expect(page.getByTestId("pending-count")).toHaveText("2");
  await expect(page.getByTestId("reviewed-count")).toHaveText("0");

  await page.getByRole("button", { name: "Following", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Following" })).toBeVisible();

  await page.getByRole("button", { name: "Not back" }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();
  await expect(page.locator(".accountRow").filter({ hasText: "dana" })).toBeVisible();
  await expect(page.locator(".accountRow").filter({ hasText: "alice" })).toHaveCount(0);

  await page.getByPlaceholder("Search").fill("dana");
  await expect(page.locator(".accountRow").filter({ hasText: "dana" })).toBeVisible();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByRole("button", { name: "Mutual" }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "alice" })).toBeVisible();

  await page.getByRole("button", { name: "Cleanup", exact: true }).click();

  const charlieRow = page.locator(".accountRow").filter({ hasText: "charlie" });
  await charlieRow.getByRole("button", { name: "Review charlie" }).click();

  let dialog = page.getByRole("dialog", { name: "Review charlie" });
  await expect(dialog.getByRole("link", { name: /Open in Instagram/ })).toHaveAttribute(
    "href",
    "https://www.instagram.com/charlie/",
  );
  await dialog.getByRole("button", { name: "Add to Keep list" }).click();
  await expect(dialog.getByRole("button", { name: "Remove from Keep list" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  const danaRow = page.locator(".accountRow").filter({ hasText: "dana" });
  await danaRow.getByRole("button", { name: "Review dana" }).click();

  dialog = page.getByRole("dialog", { name: "Review dana" });
  await dialog.getByRole("button", { name: "Mark as reviewed" }).click();
  await expect(dialog.getByRole("button", { name: "Move back to review queue" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(page.locator(".accountRow")).toHaveCount(0);

  await page.getByRole("button", { name: "Reviewed", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "dana" })).toBeVisible();

  await page.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("pending-count")).toHaveText("0");
  await expect(page.getByTestId("reviewed-count")).toHaveText("1");

  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  await page.getByRole("button", { name: "Reviewed", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "dana" })).toBeVisible();

  await page.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();
});

test("publishes PWA manifest and offline worker", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  expect(manifest.icons.length).toBeGreaterThan(0);

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.ok()).toBeTruthy();
  expect(await workerResponse.text()).toContain("ig-cleanup-v1");
});
