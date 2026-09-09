import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { badRequest } from "../lib/http";

/** Validates and replaces req.body with the parsed result. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        badRequest(
          "Validation failed",
          result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
        )
      );
    }
    req.body = result.data;
    next();
  };
}
