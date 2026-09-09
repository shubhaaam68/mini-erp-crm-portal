import { Response } from "express";

/** Error carrying an HTTP status code, thrown by route handlers. */
export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, d);
export const unauthorized = (m = "Authentication required") => new HttpError(401, m);
export const forbidden = (m = "You do not have permission to perform this action") =>
  new HttpError(403, m);
export const notFound = (m = "Resource not found") => new HttpError(404, m);
export const conflict = (m: string, d?: unknown) => new HttpError(409, m, d);

/** Wraps an async handler so rejected promises reach the error middleware. */
export function asyncHandler<T extends (...a: any[]) => Promise<any>>(fn: T) {
  return (req: any, res: any, next: any) => fn(req, res, next).catch(next);
}

export function paginated(
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  pageSize: number
) {
  res.json({
    data,
    meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

/** Parses ?page= / ?pageSize= into safe values. */
export function readPaging(query: any) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
