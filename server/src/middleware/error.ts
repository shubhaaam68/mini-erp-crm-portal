import { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  const anyErr = err as any;
  // Prisma unique-constraint violation
  if (anyErr?.code === "P2002") {
    return res.status(409).json({
      error: { message: `Duplicate value for ${(anyErr.meta?.target || []).join(", ")}` },
    });
  }
  if (anyErr?.code === "P2025") {
    return res.status(404).json({ error: { message: "Resource not found" } });
  }
  console.error(err);
  res.status(500).json({ error: { message: "Internal server error" } });
}
