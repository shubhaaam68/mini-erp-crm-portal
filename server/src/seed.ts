import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";

/**
 * Seeds four role logins plus demo customers, products and one confirmed challan
 * so reviewers can log in and see a populated system immediately.
 */
async function main() {
  // Idempotent: safe to run on every deploy. If demo data already exists, do nothing
  // (avoids duplicating challans/follow-ups when the build command re-runs the seed).
  const existing = await prisma.challan.count();
  if (existing > 0) {
    console.log("Seed skipped: database already seeded.");
    return;
  }
  const password = await bcrypt.hash("Password@123", 10);
  const users = [
    { name: "Aditi Admin", email: "admin@erpdemo.com", role: "ADMIN" as const },
    { name: "Sagar Sales", email: "sales@erpdemo.com", role: "SALES" as const },
    { name: "Wasim Warehouse", email: "warehouse@erpdemo.com", role: "WAREHOUSE" as const },
    { name: "Anita Accounts", email: "accounts@erpdemo.com", role: "ACCOUNTS" as const },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash: password },
      create: { ...u, passwordHash: password },
    });
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@erpdemo.com" } });
  const sales = await prisma.user.findUniqueOrThrow({ where: { email: "sales@erpdemo.com" } });

  const customerData = [
    {
      name: "Rakesh Mehta",
      mobile: "9822012345",
      email: "rakesh@mehtatraders.in",
      businessName: "Mehta Traders",
      gstNumber: "27AABCU9603R1ZM",
      type: "WHOLESALE" as const,
      address: "Shop 14, Market Yard, Pune 411037",
      status: "ACTIVE" as const,
      notes: "Buys detergent cases every fortnight.",
    },
    {
      name: "Sunita Patil",
      mobile: "9890054321",
      email: "sunita@patilstores.com",
      businessName: "Patil Stores",
      type: "RETAIL" as const,
      address: "Lane 3, Kothrud, Pune 411038",
      status: "LEAD" as const,
      notes: "Asked for a rate list.",
    },
    {
      name: "Imran Shaikh",
      mobile: "9765098765",
      email: "imran@shaikhdistribution.in",
      businessName: "Shaikh Distribution",
      gstNumber: "27AACCS1234M1Z8",
      type: "DISTRIBUTOR" as const,
      address: "Plot 22, MIDC Bhosari, Pune 411026",
      status: "ACTIVE" as const,
      notes: "Largest account; credit terms 30 days.",
    },
  ];
  const customers = [];
  for (const c of customerData) {
    customers.push(
      await prisma.customer.upsert({
        where: { id: (await prisma.customer.findFirst({ where: { mobile: c.mobile } }))?.id || "00000000-0000-0000-0000-000000000000" },
        update: c,
        create: c,
      })
    );
  }

  await prisma.followUp.create({
    data: {
      customerId: customers[1].id,
      note: "Called and shared the wholesale rate list on WhatsApp.",
      nextDate: new Date(Date.now() + 3 * 86400000),
      createdById: sales.id,
    },
  });

  const productData = [
    { name: "Surf Excel 1kg", sku: "SKU-DET-001", category: "Detergent", unitPrice: 145.5, currentStock: 240, minStockAlert: 50, location: "Warehouse A" },
    { name: "Colgate Strong Teeth 200g", sku: "SKU-ORL-002", category: "Oral Care", unitPrice: 98.0, currentStock: 120, minStockAlert: 40, location: "Warehouse A" },
    { name: "Tata Salt 1kg", sku: "SKU-GRO-003", category: "Grocery", unitPrice: 28.0, currentStock: 35, minStockAlert: 60, location: "Warehouse B" },
    { name: "Parle-G Family Pack", sku: "SKU-BIS-004", category: "Biscuits", unitPrice: 55.0, currentStock: 400, minStockAlert: 100, location: "Warehouse B" },
    { name: "Dettol Handwash 750ml", sku: "SKU-HYG-005", category: "Hygiene", unitPrice: 189.0, currentStock: 18, minStockAlert: 25, location: "Warehouse A" },
  ];
  const products = [];
  for (const p of productData) {
    const product = await prisma.product.upsert({ where: { sku: p.sku }, update: p, create: p });
    products.push(product);
    const hasOpening = await prisma.stockMovement.findFirst({
      where: { productId: product.id, reason: "Opening stock" },
    });
    if (!hasOpening) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          quantity: p.currentStock,
          type: "IN",
          reason: "Opening stock",
          createdById: admin.id,
        },
      });
    }
  }

  const existingChallan = await prisma.challan.findFirst();
  if (!existingChallan) {
    const items = [
      { p: products[0], qty: 10 },
      { p: products[3], qty: 20 },
    ].map(({ p, qty }) => ({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      category: p.category,
      unitPrice: Number(p.unitPrice),
      quantity: qty,
      lineTotal: Number((Number(p.unitPrice) * qty).toFixed(2)),
    }));
    const challan = await prisma.challan.create({
      data: {
        challanNumber: `CH-${new Date().getFullYear()}-0001`,
        customerId: customers[0].id,
        customerName: customers[0].name,
        customerMobile: customers[0].mobile,
        customerGst: customers[0].gstNumber,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        remarks: "Seeded demo challan",
        totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
        totalAmount: Number(items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2)),
        createdById: sales.id,
        items: { create: items },
      },
    });
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      });
      await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          type: "OUT",
          reason: `Sales challan ${challan.challanNumber} confirmed`,
          reference: challan.challanNumber,
          createdById: sales.id,
        },
      });
    }
  }

  console.log("Seed complete. Login with admin@erpdemo.com / Password@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
