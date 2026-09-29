import path from "node:path";

import { expect, test } from "@playwright/test";

const fixtures = {
  followers: path.resolve("tests/e2e/fixtures/followers_1.json"),
  following: path.resolve("tests/e2e/fixtures/following.json"),
};

test("imports, filters, keeps, reviews, and persists Instagram data", async ({ page }) => {
  await page.goto("/");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import Instagram data" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([fixtures.followers, fixtures.following]);

  await expect(page.getByRole("status")).toContainText("Import complete");
  await expect(page.locator(".metricCard > strong")).toHaveText("2");

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
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toHaveCount(0);

  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  const charlieRow = page.locator(".accountRow").filter({ hasText: "charlie" });
  await charlieRow.getByRole("button", { name: "Review charlie" }).click();

  const reviewDialog = page.getByRole("dialog", { name: "Review charlie" });
  await expect(reviewDialog).toBeVisible();
  await expect(reviewDialog.getByRole("link", { name: /Open in Instagram/ })).toHaveAttribute(
    "href",
    "https://www.instagram.com/charlie/",
  );
  await reviewDialog.getByRole("button", { name: "Add to Keep list" }).click();
  await expect(reviewDialog.getByRole("button", { name: "Remove from Keep list" })).toBeVisible();
  await reviewDialog.getByRole("button", { name: "Close" }).click();

  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toHaveCount(0);
  await expect(page.locator(".accountRow").filter({ hasText: "dana" })).toBeVisible();

  await page.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keep list" })).toBeVisible();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();

  await page.reload();
  await expect(page.locator(".metricCard > strong")).toHaveText("1");
  await page.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();
});
