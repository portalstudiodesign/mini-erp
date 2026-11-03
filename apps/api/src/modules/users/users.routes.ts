import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { badRequest } from "../../lib/errors.js";
import { idParam } from "../../lib/pagination.js";
import { currentUser, requirePermission } from "../../middleware/auth.js";

const roleSchema = z.enum(["ADMIN", "SALES", "WAREHOUSE"]);

const createUserSchema = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(8, "Parola trebuie să aibă minim 8 caractere").max(100),
  role: roleSchema,
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
});

const publicFields = { id: true, email: true, name: true, role: true, active: true, createdAt: true } as const;

export const usersRouter = Router();
usersRouter.use(requirePermission("users:manage"));

usersRouter.get("/", async (_req, res) => {
  res.json(await prisma.user.findMany({ select: publicFields, orderBy: { name: "asc" } }));
});

usersRouter.post("/", async (req, res) => {
  const { password, ...data } = createUserSchema.parse(req.body);
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
    select: publicFields,
  });
  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = updateUserSchema.parse(req.body);
  // Un admin nu se poate bloca singur pe dinafară.
  if (id === currentUser(req).id && (data.active === false || (data.role && data.role !== "ADMIN"))) {
    throw badRequest("Nu îți poți dezactiva contul sau elimina rolul de admin");
  }
  res.json(await prisma.user.update({ where: { id }, data, select: publicFields }));
});
