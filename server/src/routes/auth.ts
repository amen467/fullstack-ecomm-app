import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthTokenPayload } from "../types/auth.js";

const router = Router();

const PASSWORD_SALT_ROUNDS = 10;
const TOKEN_EXPIRES_IN = "7d";
type SignableAuthPayload = Pick<AuthTokenPayload, "userId" | "email" | "role">;

router.post("/register", async (req, res) => {
  if (!prisma) {
    return res.status(503).json({ error: "Database is not available" });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({ error: "JWT secret is not configured" });
  }

  const { name, email, password } = req.body as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Name is required" });
  }

  if (typeof email !== "string" || !isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return res.status(409).json({ error: "Email is already registered" });
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
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

    const token = signAuthToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
    );

    res.status(201).json({ token, user });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    console.error("Registration failed:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  if (!prisma) {
    return res.status(503).json({ error: "Database is not available" });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({ error: "JWT secret is not configured" });
  }

  const { email, password } = req.body as {
    email?: unknown;
    password?: unknown;
  };

  if (typeof email !== "string" || !isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "Password is required" });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
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
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const safeUser = toSafeUser(user);
  const token = signAuthToken(toAuthTokenPayload(safeUser), jwtSecret);

  res.json({ token, user: safeUser });
});

router.get("/me", requireAuth, async (req, res) => {
  if (!prisma) {
    return res.status(503).json({ error: "Database is not available" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
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
    return res.status(401).json({ error: "Invalid authentication token" });
  }

  res.json({ user });
});

function signAuthToken(payload: SignableAuthPayload, jwtSecret: string) {
  return jwt.sign(payload, jwtSecret, { expiresIn: TOKEN_EXPIRES_IN });
}

function toAuthTokenPayload(user: { id: number; email: string; role: UserRole }): SignableAuthPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}

function toSafeUser<User extends { passwordHash?: string }>(user: User) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export default router;
