import { Router } from "express";

const router = Router();

// Stub endpoints for authentication
router.post("/register", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.post("/login", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.post("/logout", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/me", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
