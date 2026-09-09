import { Router } from "express";
import { z } from "zod";
import { asyncHandler, notFound, paginated, readPaging } from "../lib/http";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters"),
  mobile: z.string().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  businessName: z.string().min(2, "Business name is required"),
  gstNumber: z.string().max(20).optional().or(z.literal("")),
  type: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().min(3, "Address is required"),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]),
  followUpDate: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const followUpSchema = z.object({
  note: z.string().min(2, "Note is required"),
  nextDate: z.string().datetime().optional().or(z.literal("")),
});

const clean = (body: z.infer<typeof customerSchema>) => ({
  ...body,
  email: body.email || null,
  gstNumber: body.gstNumber || null,
  notes: body.notes || null,
  followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
});

// GET /customers?search=&status=&type=&page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, skip, take } = readPaging(req.query);
    const search = String(req.query.search || "").trim();
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.customer.count({ where }),
    ]);
    paginated(res, rows, total, page, pageSize);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        followUps: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { name: true, role: true } } },
        },
        challans: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!customer) throw notFound("Customer not found");
    res.json({ data: customer });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "SALES"),
  validateBody(customerSchema),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.create({ data: clean(req.body) });
    res.status(201).json({ data: customer });
  })
);

router.put(
  "/:id",
  requireRole("ADMIN", "SALES"),
  validateBody(customerSchema),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: clean(req.body),
    });
    res.json({ data: customer });
  })
);

router.post(
  "/:id/follow-ups",
  requireRole("ADMIN", "SALES"),
  validateBody(followUpSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!exists) throw notFound("Customer not found");
    const followUp = await prisma.followUp.create({
      data: {
        customerId: req.params.id,
        note: req.body.note,
        nextDate: req.body.nextDate ? new Date(req.body.nextDate) : null,
        createdById: req.user!.id,
      },
    });
    if (req.body.nextDate) {
      await prisma.customer.update({
        where: { id: req.params.id },
        data: { followUpDate: new Date(req.body.nextDate) },
      });
    }
    res.status(201).json({ data: followUp });
  })
);

export default router;
