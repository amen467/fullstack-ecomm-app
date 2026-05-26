import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validateParams } from "../middleware/validation.js";
import { orderParamsSchema } from "../validation/orders.js";

const router = Router();

router.use(requireAuth);

// Stub endpoints for orders
router.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/:id", validateParams(orderParamsSchema), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
