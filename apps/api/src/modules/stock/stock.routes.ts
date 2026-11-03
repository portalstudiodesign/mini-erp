import { Router } from "express";
import { currentUser, requirePermission } from "../../middleware/auth.js";
import { createMovementSchema, movementListQuery } from "./stock.schemas.js";
import * as stock from "./stock.service.js";

export const stockRouter = Router();

stockRouter.get("/movements", requirePermission("stock:read"), async (req, res) => {
  res.json(await stock.listMovements(movementListQuery.parse(req.query)));
});

stockRouter.post("/movements", requirePermission("stock:write"), async (req, res) => {
  const input = createMovementSchema.parse(req.body);
  res.status(201).json(await stock.createManualMovement(input, currentUser(req).id));
});

stockRouter.get("/alerts", requirePermission("stock:read"), async (_req, res) => {
  res.json(await stock.listOpenAlerts());
});
