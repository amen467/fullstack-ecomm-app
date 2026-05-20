import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import { createRateLimiter } from "./rateLimit.js";
import { requestApp } from "../test/authTestHelpers.js";

describe("rate limit middleware", () => {
  it("returns a JSON 429 response after the configured limit", async () => {
    const app = express();

    app.get(
      "/limited",
      createRateLimiter({
        windowMs: 60_000,
        limit: 2,
      }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );

    assert.equal((await getLimited(app)).status, 200);
    assert.equal((await getLimited(app)).status, 200);

    const blockedResponse = await getLimited(app);

    assert.equal(blockedResponse.status, 429);
    assert.deepEqual(await blockedResponse.json(), { error: "Too many requests" });
  });
});

function getLimited(app: express.Express) {
  return requestApp({
    app,
    method: "GET",
    path: "/limited",
  });
}
