import { Prisma, type OrderStatus, type Role } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { toPage, toSkipTake } from "../../lib/pagination.js";
import { enqueueLowStockCheck } from "../../lib/queue.js";
import { can } from "../../auth/permissions.js";
import { applyMovement } from "../stock/stock.service.js";
import type { CreateOrderInput, OrderListQuery } from "./orders.schemas.js";
import { allowedTransitions, stockEffect, transitionPermission } from "./orders.workflow.js";

interface Actor {
  id: number;
  role: Role;
}

export async function listOrders(query: OrderListQuery) {
  const numericQ = query.q && /^\d+$/.test(query.q) ? Number(query.q) : undefined;
  const where: Prisma.OrderWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.customerId && { customerId: query.customerId }),
    ...((query.from || query.to) && { createdAt: { gte: query.from, lte: query.to } }),
    ...(query.q && {
      OR: [
        ...(numericQ ? [{ id: numericQ }] : []),
        { customer: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
      ...toSkipTake(query),
    }),
    prisma.order.count({ where }),
  ]);
  return toPage(items, total, query);
}

export async function getOrder(id: number, role: Role) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      items: {
        orderBy: { id: "asc" },
        include: { product: { select: { id: true, sku: true, name: true, unit: true, stock: true } } },
      },
      movements: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!order) throw notFound("Comanda");
  return { ...order, allowedTransitions: allowedTransitions(order.status, role) };
}

export async function createOrder(input: CreateOrderInput, actor: Actor) {
  // Același produs pe două rânduri devine un singur rând cu cantitățile adunate.
  const quantities = new Map<number, number>();
  for (const item of input.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const order = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
    if (!customer) throw badRequest("Clientul selectat nu există");

    const products = await tx.product.findMany({ where: { id: { in: [...quantities.keys()] } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const missing = [...quantities.keys()].filter((id) => !byId.get(id)?.active);
    if (missing.length) throw badRequest("Unele produse nu există sau sunt inactive", { productIds: missing });

    // Prețurile vin din DB, nu din request: clientul nu poate trimite propriul preț.
    const lines = [...quantities].map(([productId, quantity]) => {
      const unitPrice = byId.get(productId)!.price;
      return { productId, quantity, unitPrice, lineTotal: unitPrice.mul(quantity) };
    });
    const total = lines.reduce((sum, l) => sum.add(l.lineTotal), new Prisma.Decimal(0));

    return tx.order.create({
      data: {
        customerId: input.customerId,
        notes: input.notes,
        total,
        createdById: actor.id,
        items: { create: lines },
      },
    });
  });

  return getOrder(order.id, actor.role);
}

export async function changeOrderStatus(id: number, to: OrderStatus, actor: Actor) {
  const touchedProducts = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      // Ordine fixă de blocare a produselor: două comenzi cu aceleași produse nu se pot bloca reciproc (deadlock).
      include: { items: { orderBy: { productId: "asc" } } },
    });
    if (!order) throw notFound("Comanda");

    const permission = transitionPermission(order.status, to);
    if (!permission) {
      throw conflict("INVALID_TRANSITION", `Comanda nu poate trece din ${order.status} în ${to}`, {
        from: order.status,
        to,
      });
    }
    if (!can(actor.role, permission)) throw forbidden();

    // Blocare optimistă: dacă altcineva a schimbat statusul între timp, nu mai găsim rândul.
    const { count } = await tx.order.updateMany({ where: { id, status: order.status }, data: { status: to } });
    if (count === 0) throw conflict("CONCURRENT_UPDATE", "Comanda a fost modificată între timp. Reîncarcă pagina.");

    const effect = stockEffect(order.status, to);
    if (effect === "none") return [];

    for (const item of order.items) {
      await applyMovement(tx, {
        productId: item.productId,
        quantity: effect === "reserve" ? -item.quantity : item.quantity,
        type: effect === "reserve" ? "SALE" : "RETURN",
        orderId: order.id,
        userId: actor.id,
        reason: `Comanda #${order.id}`,
      });
    }
    return order.items.map((i) => i.productId);
  });

  await enqueueLowStockCheck(touchedProducts);
  return getOrder(id, actor.role);
}
