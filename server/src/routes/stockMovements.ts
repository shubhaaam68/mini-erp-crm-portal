import { Router } from "express";
import { asyncHandler, paginated, readPaging } from "../lib/http";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// GET /stock-movements?productId=&type=&page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = readPaging(req.query);
    const where: any = {};
    if (req.query.productId) where.productId = String(req.query.productId);
    if (req.query.type) where.type = String(req.query.type);
    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { name: true, sku: true } },
          createdBy: { select: { name: true, role: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    paginated(res, rows, total, page, pageSize);
  })
);

export default router;
