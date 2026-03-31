import { createClient, SupabaseClient } from "@supabase/supabase-js";

import {
  BrowserAuthSession,
  BrowserAuthUser,
  getE2EAuthStorageKey,
  isBrowserE2EAuthBypassEnabled,
  isServerE2EAuthBypassEnabled,
} from "@/lib/e2eAuth";

export type { BrowserAuthSession, BrowserAuthUser } from "@/lib/e2eAuth";

type BrowserDatabase = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type BrowserAuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

export type BrowserAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: {
        session: BrowserAuthSession | null;
      };
    }>;
    signInWithOtp: (params: {
      email: string;
      options?: {
        emailRedirectTo?: string;
      };
    }) => Promise<{
      error: Error | null;
    }>;
    signOut: () => Promise<{
      error: Error | null;
    }>;
    onAuthStateChange: (
      callback: (event: BrowserAuthChangeEvent, session: BrowserAuthSession | null) => void,
    ) => {
      data: {
        subscription: {
          unsubscribe: () => void;
        };
      };
    };
  };
};

let browserClient: BrowserAuthClient | null = null;
const e2eAuthListeners = new Set<
  (event: BrowserAuthChangeEvent, session: BrowserAuthSession | null) => void
>();

const getPublicUrl = (): string => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const getAnonKey = (): string => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const getServiceRoleKey = (): string => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const readStoredE2ESession = (): BrowserAuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getE2EAuthStorageKey());
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as BrowserAuthSession;
    if (
      typeof parsed.access_token !== "string" ||
      !parsed.user ||
      typeof parsed.user.id !== "string"
    ) {
      return null;
    }

    return {
      access_token: parsed.access_token,
      user: {
        id: parsed.user.id,
        email: typeof parsed.user.email === "string" ? parsed.user.email : null,
      },
    };
  } catch {
    return null;
  }
};

const writeStoredE2ESession = (session: BrowserAuthSession | null) => {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getE2EAuthStorageKey();
  if (!session) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(session));
};

export const storeBrowserE2ESession = (session: BrowserAuthSession | null) => {
  writeStoredE2ESession(session);
};

const createBrowserE2EAuthClient = (): BrowserAuthClient => ({
  auth: {
    getSession: async () => ({
      data: {
        session: readStoredE2ESession(),
      },
    }),
    signInWithOtp: async ({ email }) => {
      if (!email.trim()) {
        return {
          error: new Error("Email address is required."),
        };
      }

      return {
        error: null,
      };
    },
    signOut: async () => {
      writeStoredE2ESession(null);
      e2eAuthListeners.forEach((listener) => listener("SIGNED_OUT", null));
      return {
        error: null,
      };
    },
    onAuthStateChange: (callback) => {
      e2eAuthListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              e2eAuthListeners.delete(callback);
            },
          },
        },
      };
    },
  },
});

export const emitBrowserE2ESignIn = (user: BrowserAuthUser, accessToken: string) => {
  const session: BrowserAuthSession = {
    access_token: accessToken,
    user,
  };

  storeBrowserE2ESession(session);
  e2eAuthListeners.forEach((listener) => listener("SIGNED_IN", session));
};

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(getPublicUrl() && getAnonKey()) ||
    isBrowserE2EAuthBypassEnabled() ||
    isServerE2EAuthBypassEnabled()
  );
};

export const isSupabaseServerConfigured = (): boolean => {
  return (
    Boolean(getPublicUrl() && getAnonKey() && getServiceRoleKey()) || isServerE2EAuthBypassEnabled()
  );
};

export const getBrowserSupabaseClient = (): BrowserAuthClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    if (isBrowserE2EAuthBypassEnabled()) {
      browserClient = createBrowserE2EAuthClient();
    } else {
      browserClient = createClient<BrowserDatabase>(getPublicUrl(), getAnonKey(), {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }) as unknown as BrowserAuthClient;
    }
  }

  return browserClient;
};

export const createServerSupabaseAuthClient = (): SupabaseClient<BrowserDatabase> | null => {
  if (!Boolean(getPublicUrl() && getAnonKey())) {
    return null;
  }

  return createClient<BrowserDatabase>(getPublicUrl(), getAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

export const createServerSupabaseServiceClient = (): SupabaseClient<BrowserDatabase> | null => {
  if (!Boolean(getPublicUrl() && getAnonKey() && getServiceRoleKey())) {
    return null;
  }

  return createClient<BrowserDatabase>(getPublicUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};
