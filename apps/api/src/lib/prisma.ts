import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

/** Clientul primit în prisma.$transaction(async (tx) => ...) */
export type Tx = Prisma.TransactionClient;
