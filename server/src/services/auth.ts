import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import type { AuthTokenPayload } from "../types/auth.js";

const PASSWORD_SALT_ROUNDS = 10;
const TOKEN_EXPIRES_IN = "7d";

type SignableAuthPayload = Pick<AuthTokenPayload, "userId" | "email" | "role">;

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(payload: SignableAuthPayload, jwtSecret: string) {
  return jwt.sign(payload, jwtSecret, { expiresIn: TOKEN_EXPIRES_IN });
}

export function toAuthTokenPayload(user: { id: number; email: string; role: UserRole }): SignableAuthPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}

export function toSafeUser<User extends { passwordHash?: string }>(user: User) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
