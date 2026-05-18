import type { JwtPayload } from "jsonwebtoken";
import type { UserRole } from "../generated/enums.js";

export type AuthenticatedUser = {
  id: number;
  email: string;
  role: UserRole;
};

export type AuthTokenPayload = JwtPayload & {
  userId: number;
  email: string;
  role: UserRole;
};

