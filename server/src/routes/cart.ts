import { Router } from "express";

const router = Router();

// Stub endpoints for cart
router.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.post("/items", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/items/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.delete("/items/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
