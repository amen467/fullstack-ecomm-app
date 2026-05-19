import { createServer, request, type Server } from "node:http";
import type { TestContext } from "node:test";
import bcrypt from "bcrypt";
import { app } from "../app.js";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";

const DEFAULT_DATABASE_TIMEOUT_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

export async function requestApp(options: RequestAppOptions) {
  const server = createServer(app);

  try {
    await listen(server);
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server to a local port");
    }

    const bodyText = options.body === undefined ? undefined : JSON.stringify(options.body);

    return await new Promise<TestResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        req.destroy(new Error(`Request timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms`));
      }, DEFAULT_REQUEST_TIMEOUT_MS);

      const headers: Record<string, string | number> = {
        "connection": "close",
        ...options.headers,
      };

      if (bodyText !== undefined) {
        headers["content-type"] = "application/json";
        headers["content-length"] = Buffer.byteLength(bodyText);
      }

      const req = request(
        {
          host: "127.0.0.1",
          port: address.port,
          path: options.path,
          method: options.method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

          res.on("end", () => {
            clearTimeout(timeout);
            resolve({
              status: res.statusCode ?? 0,
              json: () => JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          });
        },
      );

      req.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      req.end(bodyText);
    });
  } finally {
    server.closeAllConnections();
    await close(server);
  }
}

export async function createTestUser(input: CreateTestUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma!.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? UserRole.USER,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function deleteTestUsers(emails: string[]) {
  await prisma?.user.deleteMany({
    where: {
      email: { in: emails },
    },
  });
}

export async function canUseDatabase(timeoutMs = DEFAULT_DATABASE_TIMEOUT_MS) {
  if (!process.env.DATABASE_URL || !prisma) {
    return false;
  }

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

export function skipIfDatabaseUnavailable(t: TestContext, hasTestDatabase: boolean) {
  if (!hasTestDatabase) {
    t.skip("DATABASE_URL is not configured or the test database is unavailable");
    return true;
  }

  return false;
}

export async function disconnectTestDatabase(hasTestDatabase: boolean) {
  if (hasTestDatabase && prisma) {
    await prisma.$disconnect();
  }
}

function listen(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve);
    server.on("error", reject);
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
    }),
  ]);
}

type RequestAppOptions = {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type CreateTestUserInput = {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
};

export type TestResponse = {
  status: number;
  json: () => unknown;
};
