import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const fixtures = {
  followers: path.resolve("tests/e2e/fixtures/followers_1.json"),
  following: path.resolve("tests/e2e/fixtures/following.json"),
  followers2: path.resolve("tests/e2e/fixtures/followers_2.json"),
  following2: path.resolve("tests/e2e/fixtures/following_reimport.json"),
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
  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  const charlieRow = page.locator(".accountRow").filter({ hasText: "charlie" });
  await charlieRow.getByRole("button", { name: "Review charlie" }).click();
  const dialog = page.getByRole("dialog", { name: "Review charlie" });
  await dialog.getByRole("button", { name: "Add to Keep list" }).click();
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
});

test("smart re-import previews relationship changes and parser diagnostics", async ({ page }) => {
  await importFixtures(page);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Update Instagram data" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles([fixtures.followers2, fixtures.following2]);

  const preview = page.getByRole("dialog", { name: "Import changes" });
  await expect(preview).toContainText("5 relationship changes");
  await expect(preview).toContainText(/\+2\s*new followers/);
  await expect(preview).toContainText("1 duplicates ignored");
  await preview.getByRole("button", { name: "Apply update" }).click();

  await expect(page.getByRole("status")).toContainText("Update complete");
  await expect(page.getByTestId("last-import-changes")).toContainText("5");
  await expect(page.getByTestId("pending-count")).toHaveText("1");
});

test("review session supports skip, previous, and undo", async ({ page }) => {
  await importFixtures(page);
  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  let dialog = page.getByRole("dialog", { name: "Review charlie" });
  await dialog.getByRole("button", { name: "Skip" }).click();
  dialog = page.getByRole("dialog", { name: "Review dana" });
  await dialog.getByRole("button", { name: "Previous account" }).click();
  dialog = page.getByRole("dialog", { name: "Review charlie" });
  await expect(dialog.getByTestId("session-progress")).toHaveText("Session 1 / 2");

  await dialog.getByRole("button", { name: "Mark as reviewed" }).click();
  dialog = page.getByRole("dialog", { name: "Review dana" });
  await dialog.getByRole("button", { name: "Undo last action" }).click();
  dialog = page.getByRole("dialog", { name: "Review charlie" });
  await expect(dialog.getByRole("button", { name: "Mark as reviewed" })).toBeVisible();
});

test("starts a sorted review session and resumes the current account after reload", async ({ page }) => {
  await importFixtures(page);
  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  await page.getByRole("combobox", { name: "Sort accounts" }).selectOption("za");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Review dana" });
  await expect(dialog.getByTestId("session-progress")).toHaveText("Session 1 / 2");
  await dialog.getByRole("button", { name: "Next account" }).click();
  dialog = page.getByRole("dialog", { name: "Review charlie" });
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Resume review session/ }).click();
  await expect(page.getByRole("dialog", { name: "Review charlie" }).getByTestId("session-progress")).toHaveText("Session 2 / 2");
});

test("batch selection can move multiple cleanup accounts to Reviewed", async ({ page }) => {
  await importFixtures(page);
  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select charlie" }).click();
  await page.getByRole("button", { name: "Select dana" }).click();
  const batchBar = page.getByRole("toolbar", { name: "Batch actions" });
  await batchBar.getByRole("button", { name: "Reviewed" }).click();
  await expect(page.locator(".accountRow")).toHaveCount(0);
});

test("exports, resets, and restores a versioned local backup", async ({ page }) => {
  await importFixtures(page);
  await page.getByRole("button", { name: "Cleanup", exact: true }).click();
  await page.locator(".accountRow").filter({ hasText: "charlie" }).getByRole("button", { name: "Review charlie" }).click();
  await page.getByRole("dialog", { name: "Review charlie" }).getByRole("button", { name: "Add to Keep list" }).click();
  await page.getByRole("dialog", { name: "Review charlie" }).getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Profile", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export app backup/ }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();
  if (!backupPath) throw new Error("Backup download path unavailable");

  await page.getByRole("button", { name: /Reset everything on this device/ }).click();
  const confirm = page.getByRole("alertdialog", { name: "Reset everything?" });
  await confirm.getByRole("button", { name: "Reset everything" }).click();
  await expect(page.getByRole("button", { name: "Import Instagram data" })).toBeVisible();

  await page.getByRole("button", { name: "Profile", exact: true }).click();
  const restoreChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Restore app backup/ }).click();
  const restoreChooser = await restoreChooserPromise;
  await restoreChooser.setFiles(backupPath);
  await expect(page.getByRole("status")).toContainText("Backup restored successfully");

  await page.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(page.locator(".accountRow").filter({ hasText: "charlie" })).toBeVisible();
});

test("publishes PWA manifest and offline worker", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.ok()).toBeTruthy();
});
