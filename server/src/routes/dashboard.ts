import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [customers, leads, products, drafts, confirmed, allProducts, recent] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: "LEAD" } }),
      prisma.product.count(),
      prisma.challan.count({ where: { status: "DRAFT" } }),
      prisma.challan.count({ where: { status: "CONFIRMED" } }),
      prisma.product.findMany({ select: { name: true, sku: true, currentStock: true, minStockAlert: true } }),
      prisma.challan.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          challanNumber: true,
          customerName: true,
          status: true,
          totalQuantity: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
    ]);
    const lowStock = allProducts.filter((p) => p.currentStock <= p.minStockAlert);
    res.json({
      data: {
        customers,
        leads,
        products,
        draftChallans: drafts,
        confirmedChallans: confirmed,
        lowStockCount: lowStock.length,
        lowStock: lowStock.slice(0, 5),
        recentChallans: recent,
      },
    });
  })
);

export default router;
