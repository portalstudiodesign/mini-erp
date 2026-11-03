import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { checkLowStock } from "../jobs/lowStock.js";
import { logger } from "./logger.js";

export const STOCK_QUEUE = "stock";

export interface LowStockJob {
  /** "all" = verificare completă (jobul programat zilnic) */
  productIds: number[] | "all";
}

export function createRedisConnection(url: string) {
  // BullMQ cere maxRetriesPerRequest: null pentru conexiunile de tip blocking ale workerului.
  return new Redis(url, { maxRetriesPerRequest: null });
}

let queue: Queue<LowStockJob> | undefined;

export function getStockQueue(): Queue<LowStockJob> | undefined {
  if (!env.REDIS_URL) return undefined;
  queue ??= new Queue<LowStockJob>(STOCK_QUEUE, { connection: createRedisConnection(env.REDIS_URL) });
  return queue;
}

/**
 * Cu Redis: jobul intră în coadă și e procesat de `worker.ts`, cu reîncercări.
 * Fără Redis (dezvoltare locală, teste): rulează imediat în același proces.
 * În ambele cazuri un eșec al jobului nu strică requestul care l-a declanșat.
 */
export async function enqueueLowStockCheck(productIds: number[]) {
  if (productIds.length === 0) return;
  const unique = [...new Set(productIds)];

  try {
    const q = getStockQueue();
    if (q) {
      await q.add("low-stock-check", { productIds: unique }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } else {
      await checkLowStock(unique);
    }
  } catch (err) {
    logger.error({ err, productIds: unique }, "Nu am putut programa verificarea stocului minim");
  }
}

export async function closeQueue() {
  await queue?.close();
}
