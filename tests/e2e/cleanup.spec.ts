import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const fixtures = {
  followers: path.resolve("tests/e2e/fixtures/followers_1.json"),
  following: path.resolve("tests/e2e/fixtures/following.json"),
};

async function importFixtures(page: Page) {
  await page.goto("/");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import Instagram data" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([fixtures.followers, fixtures.following]);
  await expect(page.getByRole("status")).toContainText("Import complete");
}

test("imports, filters, keeps, reviews, and persists cleanup progress", async ({ page }) => {
  await importFixtures(page);

  await expect(page.getByTestId("pending-count")).toHaveText("2");
  await expect(page.getByTestId("reviewed-count")).toHaveText("0");

  await page.getByRole("button", { name: "Following", exact: true }).click();
  await page.getByRole("button", { name: "Not back" }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();
  await expect(page.locator(".accountRow").filter({ hasText: "dana" })).toBeVisible();

  await page.getByPlaceholder("Search").fill("dana");
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();

  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  const charlieRow = page.locator(".accountRow").filter({ hasText: "charlie" });
  await charlieRow.getByRole("button", { name: "Review charlie" }).click();

  const dialog = page.getByRole("dialog", { name: "Review charlie" });
  await dialog.getByRole("button", { name: "Add to Keep list" }).click();
  await expect(dialog.getByRole("button", { name: "Remove from Keep list" })).toBeVisible();

  const dragZone = dialog.getByTestId("sheet-drag-zone");
  const dragBox = await dragZone.boundingBox();
  expect(dragBox).not.toBeNull();
  if (!dragBox) throw new Error("Drag zone was not measurable");

  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + 150, { steps: 5 });
  await page.mouse.up();
  await expect(dialog).toHaveCount(0);

  const danaRow = page.locator(".accountRow").filter({ hasText: "dana" });
  await danaRow.getByRole("button", { name: "Review dana" }).click();
  const danaDialog = page.getByRole("dialog", { name: "Review dana" });
  await danaDialog.getByRole("button", { name: "Mark as reviewed" }).click();
  await danaDialog.getByRole("button", { name: "Close" }).click();

  await page.reload();
  await expect(page.getByTestId("pending-count")).toHaveText("0");
  await expect(page.getByTestId("reviewed-count")).toHaveText("1");

  await page.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();
});

test("starts a sorted review session and resumes the current account after reload", async ({ page }) => {
  await importFixtures(page);

  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  await page.getByRole("combobox", { name: "Sort accounts" }).selectOption("za");

  const rows = page.locator(".accountRow");
  await expect(rows.first()).toContainText("dana");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Review dana" });
  await expect(dialog.getByTestId("session-progress")).toHaveText("Session 1 / 2");

  await dialog.getByRole("button", { name: "Next account" }).click();
  dialog = page.getByRole("dialog", { name: "Review charlie" });
  await expect(dialog.getByTestId("session-progress")).toHaveText("Session 2 / 2");
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.reload();
  await page.getByRole("button", { name: /Resume review session/ }).click();
  dialog = page.getByRole("dialog", { name: "Review charlie" });
  await expect(dialog.getByTestId("session-progress")).toHaveText("Session 2 / 2");

  await dialog.getByRole("button", { name: "Mark as reviewed" }).click();
  await expect(page.getByRole("status")).toContainText("Review session finished");
});

test("batch selection can move multiple cleanup accounts to Reviewed", async ({ page }) => {
  await importFixtures(page);

  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select charlie" }).click();
  await page.getByRole("button", { name: "Select dana" }).click();

  const batchBar = page.getByRole("toolbar", { name: "Batch actions" });
  await expect(batchBar).toContainText("2 selected");
  await batchBar.getByRole("button", { name: "Reviewed" }).click();

  await expect(page.locator(".accountRow")).toHaveCount(0);
  await page.getByRole("button", { name: "Reviewed", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();
  await expect(page.locator(".accountRow").filter({ hasText: "dana" })).toBeVisible();
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
