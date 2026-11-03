import { Router } from "express";
import { idParam } from "../../lib/pagination.js";
import { currentUser, requirePermission } from "../../middleware/auth.js";
import { changeStatusSchema, createOrderSchema, orderListQuery } from "./orders.schemas.js";
import * as orders from "./orders.service.js";

export const ordersRouter = Router();

ordersRouter.get("/", requirePermission("orders:read"), async (req, res) => {
  res.json(await orders.listOrders(orderListQuery.parse(req.query)));
});

ordersRouter.get("/:id", requirePermission("orders:read"), async (req, res) => {
  res.json(await orders.getOrder(idParam.parse(req.params.id), currentUser(req).role));
});

ordersRouter.post("/", requirePermission("orders:create"), async (req, res) => {
  res.status(201).json(await orders.createOrder(createOrderSchema.parse(req.body), currentUser(req)));
});

// Permisiunea exactă depinde de tranziție, așa că o verifică serviciul.
ordersRouter.post("/:id/status", requirePermission("orders:read"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { status } = changeStatusSchema.parse(req.body);
  res.json(await orders.changeOrderStatus(id, status, currentUser(req)));
});
