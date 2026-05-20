import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requestApp } from "../test/authTestHelpers.js";

describe("POST /api/auth/logout", () => {
  it("returns no content without requiring server-side session state", async () => {
    const response = await requestApp({
      method: "POST",
      path: "/api/auth/logout",
    });

    assert.equal(response.status, 204);
  });
});
