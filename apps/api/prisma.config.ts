import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Prisma 7 nu mai încarcă .env automat; variabilele deja setate (ex. în CI) au prioritate.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
