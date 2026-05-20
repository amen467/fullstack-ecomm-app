import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { Prisma } from "../generated/client.js";
import { AppError } from "../errors/http.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.expose ? error.message : "Internal server error" });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "Resource already exists" });
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json({ error: "Not Found" });
      return;
    }
  }

  console.error("Unexpected request error:", error);
  res.status(500).json({ error: "Internal server error" });
};
