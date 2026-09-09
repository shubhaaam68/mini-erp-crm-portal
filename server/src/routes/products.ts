import { Router } from "express";
import { z } from "zod";
import { asyncHandler, badRequest, notFound, paginated, readPaging } from "../lib/http";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().min(2, "SKU is required"),
  category: z.string().min(2, "Category is required"),
  unitPrice: z.coerce.number().positive("Unit price must be greater than 0"),
  currentStock: z.coerce.number().int().min(0, "Stock cannot be negative").default(0),
  minStockAlert: z.coerce.number().int().min(0).default(0),
  location: z.string().min(1, "Location/warehouse is required"),
});

const adjustSchema = z.object({
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  type: z.enum(["IN", "OUT"]),
  reason: z.string().min(2, "Reason is required"),
});

// GET /products?search=&category=&lowStock=true&page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = readPaging(req.query);
    const search = String(req.query.search || "").trim();
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }
    if (req.query.category) where.category = String(req.query.category);

    let [rows, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take, orderBy: { name: "asc" } }),
      prisma.product.count({ where }),
    ]);
    if (String(req.query.lowStock) === "true") {
      rows = rows.filter((p) => p.currentStock <= p.minStockAlert);
    }
    paginated(res, rows, total, page, pageSize);
  })
);

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.findMany({
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    res.json({ data: rows.map((r) => r.category) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        movements: {
          orderBy: { createdAt: "desc" },
          take: 25,
          include: { createdBy: { select: { name: true, role: true } } },
        },
      },
    });
    if (!product) throw notFound("Product not found");
    res.json({ data: product });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "WAREHOUSE"),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof productSchema>;
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: body });
      if (body.currentStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            quantity: body.currentStock,
            type: "IN",
            reason: "Opening stock",
            createdById: req.user!.id,
          },
        });
      }
      return created;
    });
    res.status(201).json({ data: product });
  })
);

router.put(
  "/:id",
  requireRole("ADMIN", "WAREHOUSE"),
  validateBody(productSchema.omit({ currentStock: true })),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data: product });
  })
);

// POST /products/:id/stock — manual stock IN/OUT, always logged
router.post(
  "/:id/stock",
  requireRole("ADMIN", "WAREHOUSE"),
  validateBody(adjustSchema),
  asyncHandler(async (req, res) => {
    const { quantity, type, reason } = req.body as z.infer<typeof adjustSchema>;
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: req.params.id } });
      if (!product) throw notFound("Product not found");
      if (type === "OUT" && product.currentStock < quantity) {
        throw badRequest(
          `Insufficient stock for ${product.name}: available ${product.currentStock}, requested ${quantity}`
        );
      }
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { currentStock: { [type === "IN" ? "increment" : "decrement"]: quantity } as any },
      });
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity,
          type,
          reason,
          createdById: req.user!.id,
        },
      });
      return { product: updated, movement };
    });
    res.status(201).json({ data: result });
  })
);

export default router;
