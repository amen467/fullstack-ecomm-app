import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { AppError, AuthError, ForbiddenError } from "../errors/http.js";
import { UserRole } from "../generated/enums.js";
import type { AuthTokenPayload } from "../types/auth.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new AppError(500, "JWT secret is not configured");
  }

  const authHeader = req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError();
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    throw new AuthError();
  }

  try {
    const payload = jwt.verify(token, jwtSecret);

    if (!isAuthTokenPayload(payload)) {
      throw new AuthError("Invalid authentication token");
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    throw new AuthError("Invalid authentication token");
  }
};

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      throw new AuthError();
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
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
