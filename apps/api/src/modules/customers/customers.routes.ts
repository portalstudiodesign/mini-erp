import { Router } from "express";
import { idParam } from "../../lib/pagination.js";
import { requirePermission } from "../../middleware/auth.js";
import { createCustomerSchema, customerListQuery, updateCustomerSchema } from "./customers.schemas.js";
import * as customers from "./customers.service.js";

export const customersRouter = Router();

customersRouter.get("/", requirePermission("customers:read"), async (req, res) => {
  res.json(await customers.listCustomers(customerListQuery.parse(req.query)));
});

customersRouter.get("/:id", requirePermission("customers:read"), async (req, res) => {
  res.json(await customers.getCustomer(idParam.parse(req.params.id)));
});

customersRouter.post("/", requirePermission("customers:write"), async (req, res) => {
  res.status(201).json(await customers.createCustomer(createCustomerSchema.parse(req.body)));
});

customersRouter.patch("/:id", requirePermission("customers:write"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  res.json(await customers.updateCustomer(id, updateCustomerSchema.parse(req.body)));
});
