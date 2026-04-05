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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const visibleByTestId = (page, testId) =>
  page.locator(`[data-testid="${testId}"]:visible`).first();
const modeToggle = (page) => visibleByTestId(page, "planner-mode-toggle");
const itineraryTab = (page) => visibleByTestId(page, "desktop-panel-itinerary");
const overviewTab = (page) => visibleByTestId(page, "desktop-panel-overview");
const dashboardTab = (page) => visibleByTestId(page, "desktop-panel-dashboard");
const overviewRouteInsightsPanel = (page) => visibleByTestId(page, "overview-route-insights-panel");
const tripsScrollRegion = (page) => visibleByTestId(page, "trips-scroll-region");
const cancelEditButton = (page) => visibleByTestId(page, "planner-mode-cancel");
const saveDraftButton = (page) => visibleByTestId(page, "planner-mode-save");
const addStayButton = (page) => visibleByTestId(page, "planner-add-stay");
const overviewScrollRegion = (page) => visibleByTestId(page, "overview-scroll-region");
const visibleButtonByText = (page, text) =>
  page.locator("button:visible").filter({ hasText: text }).first();

const refreshRoutes = async (page) => {
  await page.getByRole("button", { name: /^Refresh$/ }).first().click();
};

const expandOverviewRouteDetails = async (page) => {
  const button = overviewRouteInsightsPanel(page)
    .getByRole("button", { name: /Show route details/i })
    .first();

  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
};

const waitForAccountNotice = async (page, pattern, timeout = 30000) => {
  await page.getByRole("button", { name: /Open account and sync/i }).click();
  await waitForVisible(page.getByText(/Account and sync/i).first(), timeout);
  await waitForVisible(page.getByTestId("account-notice").filter({ hasText: pattern }).first(), timeout);
  await page.getByRole("button", { name: /^Close$/ }).click();
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
  const toggle = modeToggle(page);
  if (!(await toggle.isVisible().catch(() => false))) {
    await itineraryTab(page).click();
  }
  await waitForVisible(toggle);
  if ((await toggle.textContent())?.match(/Editing draft/i)) {
    await waitForVisible(cancelEditButton(page));
    return;
  }
  await toggle.click();
  await waitForVisible(cancelEditButton(page));
  const toggleText = await toggle.textContent();
  if (!toggleText?.match(/Editing draft/i)) {
    throw new Error(`Expected itinerary edit mode, but saw "${toggleText ?? "unknown"}".`);
  }
};

const waitForDashboardPreview = async (page, name) => {
  const selectedTripCard = tripCard(page, name);
  await waitForVisible(selectedTripCard);
  await selectedTripCard.click();
  await waitForVisible(visibleByTestId(page, "dashboard-open-trip-button"));
};

const openTripDashboard = async (page) => {
  await dashboardTab(page).click();
  await waitForVisible(page.getByRole("heading", { name: /Manage your trips/i }));
};

const openTripFromLibrary = async (page, name) => {
  await openTripsPanel(page);
  await waitForDashboardPreview(page, name);
  await visibleByTestId(page, "dashboard-open-trip-button").click();
  const workspaceHeader = visibleByTestId(page, "trip-workspace-header");
  await waitForVisible(workspaceHeader);
  await waitForVisible(
    workspaceHeader.getByRole("heading", { name: new RegExp(escapeRegExp(name), "i") }),
  );
};

const previewTripInLibrary = async (page, name) => {
  await openTripsPanel(page);
  await waitForDashboardPreview(page, name);
};

const saveItinerary = async (page) => {
  await waitForVisible(saveDraftButton(page));
  await saveDraftButton(page).click();
  const started = Date.now();
  let toggleText = await modeToggle(page).textContent();
  while (Date.now() - started < 30000 && !toggleText?.match(/Edit itinerary/i)) {
    await page.waitForTimeout(250);
    toggleText = await modeToggle(page).textContent();
  }
  if (!toggleText?.match(/Edit itinerary/i)) {
    throw new Error(`Expected itinerary review mode after save, but saw "${toggleText ?? "unknown"}".`);
  }
  await waitForAccountNotice(page, /Cloud trip saved successfully/i);
};

const editFirstStopTitle = async (page, title) => {
  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await waitForVisible(page.getByRole("heading", { name: /Edit stop/i }));
  const titleInput = page.getByPlaceholder("Stop title");
  await titleInput.fill(title);
  await page.getByRole("button", { name: /Update stop/i }).click();
  await waitForVisible(visibleButtonByText(page, title));
  await saveItinerary(page);
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
  await result.dispatchEvent("click");
  await page.getByRole("button", { name: /Update stop/i }).click();
  await saveItinerary(page);
};

const verifyRouteOverview = async (page) => {
  await overviewTab(page).click();
  await refreshRoutes(page);
  await expandOverviewRouteDetails(page);
  await waitForVisible(overviewRouteInsightsPanel(page).getByTestId("route-confidence-live").first(), 30000);
};

const verifyDesktopSwitching = async (page) => {
  await itineraryTab(page).click();
  await waitForVisible(visibleByTestId(page, "planner-map-panel").getByLabel(/Trip map/i));
  await page.getByRole("button", { name: /Open Today actions/i }).click();
  await waitForVisible(page.getByText(/Today's actions/i));
  await itineraryTab(page).click();
  await waitForVisible(visibleByTestId(page, "planner-map-panel").getByLabel(/Trip map/i));
  await openTripDashboard(page);
  await waitForVisible(visibleByTestId(page, "dashboard-trip-map-panel").getByLabel(/Trip map/i));
};

const verifyAccountPopup = async (page, email, noticePattern) => {
  if ((await overviewTab(page).count()) > 0) {
    await overviewTab(page).click();
    const overviewRegion = overviewScrollRegion(page);
    const accountTextCount = await overviewRegion.getByText(/Account and sync/i).count();
    if (accountTextCount > 0) {
      throw new Error("Overview still contains account and sync content.");
    }
  }

  await page.getByRole("button", { name: /Open account and sync/i }).click();
  await waitForVisible(page.getByText(/Account and sync/i).first());
  await waitForVisible(page.getByText(/Sync details/i).first());
  await waitForVisible(page.getByRole("button", { name: /Sign out/i }));
  if (noticePattern) {
    await waitForVisible(page.getByTestId("account-notice").filter({ hasText: noticePattern }).first());
  }
  if (email) {
    await waitForVisible(page.getByText(email).first());
  }
  await page.getByRole("button", { name: /^Close$/ }).click();
};

const openTripsPanel = async (page) => {
  await openTripDashboard(page);
  await waitForVisible(page.getByRole("heading", { name: /Manage your trips/i }));
};

const tripModal = (page) => page.locator("div.fixed.inset-0.z-50").last();

const tripCard = (page, name) =>
  page
    .locator("[data-testid^='trip-summary-']:visible")
    .filter({ hasText: name })
    .first();

const waitForTripCardCount = async (page, expectedCount, timeout = 30000) => {
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const count = await page.locator("[data-testid^='trip-summary-']:visible").count();
    if (count === expectedCount) {
      return;
    }
    await page.waitForTimeout(250);
  }

  const actualCount = await page.locator("[data-testid^='trip-summary-']:visible").count();
  throw new Error(`Expected ${expectedCount} trip cards, but found ${actualCount}.`);
};

const createBlankTrip = async (page, name) => {
  await openTripsPanel(page);
  await page.getByRole("button", { name: /^New trip$/ }).click();

  const modal = tripModal(page);
  await waitForVisible(modal.getByRole("heading", { name: /Create another trip/i }));
  await modal.getByLabel("Trip name").fill(name);
  await modal.getByPlaceholder("Search home base").fill("Inverness");
  await modal.getByRole("button", { name: /^Search$/ }).click();

  const result = modal.getByRole("button", { name: /Inverness/i }).first();
  await waitForVisible(result, 30000);
  await result.click();
  await modal.getByRole("button", { name: /Create trip/i }).click();

  await waitForVisible(modeToggle(page));
  if (!((await modeToggle(page).textContent())?.match(/Editing draft/i))) {
    throw new Error("Blank trip did not land in itinerary edit mode.");
  }
  await waitForVisible(addStayButton(page));
  await waitForAccountNotice(page, /Blank trip created/i);
};

const createExampleTrip = async (page, name) => {
  await openTripsPanel(page);
  await page.getByRole("button", { name: /^New trip$/ }).click();

  const modal = tripModal(page);
  await waitForVisible(modal.getByRole("heading", { name: /Create another trip/i }));
  await modal.getByTestId("trip-source-example").click();
  await modal.getByLabel("Trip name").fill(name);
  await modal.getByRole("button", { name: /Create trip/i }).click();

  const workspaceHeader = visibleByTestId(page, "trip-workspace-header");
  await waitForVisible(workspaceHeader);
  await waitForVisible(
    workspaceHeader.getByRole("heading", { name: new RegExp(escapeRegExp(name), "i") }),
  );
};

const renameTripInLibrary = async (page, currentName, nextName) => {
  await previewTripInLibrary(page, currentName);
  await page.getByRole("button", { name: /^Rename$/ }).click();

  const modal = tripModal(page);
  await waitForVisible(modal.getByText(/Rename trip/i).first());
  await modal.getByLabel("Trip name").fill(nextName);
  await modal.getByRole("button", { name: /Rename trip/i }).click();
  await waitForVisible(tripCard(page, nextName));
};

const deleteNonActiveTripFromLibrary = async (page, name) => {
  await previewTripInLibrary(page, name);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /^Delete$/ }).click();
  await waitForAccountNotice(page, /Trip deleted successfully\./i);
  await waitForTripCardCount(page, 2);

  const started = Date.now();
  while (Date.now() - started < 30000) {
    if ((await tripCard(page, name).count()) === 0) {
      return;
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Trip "${name}" was not removed from the Trips panel.`);
};

const deleteActiveTripFromLibrary = async (page, name) => {
  await previewTripInLibrary(page, name);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /^Delete$/ }).click();
  await waitForVisible(page.getByRole("heading", { name: /Manage your trips/i }));
  await waitForAccountNotice(page, /Trip deleted\. No trip is loaded now\./i);
};

const verifyLastTripDeleteGuard = async (page, remainingTripName) => {
  await openTripsPanel(page);
  await waitForTripCardCount(page, 1);
  const started = Date.now();

  while (Date.now() - started < 30000) {
    if ((await tripCard(page, remainingTripName).count()) > 0) {
      await previewTripInLibrary(page, remainingTripName);
      const deleteButton = page.getByRole("button", { name: /^Delete$/ });
      if (await deleteButton.isDisabled()) {
        return;
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error("Last remaining cloud trip still had an enabled Delete action.");
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
    signedInDashboard: false,
    accountPopup: false,
    tripLibraryVisible: false,
    multiTripCrud: false,
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
    await waitForVisible(pageA.getByRole("heading", { name: /Manage your trips/i }), 45000);
    await waitForVisible(
      tripsScrollRegion(pageA).getByText(/No cloud trips are available yet/i),
      45000,
    );
    results.signedInDashboard = true;

    await verifyAccountPopup(pageA, email);
    results.accountPopup = true;

    await openTripsPanel(pageA);
    results.tripLibraryVisible = true;

    const blankTripName = `Hosted Blank ${Date.now()}`;
    const renamedBlankTripName = `${blankTripName} Updated`;
    const exampleTripName = `Hosted Example ${Date.now()}`;
    const fallbackTripName = `Hosted Fallback ${Date.now()}`;
    await createBlankTrip(pageA, blankTripName);
    await createExampleTrip(pageA, exampleTripName);
    await createExampleTrip(pageA, fallbackTripName);
    await renameTripInLibrary(pageA, blankTripName, renamedBlankTripName);
    await openTripFromLibrary(pageA, renamedBlankTripName);
    await deleteNonActiveTripFromLibrary(pageA, exampleTripName);
    await deleteActiveTripFromLibrary(pageA, renamedBlankTripName);
    await openTripFromLibrary(pageA, fallbackTripName);
    await verifyLastTripDeleteGuard(pageA, fallbackTripName);
    await openTripFromLibrary(pageA, fallbackTripName);
    results.multiTripCrud = true;

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
    await openTripFromLibrary(pageB, fallbackTripName);
    await itineraryTab(pageB).click();
    await waitForVisible(visibleButtonByText(pageB, initialEditedTitle), 45000);
    results.secondContextLoad = true;

    await openTripFromLibrary(pageA, fallbackTripName);
    await itineraryTab(pageA).click();
    await ensureEditMode(pageA);
    await pageA.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
    await waitForVisible(pageA.getByRole("heading", { name: /Edit stop/i }));
    const winnerTitle = `Conflict Winner ${Date.now()}`;
    await pageA.getByPlaceholder("Stop title").fill(winnerTitle);
    await pageA.getByRole("button", { name: /Update stop/i }).click();
    await saveDraftButton(pageA).click();
    await waitForVisible(visibleButtonByText(pageA, winnerTitle), 30000);

    await itineraryTab(pageB).click();
    await ensureEditMode(pageB);
    await pageB.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
    await waitForVisible(pageB.getByRole("heading", { name: /Edit stop/i }));
    const loserTitle = `Conflict Loser ${Date.now()}`;
    await pageB.getByPlaceholder("Stop title").fill(loserTitle);
    await pageB.getByRole("button", { name: /Update stop/i }).click();
    await saveDraftButton(pageB).click();
    await waitForVisible(visibleButtonByText(pageB, loserTitle), 30000);
    const outcomeStarted = Date.now();
    let outcomeBodyText = await pageB.locator("body").innerText();
    let toggleText = await modeToggle(pageB).textContent();
    while (
      Date.now() - outcomeStarted < 30000 &&
      !/Trip changed on another device|Review the refreshed version|Needs attention/i.test(
        outcomeBodyText,
      ) &&
      !toggleText?.match(/Edit itinerary/i)
    ) {
      await pageB.waitForTimeout(250);
      outcomeBodyText = await pageB.locator("body").innerText();
      toggleText = await modeToggle(pageB).textContent();
    }

    const sawConflictWarning = /Trip changed on another device|Review the refreshed version|Needs attention/i.test(
      outcomeBodyText,
    );
    if (sawConflictWarning) {
      const saveAfterConflict = visibleByTestId(pageB, "planner-mode-save");
      await waitForVisible(saveAfterConflict, 30000);
      if (!(await saveAfterConflict.isEnabled())) {
        throw new Error("Expected stale conflict flow to keep the local draft actionable.");
      }
    } else if (!toggleText?.match(/Edit itinerary/i)) {
      throw new Error(
        `Expected either a conflict warning or a completed save, but only saw: ${outcomeBodyText.slice(0, 400)}`,
      );
    }
    results.conflictRecovery = true;

    await contextB.close();

    const offlineContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    await primeSession(offlineContext, storageKey, session);
    const onlinePage = await offlineContext.newPage();
    await gotoPreview(onlinePage, shareUrl, baseUrl);
    await openTripFromLibrary(onlinePage, fallbackTripName);
    await offlineContext.route(/\/api\/trips(\/.*)?$/, (route) => route.abort());

    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForVisible(
      offlinePage.getByText(/Unable to reach cloud sync\. Showing the last synced trip instead\./i).last(),
      45000,
    );
    await waitForVisible(
      offlinePage.getByText(/This cached library view is read-only until the connection returns\./i).last(),
      30000,
    );
    await waitForVisible(
      offlinePage
        .locator("p:visible")
        .filter({
          hasText:
            /Trip switching and trip management stay locked while the planner is using the cached offline copy\./i,
        })
        .first(),
      30000,
    );
    const newTripButton = offlinePage.getByRole("button", { name: /^New trip$/ });
    await waitForVisible(newTripButton, 30000);
    if (!(await newTripButton.isDisabled())) {
      throw new Error("Offline read-only state left the New trip button enabled.");
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
