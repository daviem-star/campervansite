import { NextRequest } from "next/server";

import { decodeE2EAccessToken, isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { createServerSupabaseAuthClient } from "@/lib/supabase";
import { SessionUser } from "@/types/trip";

export type RequestAuthMode = "e2e" | "supabase";

export type AuthenticatedRequest = {
  authMode: RequestAuthMode;
  user: SessionUser;
};

export const readBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
};

export const getAuthenticatedRequest = async (
  request: NextRequest,
): Promise<AuthenticatedRequest | null> => {
  const token = readBearerToken(request);
  if (!token) {
    return null;
  }

  if (isServerE2EAuthBypassEnabled()) {
    const e2eUser = decodeE2EAccessToken(token);
    if (e2eUser) {
      return {
        authMode: "e2e",
        user: e2eUser,
      };
    }
  }

  const client = createServerSupabaseAuthClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return {
    authMode: "supabase",
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  };
};

export const getAuthenticatedUser = async (request: NextRequest): Promise<SessionUser | null> => {
  const authenticatedRequest = await getAuthenticatedRequest(request);
  return authenticatedRequest?.user ?? null;
};
