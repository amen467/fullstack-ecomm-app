import { Router } from "express";

const router = Router();

// Stub endpoints for products
router.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.delete("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
