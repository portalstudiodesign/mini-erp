import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { can, type Permission } from "../auth/permissions.js";

export const AUTH_COOKIE = "token";

function readToken(req: Request): string | undefined {
  const cookie = req.cookies?.[AUTH_COOKIE] as string | undefined;
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

/**
 * Verifică tokenul și încarcă utilizatorul din DB la fiecare request:
 * un cont dezactivat sau un rol schimbat are efect imediat, nu la expirarea tokenului.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized();

  let userId: number;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    userId = Number(payload.sub);
  } catch {
    throw unauthorized("Sesiune expirată sau invalidă");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user?.active) throw unauthorized("Cont inexistent sau dezactivat");

  req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  next();
};

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!can(req.user.role, permission)) throw forbidden();
    next();
  };
}

/** Pentru handlerele montate după `authenticate`. */
export function currentUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}
