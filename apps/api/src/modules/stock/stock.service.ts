import type { MovementType, Prisma } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../lib/prisma.js";
import { conflict, notFound } from "../../lib/errors.js";
import { toPage, toSkipTake } from "../../lib/pagination.js";
import { enqueueLowStockCheck } from "../../lib/queue.js";
import type { CreateMovementInput, MovementListQuery } from "./stock.schemas.js";

interface MovementData {
  productId: number;
  quantity: number; // cu semn
  type: MovementType;
  userId: number;
  reason?: string | null;
  orderId?: number;
}

/**
 * Singurul loc care modifică Product.stock. Rulează în tranzacția apelantului.
 *
 * Scăderea e un UPDATE condiționat (`WHERE stock >= cantitate`), deci două comenzi
 * confirmate simultan nu pot duce stocul pe minus: a doua găsește 0 rânduri și eșuează.
 * Varianta „citesc stocul, verific în cod, apoi scriu” ar avea o condiție de cursă.
 */
export async function applyMovement(tx: Tx, data: MovementData) {
  if (data.quantity < 0) {
    const needed = -data.quantity;
    const { count } = await tx.product.updateMany({
      where: { id: data.productId, stock: { gte: needed } },
      data: { stock: { decrement: needed } },
    });
    if (count === 0) {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
        select: { sku: true, name: true, stock: true },
      });
      if (!product) throw notFound("Produsul");
      throw conflict(
        "INSUFFICIENT_STOCK",
        `Stoc insuficient pentru ${product.name}: disponibil ${product.stock}, necesar ${needed}`,
        { productId: data.productId, sku: product.sku, available: product.stock, requested: needed },
      );
    }
  } else {
    await tx.product.update({
      where: { id: data.productId },
      data: { stock: { increment: data.quantity } },
    });
  }

  return tx.stockMovement.create({ data });
}

export async function createManualMovement(input: CreateMovementInput, userId: number) {
  const movement = await prisma.$transaction((tx) => applyMovement(tx, { ...input, userId }));
  // După commit: jobul trebuie să vadă stocul nou, iar un eșec al lui nu anulează mișcarea.
  await enqueueLowStockCheck([input.productId]);
  return movement;
}

export async function listMovements(query: MovementListQuery) {
  const where: Prisma.StockMovementWhereInput = {
    ...(query.productId && { productId: query.productId }),
    ...(query.type && { type: query.type }),
    ...(query.q && {
      product: {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { sku: { contains: query.q, mode: "insensitive" } },
        ],
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true } },
        user: { select: { name: true } },
      },
      ...toSkipTake(query),
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return toPage(items, total, query);
}

export function listOpenAlerts() {
  return prisma.stockAlert.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { id: true, sku: true, name: true, stock: true, minStock: true, unit: true } } },
  });
}
