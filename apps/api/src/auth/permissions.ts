import type { Role } from "../generated/prisma/enums.js";

const ALL: readonly Role[] = ["ADMIN", "SALES", "WAREHOUSE"];

/**
 * Sursa unică de adevăr pentru autorizare. Rutele cer permisiuni, nu roluri,
 * așa că un rol nou înseamnă o modificare doar aici.
 */
export const PERMISSIONS = {
  "products:read": ALL,
  "products:write": ["ADMIN"],
  "customers:read": ["ADMIN", "SALES"],
  "customers:write": ["ADMIN", "SALES"],
  "orders:read": ALL,
  "orders:create": ["ADMIN", "SALES"],
  "orders:approve": ["ADMIN", "SALES"], // confirmare și anulare
  "orders:fulfil": ["ADMIN", "WAREHOUSE"], // expediere și livrare
  "stock:read": ALL,
  "stock:write": ["ADMIN", "WAREHOUSE"],
  "users:manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
}
