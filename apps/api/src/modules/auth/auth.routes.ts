import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { unauthorized } from "../../lib/errors.js";
import { permissionsFor } from "../../auth/permissions.js";
import { AUTH_COOKIE, authenticate, currentUser } from "../../middleware/auth.js";

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

// Hash fix comparat când emailul nu există, ca timpul de răspuns să nu dezvăluie conturile existente.
const DUMMY_HASH = bcrypt.hashSync("parola-inexistenta", 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Prea multe încercări. Reîncearcă mai târziu." } },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });

  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.active) throw unauthorized("Email sau parolă greșite");

  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: `${env.JWT_EXPIRES_IN_HOURS}h`,
  });

  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000,
    path: "/",
  });
  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    permissions: permissionsFor(user.role),
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", authenticate, (req, res) => {
  const user = currentUser(req);
  res.json({ user, permissions: permissionsFor(user.role) });
});
