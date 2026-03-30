import { randomUUID } from "node:crypto";

import { Page } from "@playwright/test";

import { createE2EBypassSession, getE2EAuthStorageKey } from "../../lib/e2eAuth";
import { FORCE_DEMO_MODE_STORAGE_KEY } from "../../lib/runtimeFlags";
import { getSeedData } from "../../lib/seedData";
import { AppData, SessionUser } from "../../types/trip";

const LEGACY_STORAGE_KEY = "campervan_trip_planner_v1";

export const createTestUser = (prefix: string): SessionUser => {
  const id = randomUUID();
  return {
    id: `e2e-${prefix}-${id}`,
    email: `${prefix}-${id}@example.com`,
  };
};

export const getLegacySeedData = (): AppData => getSeedData();

export const primeSignedInSession = async (
  page: Page,
  user: SessionUser,
  options?: {
    legacyData?: AppData | null;
  },
) => {
  const session = createE2EBypassSession(user);

  await page.addInitScript(
    ({ authStorageKey, sessionValue, legacyStorageKey, legacyValue, forceDemoStorageKey }) => {
      window.localStorage.removeItem(forceDemoStorageKey);
      window.localStorage.setItem(authStorageKey, JSON.stringify(sessionValue));

      if (legacyValue) {
        window.localStorage.setItem(legacyStorageKey, JSON.stringify(legacyValue));
      } else {
        window.localStorage.removeItem(legacyStorageKey);
      }
    },
    {
      authStorageKey: getE2EAuthStorageKey(),
      sessionValue: session,
      legacyStorageKey: LEGACY_STORAGE_KEY,
      legacyValue: options?.legacyData ?? null,
      forceDemoStorageKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};

export const primeSignedOutState = async (
  page: Page,
  options?: {
    legacyData?: AppData | null;
  },
) => {
  await page.addInitScript(
    ({ authStorageKey, legacyStorageKey, legacyValue, forceDemoStorageKey }) => {
      window.localStorage.removeItem(forceDemoStorageKey);
      window.localStorage.removeItem(authStorageKey);

      if (legacyValue) {
        window.localStorage.setItem(legacyStorageKey, JSON.stringify(legacyValue));
      } else {
        window.localStorage.removeItem(legacyStorageKey);
      }
    },
    {
      authStorageKey: getE2EAuthStorageKey(),
      legacyStorageKey: LEGACY_STORAGE_KEY,
      legacyValue: options?.legacyData ?? null,
      forceDemoStorageKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};

export const primeForcedDemoMode = async (
  page: Page,
  options?: {
    legacyData?: AppData | null;
  },
) => {
  await page.addInitScript(
    ({ authStorageKey, legacyStorageKey, legacyValue, forceDemoStorageKey }) => {
      window.localStorage.setItem(forceDemoStorageKey, "1");
      window.localStorage.removeItem(authStorageKey);

      if (legacyValue) {
        window.localStorage.setItem(legacyStorageKey, JSON.stringify(legacyValue));
      } else {
        window.localStorage.removeItem(legacyStorageKey);
      }
    },
    {
      authStorageKey: getE2EAuthStorageKey(),
      legacyStorageKey: LEGACY_STORAGE_KEY,
      legacyValue: options?.legacyData ?? null,
      forceDemoStorageKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};
