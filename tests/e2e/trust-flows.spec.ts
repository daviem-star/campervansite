import { expect, test } from "@playwright/test";

import {
  createTestUser,
  getLegacySeedData,
  primeSignedInSession,
  primeSignedOutState,
} from "./helpers";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("shows magic-link request UI when auth envs are present and user is signed out", async ({
  page,
}) => {
  await primeSignedOutState(page);
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Send magic link/i })).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill("traveller@example.com");
  await page.getByRole("button", { name: /Send magic link/i }).click();

  await expect(
    page.getByText(/Magic link sent to traveller@example.com/i),
  ).toBeVisible();
});

test("loads a signed-in cloud trip and saves an edit", async ({ page }) => {
  const user = createTestUser("save-flow");
  await primeSignedInSession(page, user);

  await page.goto("/");

  await expect(
    page.getByText(new RegExp(`Signed in as ${escapeRegExp(user.email ?? "")}`, "i")),
  ).toBeVisible();
  await expect(page.getByText(/Cloud trip loaded/i)).toBeVisible();

  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await page.getByPlaceholder("Stop title").fill("Barra Sands Campsite Updated");
  await page.getByRole("button", { name: /Update stop/i }).click();

  await expect(page.getByText(/Barra Sands Campsite Updated/i)).toBeVisible();
  await expect(page.getByText(/Cloud trip saved successfully/i)).toBeVisible();
});

test("imports existing local trips into the signed-in cloud account", async ({ page }) => {
  const user = createTestUser("import-flow");
  await primeSignedInSession(page, user, {
    legacyData: getLegacySeedData(),
  });

  await page.goto("/");

  await expect(page.getByRole("button", { name: /Import local trips/i })).toBeVisible();
  await page.getByRole("button", { name: /Import local trips/i }).click();

  await expect(page.getByText(/Imported 1 local trip into cloud sync/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Import local trips/i })).toHaveCount(0);
});

test("reopens the last synced trip offline in read-only mode", async ({ browser }) => {
  const user = createTestUser("offline-flow");
  const context = await browser.newContext();
  const page = await context.newPage();

  await primeSignedInSession(page, user);
  await page.goto("/");
  await expect(page.getByText(/Cloud trip loaded/i)).toBeVisible();

  await context.route(/\/api\/trips(\/.*)?$/, (route) => route.abort());

  const offlinePage = await context.newPage();
  await offlinePage.goto("/");

  await expect(
    offlinePage.getByText(/Unable to reach cloud sync\. Showing the last synced trip instead/i),
  ).toBeVisible();
  await expect(
    offlinePage.getByText(/This trip is read-only until the connection returns/i),
  ).toBeVisible();
  await expect(offlinePage.getByRole("button", { name: /\+ Stay/i })).toBeDisabled();

  await context.close();
});

test("recovers cleanly from a stale write conflict", async ({ browser }) => {
  const user = createTestUser("conflict-flow");

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await primeSignedInSession(pageA, user);
  await pageA.goto("/");
  await expect(pageA.getByText(/Cloud trip loaded/i)).toBeVisible();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await primeSignedInSession(pageB, user);
  await pageB.goto("/");
  await expect(pageB.getByText(/Cloud trip loaded/i)).toBeVisible();

  await pageA.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(pageA.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await pageA.getByPlaceholder("Stop title").fill("Conflict Winner Campsite");
  await pageA.getByRole("button", { name: /Update stop/i }).click();
  await expect(pageA.getByText(/Conflict Winner Campsite/i)).toBeVisible();

  await pageB.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(pageB.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await pageB.getByPlaceholder("Stop title").fill("Conflict Loser Campsite");
  await pageB.getByRole("button", { name: /Update stop/i }).click();

  await expect(
    pageB.getByText(/Trip changed on another device\. The latest version has been loaded/i),
  ).toBeVisible();
  await expect(pageB.getByText(/Conflict Winner Campsite/i)).toBeVisible();

  await contextA.close();
  await contextB.close();
});
