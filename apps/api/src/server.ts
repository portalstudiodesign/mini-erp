import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { closeQueue } from "./lib/queue.js";

const server = createApp().listen(env.PORT, () => {
  logger.info(`API pornit pe http://localhost:${env.PORT}`);
  if (!env.REDIS_URL) logger.warn("REDIS_URL lipsește: joburile rulează în procesul API-ului");
});

async function shutdown(signal: string) {
  logger.info(`${signal} primit, opresc serverul`);
  server.close(async () => {
    await Promise.allSettled([closeQueue(), prisma.$disconnect()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
