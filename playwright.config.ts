import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_LOCAL_TEST_SIGN_IN: "1",
      NEXT_PUBLIC_E2E_AUTH_BYPASS: "1",
      E2E_AUTH_BYPASS: "1",
      NEXT_PUBLIC_OPENROUTESERVICE_DEBUG: "0",
      NEXT_PUBLIC_SUPABASE_URL: "https://e2e.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-key",
    },
  },
});
