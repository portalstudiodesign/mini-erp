import { Worker } from "bullmq";
import { env } from "./config/env.js";
import { checkLowStock } from "./jobs/lowStock.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { closeQueue, createRedisConnection, getStockQueue, STOCK_QUEUE, type LowStockJob } from "./lib/queue.js";

if (!env.REDIS_URL) {
  logger.error("Workerul are nevoie de REDIS_URL");
  process.exit(1);
}

// Verificare completă zilnică, ca plasă de siguranță pentru ce ar fi scăpat din joburile punctuale.
await getStockQueue()!.upsertJobScheduler(
  "daily-low-stock-sweep",
  { pattern: "0 7 * * *", tz: "Europe/Bucharest" },
  { name: "low-stock-check", data: { productIds: "all" } },
);

const connection = createRedisConnection(env.REDIS_URL);
const worker = new Worker<LowStockJob>(
  STOCK_QUEUE,
  async (job) => checkLowStock(job.data.productIds),
  // Jobul e sigur la rulări paralele (vezi StockAlert.openFor), deci putem procesa mai multe deodată.
  { connection, concurrency: 5 },
);

worker.on("completed", (job, result) => logger.debug({ jobId: job.id, result }, "Job finalizat"));
worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "Job eșuat"));
logger.info(`Worker pornit pe coada "${STOCK_QUEUE}"`);

async function shutdown() {
  await worker.close();
  await Promise.allSettled([connection.quit(), closeQueue(), prisma.$disconnect()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
