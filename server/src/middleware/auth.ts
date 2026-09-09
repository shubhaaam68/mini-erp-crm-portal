import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { forbidden, unauthorized } from "../lib/http";

export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

/** Requires a valid Bearer token. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized("Missing Bearer token"));
  try {
    req.user = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}

/** Requires the authenticated user to hold one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`Requires role: ${roles.join(" or ")}`));
    }
    next();
  };
}
