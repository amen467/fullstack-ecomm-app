import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import type { AuthTokenPayload } from "../types/auth.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({ error: "JWT secret is not configured" });
  }

  const authHeader = req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);

    if (!isAuthTokenPayload(payload)) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid authentication token" });
  }
};

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

function isAuthTokenPayload(payload: string | JwtPayload): payload is AuthTokenPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return (
    typeof payload.userId === "number" &&
    typeof payload.email === "string" &&
    (payload.role === UserRole.USER || payload.role === UserRole.ADMIN)
  );
}
