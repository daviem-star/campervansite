import { NextRequest } from "next/server";

import { decodeE2EAccessToken, isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { createServerSupabaseAuthClient } from "@/lib/supabase";
import { SessionUser } from "@/types/trip";

export const readBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
};

export const getAuthenticatedUser = async (request: NextRequest): Promise<SessionUser | null> => {
  const token = readBearerToken(request);
  if (!token) {
    return null;
  }

  if (isServerE2EAuthBypassEnabled()) {
    return decodeE2EAccessToken(token);
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
    id: data.user.id,
    email: data.user.email ?? null,
  };
};
