import type { RequestHandler } from "express";
import type { z } from "zod";
import { BadRequestError } from "../errors/http.js";

type RequestPart = "body" | "params" | "query";

export function validateBody<Schema extends z.ZodType>(schema: Schema): RequestHandler {
  return validateRequestPart("body", schema);
}

export function validateParams<Schema extends z.ZodType>(schema: Schema): RequestHandler {
  return validateRequestPart("params", schema);
}

export function validateQuery<Schema extends z.ZodType>(schema: Schema): RequestHandler {
  return validateRequestPart("query", schema);
}

function validateRequestPart<Schema extends z.ZodType>(
  part: RequestPart,
  schema: Schema,
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(new BadRequestError(formatValidationError(result.error)));
      return;
    }

    req[part] = result.data;
    next();
  };
}

function formatValidationError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request";
}
