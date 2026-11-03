import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// În CI variabilele vin din mediu; local, din .env.test.
const fileEnv = existsSync(".env.test") ? parseEnv(readFileSync(".env.test", "utf8")) : {};

export default defineConfig({
  test: {
    env: { ...fileEnv, ...process.env, NODE_ENV: "test" } as Record<string, string>,
    globalSetup: "./tests/globalSetup.ts",
    setupFiles: ["./tests/setup.ts"],
    // Testele de integrare împart aceeași bază de date, deci rulează pe rând.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
