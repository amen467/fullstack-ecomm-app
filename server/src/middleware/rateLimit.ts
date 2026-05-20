import rateLimit, { type Options, type Store } from "express-rate-limit";

const AUTH_WINDOW_MS = readPositiveInteger("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);
const AUTH_MAX_REQUESTS = readPositiveInteger("AUTH_RATE_LIMIT_MAX", 100);
const LOGIN_MAX_REQUESTS = readPositiveInteger("LOGIN_RATE_LIMIT_MAX", 10);
const REGISTER_MAX_REQUESTS = readPositiveInteger("REGISTER_RATE_LIMIT_MAX", 10);

export const authRateLimit = createRateLimiter({
  windowMs: AUTH_WINDOW_MS,
  limit: AUTH_MAX_REQUESTS,
});

export const loginRateLimit = createRateLimiter({
  windowMs: AUTH_WINDOW_MS,
  limit: LOGIN_MAX_REQUESTS,
});

export const registerRateLimit = createRateLimiter({
  windowMs: AUTH_WINDOW_MS,
  limit: REGISTER_MAX_REQUESTS,
});

export function createRateLimiter(options: RateLimiterOptions) {
  const store = createRateLimitStore(options.storePrefix);

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: options.message ?? "Too many requests",
    handler: (_req, res, _next, rateLimitOptions) => {
      res.status(rateLimitOptions.statusCode).json({ error: rateLimitOptions.message });
    },
    ...(store ? { store } : {}),
  });
}

function createRateLimitStore(_prefix?: string): Store | undefined {
  return undefined;
}

function readPositiveInteger(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

type RateLimiterOptions = Pick<Options, "windowMs" | "limit"> & {
  message?: string;
  storePrefix?: string;
};
