import { SessionUser } from "@/types/trip";

export type BrowserAuthUser = {
  id: string;
  email?: string | null;
};

export type BrowserAuthSession = {
  access_token: string;
  user: BrowserAuthUser;
};

export const LOCAL_TEST_USER_ID = "local-test-user";
export const LOCAL_TEST_USER_EMAIL = "local-dev@example.com";

const E2E_AUTH_STORAGE_KEY = "campervan_trip_planner_e2e_session";
const E2E_ACCESS_TOKEN_PREFIX = "campervan-e2e:";

const toBase64Url = (value: string): string => {
  if (typeof window === "undefined" && typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  const utf8Bytes = new TextEncoder().encode(value);
  let binary = "";
  utf8Bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const getE2EAuthStorageKey = (): string => E2E_AUTH_STORAGE_KEY;

export const isBrowserE2EAuthBypassEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1";
};

export const isServerE2EAuthBypassEnabled = (): boolean => {
  return process.env.E2E_AUTH_BYPASS === "1";
};

export const createE2EAccessToken = (user: SessionUser): string => {
  return `${E2E_ACCESS_TOKEN_PREFIX}${toBase64Url(JSON.stringify(user))}`;
};

export const decodeE2EAccessToken = (token: string): SessionUser | null => {
  if (!token.startsWith(E2E_ACCESS_TOKEN_PREFIX)) {
    return null;
  }

  try {
    const encoded = token.slice(E2E_ACCESS_TOKEN_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionUser;

    if (typeof parsed.id !== "string") {
      return null;
    }

    return {
      id: parsed.id,
      email: typeof parsed.email === "string" ? parsed.email : null,
    };
  } catch {
    return null;
  }
};

export const createE2EBypassSession = (user: SessionUser): BrowserAuthSession => ({
  access_token: createE2EAccessToken(user),
  user: {
    id: user.id,
    email: user.email,
  },
});

export const createLocalTestUser = (): SessionUser => ({
  id: LOCAL_TEST_USER_ID,
  email: LOCAL_TEST_USER_EMAIL,
});

export const createLocalTestBypassSession = (): BrowserAuthSession => {
  return createE2EBypassSession(createLocalTestUser());
};
