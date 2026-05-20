import { Router } from "express";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";
import { AuthError, AppError, ConflictError, ServiceUnavailableError } from "../errors/http.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import {
  hashPassword,
  signAuthToken,
  toAuthTokenPayload,
  toSafeUser,
  verifyPassword,
} from "../services/auth.js";
import { loginSchema, registerSchema, type LoginBody, type RegisterBody } from "../validation/auth.js";

const router = Router();

router.post("/register", validateBody(registerSchema), asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new AppError(500, "JWT secret is not configured");
  }

  const { name, email, password } = req.body as RegisterBody;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new ConflictError("Email is already registered");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: UserRole.USER,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const token = signAuthToken(toAuthTokenPayload(user), jwtSecret);

  res.status(201).json({ token, user });
}));

router.post("/login", validateBody(loginSchema), asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new AppError(500, "JWT secret is not configured");
  }

  const { email, password } = req.body as LoginBody;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AuthError("Invalid email or password");
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AuthError("Invalid email or password");
  }

  const safeUser = toSafeUser(user);
  const token = signAuthToken(toAuthTokenPayload(safeUser), jwtSecret);

  res.json({ token, user: safeUser });
}));

router.post("/logout", (_req, res) => {
  res.status(204).send();
});

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  if (!req.user) {
    throw new AuthError();
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AuthError("Invalid authentication token");
  }

  res.json({ user });
}));

export default router;
