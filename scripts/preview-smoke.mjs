import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const E2E_AUTH_STORAGE_KEY = "campervan_trip_planner_e2e_session";
const FORCE_DEMO_MODE_STORAGE_KEY = "campervan_trip_planner_force_demo_mode";

const readEnvFile = async (path) => {
  const text = await fs.readFile(path, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
};

const waitForVisible = async (locator, timeout = 30000) => {
  await locator.waitFor({ state: "visible", timeout });
};

const waitForAnyText = async (page, patterns, timeout = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (patterns.some((pattern) => pattern.test(bodyText))) {
      return bodyText;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for any of: ${patterns.map((p) => p.toString()).join(", ")}`);
};

const primeSession = async (context, storageKey, session) => {
  await context.addInitScript(
    ({ key, sessionValue, e2eKey, forceDemoKey }) => {
      window.localStorage.removeItem(e2eKey);
      window.localStorage.removeItem(forceDemoKey);
      window.localStorage.setItem(key, JSON.stringify(sessionValue));
    },
    {
      key: storageKey,
      sessionValue: session,
      e2eKey: E2E_AUTH_STORAGE_KEY,
      forceDemoKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};

const primeSignedOut = async (context) => {
  await context.addInitScript(
    ({ e2eKey, forceDemoKey }) => {
      window.localStorage.removeItem(e2eKey);
      window.localStorage.removeItem(forceDemoKey);
    },
    {
      e2eKey: E2E_AUTH_STORAGE_KEY,
      forceDemoKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};

const gotoPreview = async (page, shareUrl, baseUrl) => {
  await page.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  const currentUrl = page.url();
  if (!currentUrl.startsWith(baseUrl)) {
    throw new Error(`Unexpected preview URL after navigation: ${currentUrl}`);
  }
};

const ensureEditMode = async (page) => {
  const editTripButton = page.getByRole("button", { name: /Edit trip/i });
  await waitForVisible(editTripButton);
  await editTripButton.click();
  await waitForVisible(page.getByText(/Edit mode is unlocked/i).first());
};

const editFirstStopTitle = async (page, title) => {
  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await waitForVisible(page.getByRole("heading", { name: /Edit stop/i }));
  const titleInput = page.getByPlaceholder("Stop title");
  await titleInput.fill(title);
  await page.getByRole("button", { name: /Update stop/i }).click();
  await waitForVisible(page.getByText(title).first());
  await waitForVisible(page.getByText(/Cloud trip saved successfully/i).first());
};

const updateStayLocation = async (page) => {
  await page.getByRole("button", { name: /^Edit$/ }).nth(1).click();
  await waitForVisible(page.getByRole("heading", { name: /Edit stop/i }));

  const searchInput = page.getByPlaceholder("Search campsite");
  await searchInput.fill("Ob");
  await waitForVisible(page.getByText(/Type at least 3 characters, then press Search\./i));

  await searchInput.fill("Oban");
  await waitForVisible(page.getByText(/Press Search to look up this place\./i));
  const geocodeResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/geocode?q=Oban") && response.request().method() === "GET",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: /^Search$/ }).click();
  const geocodeResponse = await geocodeResponsePromise;
  const geocodeBody = await geocodeResponse.text();

  const result = page.getByRole("button", { name: /Oban/i }).first();
  try {
    await waitForVisible(result, 20000);
  } catch (error) {
    const dropdownText = await page.locator("div.absolute").last().innerText().catch(() => "");
    throw new Error(
      [
        `Search results did not render after hosted geocode lookup.`,
        `Geocode status: ${geocodeResponse.status()}`,
        `Geocode body: ${geocodeBody}`,
        `Dropdown text: ${dropdownText}`,
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
      ].join("\n"),
    );
  }
  await result.click();
  await page.getByRole("button", { name: /Update stop/i }).click();
  await waitForVisible(page.getByText(/Cloud trip saved successfully/i).first(), 30000);
};

const verifyRouteOverview = async (page) => {
  await page.getByTestId("desktop-panel-overview").click();
  await waitForVisible(page.getByTestId("route-confidence-live").first(), 30000);
};

const verifyDesktopSwitching = async (page) => {
  await page.getByTestId("desktop-panel-today").click();
  await waitForVisible(page.getByRole("heading", { name: /Today's actions/i }));
  await page.getByTestId("desktop-panel-itinerary").click();
  await waitForVisible(page.getByRole("heading", { name: /Itinerary/i }));
  await waitForVisible(page.getByLabel(/Trip map/i));
};

const run = async () => {
  const shareUrl = process.argv[2];
  if (!shareUrl) {
    throw new Error("Share URL argument is required.");
  }

  const baseUrl = shareUrl.split("?")[0];
  const env = await readEnvFile(".env.local");
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error("Supabase credentials are missing from .env.local.");
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const email = `preview-smoke-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `Smoke-${randomUUID()}!`;

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  console.log(`[smoke] Creating dedicated Supabase preview user ${email}`);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`Unable to create preview smoke user: ${created.error?.message ?? "unknown error"}`);
  }

  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw new Error(`Unable to create browser session: ${signedIn.error?.message ?? "unknown error"}`);
  }

  const session = signedIn.data.session;
  const results = {
    signedOutGate: false,
    starterTrip: false,
    saveFlow: false,
    placeSearch: false,
    liveRoutes: false,
    secondContextLoad: false,
    conflictRecovery: false,
    offlineReadOnly: false,
    desktopSwitching: false,
    manualMagicLink: "user-confirmed",
    testUserEmail: email,
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const signedOutContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    await primeSignedOut(signedOutContext);
    const signedOutPage = await signedOutContext.newPage();
    await gotoPreview(signedOutPage, shareUrl, baseUrl);
    await waitForVisible(signedOutPage.getByRole("button", { name: /Send magic link/i }));
    const bodyText = await signedOutPage.locator("body").innerText();
    if (/Outer Hebrides Family Trip/i.test(bodyText)) {
      throw new Error("Signed-out preview exposed itinerary content before login.");
    }
    results.signedOutGate = true;
    await signedOutContext.close();

    const contextA = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    await primeSession(contextA, storageKey, session);
    const pageA = await contextA.newPage();
    await gotoPreview(pageA, shareUrl, baseUrl);
    await waitForAnyText(pageA, [/Example trip ready/i, /Cloud trip loaded/i], 45000);
    await waitForVisible(pageA.getByRole("heading", { name: /Outer Hebrides Family Trip/i }), 45000);
    results.starterTrip = true;

    await ensureEditMode(pageA);
    const initialEditedTitle = `Preview Smoke Primary ${Date.now()}`;
    await editFirstStopTitle(pageA, initialEditedTitle);
    results.saveFlow = true;

    await updateStayLocation(pageA);
    results.placeSearch = true;

    await verifyRouteOverview(pageA);
    results.liveRoutes = true;

    await verifyDesktopSwitching(pageA);
    results.desktopSwitching = true;

    const contextB = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    await primeSession(contextB, storageKey, session);
    const pageB = await contextB.newPage();
    await gotoPreview(pageB, shareUrl, baseUrl);
    await waitForVisible(pageB.getByText(initialEditedTitle).first(), 45000);
    results.secondContextLoad = true;

    await pageA.getByTestId("desktop-panel-itinerary").click();
    if (await pageA.getByRole("button", { name: /Edit trip/i }).count()) {
      await ensureEditMode(pageA);
    }
    await pageA.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
    await waitForVisible(pageA.getByRole("heading", { name: /Edit stop/i }));
    const winnerTitle = `Conflict Winner ${Date.now()}`;
    await pageA.getByPlaceholder("Stop title").fill(winnerTitle);
    await pageA.getByRole("button", { name: /Update stop/i }).click();
    await waitForVisible(pageA.getByText(winnerTitle).first(), 30000);

    await pageB.getByTestId("desktop-panel-itinerary").click();
    await ensureEditMode(pageB);
    await pageB.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
    await waitForVisible(pageB.getByRole("heading", { name: /Edit stop/i }));
    const loserTitle = `Conflict Loser ${Date.now()}`;
    await pageB.getByPlaceholder("Stop title").fill(loserTitle);
    await pageB.getByRole("button", { name: /Update stop/i }).click();
    await waitForVisible(
      pageB.getByText(/Trip changed on another device\. The latest version has been loaded/i).first(),
      30000,
    );
    await waitForVisible(pageB.getByText(winnerTitle).first(), 30000);
    results.conflictRecovery = true;

    await contextB.close();

    const offlineContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    await primeSession(offlineContext, storageKey, session);
    const onlinePage = await offlineContext.newPage();
    await gotoPreview(onlinePage, shareUrl, baseUrl);
    await waitForAnyText(onlinePage, [/Cloud trip loaded/i, /Example trip ready/i], 45000);
    await offlineContext.route(/\/api\/trips(\/.*)?$/, (route) => route.abort());

    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForVisible(
      offlinePage.getByText(/Unable to reach cloud sync\. Showing the last synced trip instead\./i).first(),
      45000,
    );
    await waitForVisible(
      offlinePage.getByText(/This trip is read-only until the connection returns\./i).first(),
      30000,
    );
    const editTripButton = offlinePage.getByRole("button", { name: /Edit trip/i });
    await waitForVisible(editTripButton, 30000);
    const disabled = await editTripButton.isDisabled();
    if (!disabled) {
      throw new Error("Offline read-only state did not disable Edit trip.");
    }
    results.offlineReadOnly = true;
    await offlineContext.close();

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error("[smoke] Failed:", error);
  process.exit(1);
});
