import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

/** Aduce schema bazei de test la zi cu migrările, o singură dată înainte de toate testele. */
export default function setup(project: TestProject) {
  const env = project.config.env as Record<string, string>;
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
    stdio: "pipe",
  });
}
