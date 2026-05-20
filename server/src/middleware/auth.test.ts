import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import { requireAuth, requireRole } from "./auth.js";
import { errorHandler } from "./errors.js";
import { requestApp } from "../test/authTestHelpers.js";

const TEST_JWT_SECRET = "middleware-auth-test-secret";

describe("auth middleware", () => {
  before(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  after(() => {
    delete process.env.JWT_SECRET;
  });

  it("allows authenticated users with an allowed role", async () => {
    const app = buildTestApp();
    const token = signToken({ userId: 1, email: "admin@example.test", role: UserRole.ADMIN });

    const response = await requestApp({
      app,
      method: "GET",
      path: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("rejects authenticated users without an allowed role", async () => {
    const app = buildTestApp();
    const token = signToken({ userId: 1, email: "user@example.test", role: UserRole.USER });

    const response = await requestApp({
      app,
      method: "GET",
      path: "/admin-only",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Forbidden" });
  });

  it("rejects requests without an authenticated user", async () => {
    const app = buildTestApp();

    const response = await requestApp({
      app,
      method: "GET",
      path: "/role-only",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  });
});

function buildTestApp() {
  const app = express();

  app.get("/admin-only", requireAuth, requireRole(UserRole.ADMIN), (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/role-only", requireRole(UserRole.ADMIN), (_req, res) => {
    res.json({ ok: true });
  });

  app.use(errorHandler);

  return app;
}

function signToken(payload: { userId: number; email: string; role: UserRole }) {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: "7d" });
}
