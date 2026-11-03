import type { MovementType, OrderStatus, Role } from "./types";

const money = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" });
const dateTime = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short" });

export const formatMoney = (value: string | number) => money.format(Number(value));
export const formatDateTime = (value: string) => dateTime.format(new Date(value));
export const formatDay = (value: string) => date.format(new Date(value));

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "În așteptare",
  CONFIRMED: "Confirmată",
  SHIPPED: "Expediată",
  DELIVERED: "Livrată",
  CANCELLED: "Anulată",
};

export const STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "neutral",
};

/** Eticheta butonului care duce comanda în statusul dat. */
export const TRANSITION_LABEL: Record<OrderStatus, string> = {
  PENDING: "",
  CONFIRMED: "Confirmă comanda",
  SHIPPED: "Marchează expediată",
  DELIVERED: "Marchează livrată",
  CANCELLED: "Anulează",
};

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  RECEIPT: "Recepție",
  SALE: "Vânzare",
  RETURN: "Retur",
  ADJUSTMENT: "Corecție",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  SALES: "Vânzări",
  WAREHOUSE: "Depozit",
};
