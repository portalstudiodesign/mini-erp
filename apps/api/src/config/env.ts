import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET trebuie să aibă cel puțin 32 de caractere"),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().positive().default(8),
  REDIS_URL: z.url().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configurație invalidă:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
