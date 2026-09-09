import { Router } from "express";
import { z } from "zod";
import { asyncHandler, badRequest, conflict, notFound, paginated, readPaging } from "../lib/http";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

const challanSchema = z.object({
  customerId: z.string().uuid("Select a valid customer"),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  remarks: z.string().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        productId: z.string().uuid("Select a valid product"),
        quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
      })
    )
    .min(1, "Add at least one product"),
});

/**
 * Challan numbers look like CH-2026-0001 and are generated per year.
 * Generated inside the same transaction as the challan to avoid gaps/duplicates.
 */
async function nextChallanNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CH-${year}-`;
  const last = await tx.challan.findFirst({
    where: { challanNumber: { startsWith: prefix } },
    orderBy: { challanNumber: "desc" },
    select: { challanNumber: true },
  });
  const seq = last ? Number(last.challanNumber.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(4, "0");
}

/** Reduces stock for every line of a challan and writes a stock movement log entry. */
async function reduceStock(tx: any, challan: any, userId: string) {
  for (const item of challan.items) {
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product) throw notFound(`Product ${item.productName} no longer exists`);
    if (product.currentStock < item.quantity) {
      throw badRequest(
        `Insufficient stock for ${product.name} (${product.sku}): available ${product.currentStock}, required ${item.quantity}`
      );
    }
    await tx.product.update({
      where: { id: product.id },
      data: { currentStock: { decrement: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        quantity: item.quantity,
        type: "OUT",
        reason: `Sales challan ${challan.challanNumber} confirmed`,
        reference: challan.challanNumber,
        createdById: userId,
      },
    });
  }
}

// GET /challans?search=&status=&customerId=&page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = readPaging(req.query);
    const search = String(req.query.search || "").trim();
    const where: any = {};
    if (search) {
      where.OR = [
        { challanNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.customerId) where.customerId = String(req.query.customerId);

    const [rows, total] = await Promise.all([
      prisma.challan.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true, role: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.challan.count({ where }),
    ]);
    paginated(res, rows, total, page, pageSize);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({
      where: { id: req.params.id },
      include: { items: true, createdBy: { select: { name: true, role: true } }, customer: true },
    });
    if (!challan) throw notFound("Challan not found");
    res.json({ data: challan });
  })
);

// POST /challans — create as DRAFT or straight to CONFIRMED (stock reduced when confirmed)
router.post(
  "/",
  requireRole("ADMIN", "SALES"),
  validateBody(challanSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof challanSchema>;
    const ids = body.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) throw badRequest("The same product is listed twice");

    const challan = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: body.customerId } });
      if (!customer) throw notFound("Customer not found");
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      if (products.length !== ids.length) throw notFound("One or more products were not found");

      // Product snapshot data is stored on the line, not just the product ID.
      const items = body.items.map((line) => {
        const p = products.find((x) => x.id === line.productId)!;
        const unitPrice = Number(p.unitPrice);
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          category: p.category,
          unitPrice,
          quantity: line.quantity,
          lineTotal: Number((unitPrice * line.quantity).toFixed(2)),
        };
      });

      const created = await tx.challan.create({
        data: {
          challanNumber: await nextChallanNumber(tx),
          customerId: customer.id,
          customerName: customer.name,
          customerMobile: customer.mobile,
          customerGst: customer.gstNumber,
          status: body.status,
          remarks: body.remarks || null,
          totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
          totalAmount: Number(items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2)),
          createdById: req.user!.id,
          confirmedAt: body.status === "CONFIRMED" ? new Date() : null,
          items: { create: items },
        },
        include: { items: true },
      });

      if (body.status === "CONFIRMED") await reduceStock(tx, created, req.user!.id);
      return created;
    });

    res.status(201).json({ data: challan });
  })
);

// POST /challans/:id/confirm — draft -> confirmed, reduces stock atomically
router.post(
  "/:id/confirm",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.challan.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!existing) throw notFound("Challan not found");
      if (existing.status !== "DRAFT") {
        throw conflict(`Only draft challans can be confirmed (current status: ${existing.status})`);
      }
      await reduceStock(tx, existing, req.user!.id);
      return tx.challan.update({
        where: { id: existing.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        include: { items: true },
      });
    });
    res.json({ data: challan });
  })
);

// POST /challans/:id/cancel — confirmed challans return their stock
router.post(
  "/:id/cancel",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.challan.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!existing) throw notFound("Challan not found");
      if (existing.status === "CANCELLED") throw conflict("Challan is already cancelled");

      if (existing.status === "CONFIRMED") {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: "IN",
              reason: `Sales challan ${existing.challanNumber} cancelled`,
              reference: existing.challanNumber,
              createdById: req.user!.id,
            },
          });
        }
      }
      return tx.challan.update({
        where: { id: existing.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
        include: { items: true },
      });
    });
    res.json({ data: challan });
  })
);

export default router;
