import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

/**
 * Deschide o alertă pentru produsele sub stocul minim și le închide pe cele reaprovizionate.
 * Idempotent și sigur la rulări paralele: indexul unic pe `openFor` respinge a doua alertă deschisă.
 */
export async function checkLowStock(productIds: number[] | "all") {
  const products = await prisma.product.findMany({
    where: { active: true, ...(productIds !== "all" && { id: { in: productIds } }) },
    select: {
      id: true,
      stock: true,
      minStock: true,
      alerts: { where: { resolvedAt: null }, select: { id: true } },
    },
  });

  let opened = 0;
  let resolved = 0;

  for (const p of products) {
    const isLow = p.stock < p.minStock;
    const hasOpenAlert = p.alerts.length > 0;

    if (isLow && !hasOpenAlert) {
      try {
        await prisma.stockAlert.create({
          data: { productId: p.id, stock: p.stock, minStock: p.minStock, openFor: p.id },
        });
        opened++;
      } catch (err) {
        // Alt job a deschis alerta între citire și scriere: rezultatul dorit există deja.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      }
    } else if (!isLow && hasOpenAlert) {
      await prisma.stockAlert.updateMany({
        where: { productId: p.id, resolvedAt: null },
        data: { resolvedAt: new Date(), openFor: null },
      });
      resolved++;
    }
  }

  if (opened || resolved) logger.info({ opened, resolved }, "Verificare stoc minim");
  return { checked: products.length, opened, resolved };
}
