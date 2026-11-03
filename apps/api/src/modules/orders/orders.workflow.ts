import type { OrderStatus, Role } from "../../generated/prisma/enums.js";
import { can, type Permission } from "../../auth/permissions.js";

/**
 * Mașina de stări a unei comenzi: ce tranziții există și ce permisiune cere fiecare.
 * Stocul scade la CONFIRMED și revine doar la anularea unei comenzi deja confirmate.
 */
export const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Permission>>> = {
  PENDING: { CONFIRMED: "orders:approve", CANCELLED: "orders:approve" },
  CONFIRMED: { SHIPPED: "orders:fulfil", CANCELLED: "orders:approve" },
  SHIPPED: { DELIVERED: "orders:fulfil" },
  DELIVERED: {},
  CANCELLED: {},
};

export function transitionPermission(from: OrderStatus, to: OrderStatus): Permission | undefined {
  return TRANSITIONS[from][to];
}

/** Tranzițiile pe care un anumit rol le poate face acum; UI-ul afișează doar aceste butoane. */
export function allowedTransitions(from: OrderStatus, role: Role): OrderStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [OrderStatus, Permission][])
    .filter(([, permission]) => can(role, permission))
    .map(([to]) => to);
}

export type StockEffect = "reserve" | "release" | "none";

export function stockEffect(from: OrderStatus, to: OrderStatus): StockEffect {
  if (to === "CONFIRMED") return "reserve";
  if (to === "CANCELLED" && from === "CONFIRMED") return "release";
  return "none";
}
