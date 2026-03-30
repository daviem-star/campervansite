import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StorageState = Map<string, string>;

const createStorageMock = () => {
  const state: StorageState = new Map();

  return {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => {
      state.set(key, value);
    },
    removeItem: (key: string) => {
      state.delete(key);
    },
    clear: () => {
      state.clear();
    },
    key: (index: number) => Array.from(state.keys())[index] ?? null,
    get length() {
      return state.size;
    },
  } as Storage;
};

describe("supabase local test auth bypass", () => {
  const originalWindow = globalThis.window;
  const originalE2EBypass = process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "1";
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: createStorageMock(),
      },
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = originalE2EBypass;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    vi.restoreAllMocks();
  });

  it("clears the stored bypass session on sign out", async () => {
    const supabase = await import("@/lib/supabase");
    const auth = await import("@/lib/e2eAuth");

    const user = auth.createLocalTestUser();
    supabase.emitBrowserE2ESignIn(user, auth.createLocalTestBypassSession().access_token);

    const client = supabase.getBrowserSupabaseClient();
    expect(client).not.toBeNull();
    expect((await client?.auth.getSession()).data.session?.user.id).toBe(user.id);

    await client?.auth.signOut();

    expect(window.localStorage.getItem(auth.getE2EAuthStorageKey())).toBeNull();
    expect((await client?.auth.getSession()).data.session).toBeNull();
  });
});
