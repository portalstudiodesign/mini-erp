import { Router } from "express";
import type { OrderStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";

const REVENUE_STATUSES: OrderStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED"];
const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_DAYS = 14;

export const dashboardRouter = Router();

dashboardRouter.get("/", async (_req, res) => {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS);
  const chartStart = new Date(new Date(now - (CHART_DAYS - 1) * DAY_MS).setUTCHours(0, 0, 0, 0));

  // Interogări independente, rulate în paralel.
  const [byStatus, revenue, openAlerts, alertCount, recentOrders, daily] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: since30 } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.stockAlert.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { product: { select: { id: true, sku: true, name: true, stock: true, minStock: true, unit: true } } },
    }),
    prisma.stockAlert.count({ where: { resolvedAt: null } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { customer: { select: { id: true, name: true } } },
    }),
    // Agregare pe zile direct în Postgres; Prisma nu are groupBy pe expresii de dată.
    // Ziua vine ca text: un `timestamp` fără fus orar ar fi citit de driverul pg în ora locală și s-ar decala.
    prisma.$queryRaw<{ day: string; total: string; orders: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, SUM(total)::text AS total, COUNT(*) AS orders
      FROM "Order"
      WHERE status::text IN ('CONFIRMED', 'SHIPPED', 'DELIVERED') AND "createdAt" >= ${chartStart}
      GROUP BY 1
      ORDER BY 1`,
  ]);

  const dailyByKey = new Map(daily.map((d) => [d.day, d]));
  const revenueByDay = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = new Date(chartStart.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    const row = dailyByKey.get(date);
    return { date, total: row ? Number(row.total) : 0, orders: row ? Number(row.orders) : 0 };
  });

  res.json({
    ordersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    revenue30d: { total: revenue._sum.total ?? "0", orders: revenue._count },
    openAlerts: { count: alertCount, items: openAlerts },
    recentOrders,
    revenueByDay,
  });
});
