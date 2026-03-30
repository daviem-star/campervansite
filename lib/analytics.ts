type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

export const trackEvent = async (event: string, payload: AnalyticsPayload = {}): Promise<void> => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event,
        payload,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics failures should never block planner usage.
  }
};
