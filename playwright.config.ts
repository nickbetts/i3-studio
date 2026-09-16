import { defineConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";

if (process.env.E2E_ENV_FILE) loadEnv({ path: process.env.E2E_ENV_FILE, override: true });
loadEnv({ path: ".env.local", override: true });
const serverCommand = process.env.E2E_ENV_FILE ? `E2E_ENV_FILE="${process.env.E2E_ENV_FILE}" scripts/start-e2e.sh` : "scripts/start-e2e.sh";
const serverEnv = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3107", headless: true, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: {
    command: serverCommand,
    url: "http://localhost:3107/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: serverEnv,
  },
});