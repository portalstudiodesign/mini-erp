import { Router } from "express";
import { idParam } from "../../lib/pagination.js";
import { requirePermission } from "../../middleware/auth.js";
import { createProductSchema, productListQuery, updateProductSchema } from "./products.schemas.js";
import * as products from "./products.service.js";

export const productsRouter = Router();

productsRouter.get("/", requirePermission("products:read"), async (req, res) => {
  res.json(await products.listProducts(productListQuery.parse(req.query)));
});

productsRouter.get("/:id", requirePermission("products:read"), async (req, res) => {
  res.json(await products.getProduct(idParam.parse(req.params.id)));
});

productsRouter.post("/", requirePermission("products:write"), async (req, res) => {
  res.status(201).json(await products.createProduct(createProductSchema.parse(req.body)));
});

productsRouter.patch("/:id", requirePermission("products:write"), async (req, res) => {
  const id = idParam.parse(req.params.id);
  res.json(await products.updateProduct(id, updateProductSchema.parse(req.body)));
});
