import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("========================================================");
  console.log("🔄 Recalculating Entire System Finances & Balances");
  console.log("========================================================\n");

  // 1. Recalculate Purchases
  console.log("📦 1. Recalculating Purchases...");
  const purchases = await prisma.purchase.findMany({
    include: {
      items: true,
      payments: true,
    },
  });

  for (const purchase of purchases) {
    const subtotal = Number(
      purchase.items
        .reduce((sum, it) => {
          const effectiveKg = Math.max(0, it.weightKg - (it.spoiledWeightKg ?? 0));
          return sum + effectiveKg * it.unitPricePerKg;
        }, 0)
        .toFixed(2)
    );

    const transport = purchase.transportCharges ?? 0;
    const ice = purchase.iceCharges ?? 0;
    const labour = purchase.labourCharges ?? 0;
    const totalAmount = Number((subtotal + transport + ice + labour).toFixed(2));

    const paidAmount = Number(
      purchase.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
    );
    const balanceAmount = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));

    let paymentStatus = purchase.paymentStatus;
    if (balanceAmount <= 0 && totalAmount > 0) {
      paymentStatus = "PAID";
    } else if (paidAmount > 0) {
      paymentStatus = "PARTIAL";
    } else {
      paymentStatus = "UNPAID";
    }

    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        subtotal,
        totalAmount,
        paidAmount,
        balanceAmount,
        paymentStatus,
      },
    });

    // Update item totalCosts
    for (const item of purchase.items) {
      const effectiveKg = Math.max(0, item.weightKg - (item.spoiledWeightKg ?? 0));
      const totalCost = Number((effectiveKg * item.unitPricePerKg).toFixed(2));
      await prisma.purchaseItem.update({
        where: { id: item.id },
        data: { totalCost },
      });
    }
  }
  console.log(`  ✓ ${purchases.length} purchases updated\n`);

  // 2. Recalculate Sales
  console.log("💼 2. Recalculating Sales & Invoices...");
  const sales = await prisma.sale.findMany({
    include: {
      items: true,
      payments: true,
      invoice: true,
    },
  });

  for (const sale of sales) {
    // Subtotal = sum of (weightKg - spoiledWeightKg) * unitPricePerKg
    const subtotal = Number(
      sale.items
        .reduce((sum, it) => {
          const effectiveKg = Math.max(0, it.weightKg - (it.spoiledWeightKg ?? 0));
          return sum + effectiveKg * it.unitPricePerKg;
        }, 0)
        .toFixed(2)
    );

    // Customer Billed Grand Total = subtotal + taxAmount - discountAmount (without adding order expenses)
    const tax = sale.taxAmount ?? 0;
    const discount = sale.discountAmount ?? 0;
    const totalAmount = Number(Math.max(0, subtotal + tax - discount).toFixed(2));

    const paidAmount = Number(
      sale.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
    );
    const balanceAmount = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));

    let paymentStatus = sale.paymentStatus;
    if (balanceAmount <= 0 && totalAmount > 0) {
      paymentStatus = "PAID";
    } else if (paidAmount > 0) {
      paymentStatus = "PARTIAL";
    } else {
      paymentStatus = "UNPAID";
    }

    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        subtotal,
        totalAmount,
        paidAmount,
        balanceAmount,
        paymentStatus,
      },
    });

    // Update SaleItem totalPrices
    for (const item of sale.items) {
      const effectiveKg = Math.max(0, item.weightKg - (item.spoiledWeightKg ?? 0));
      const totalPrice = Number((effectiveKg * item.unitPricePerKg).toFixed(2));
      await prisma.saleItem.update({
        where: { id: item.id },
        data: { totalPrice },
      });
    }

    // Update Invoice if linked
    if (sale.invoice) {
      await prisma.invoice.update({
        where: { id: sale.invoice.id },
        data: {
          subtotal,
          totalAmount,
          paidAmount,
          balanceAmount,
          status:
            sale.status === "CANCELLED"
              ? "CANCELLED"
              : paymentStatus === "PAID"
              ? "PAID"
              : paymentStatus === "PARTIAL"
              ? "PARTIAL"
              : "ISSUED",
        },
      });
    }
  }
  console.log(`  ✓ ${sales.length} sales & invoices updated\n`);

  // 3. Recalculate Customer Outstanding Balances
  console.log("👥 3. Recalculating Customer Balances...");
  const customers = await prisma.customer.findMany({
    include: {
      sales: {
        where: { status: { notIn: ["CANCELLED"] } },
      },
    },
  });

  for (const customer of customers) {
    const outstandingBalance = Number(
      customer.sales.reduce((sum, s) => sum + s.balanceAmount, 0).toFixed(2)
    );
    await prisma.customer.update({
      where: { id: customer.id },
      data: { outstandingBalance },
    });
  }
  console.log(`  ✓ ${customers.length} customer balances updated\n`);

  // 4. Recalculate Supplier Outstanding Balances
  console.log("🚢 4. Recalculating Supplier Balances...");
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchases: {
        where: { status: { notIn: ["CANCELLED"] } },
      },
    },
  });

  for (const supplier of suppliers) {
    const balance = Number(
      supplier.purchases.reduce((sum, p) => sum + p.balanceAmount, 0).toFixed(2)
    );
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { balance },
    });
  }
  console.log(`  ✓ ${suppliers.length} supplier balances updated\n`);

  // 5. Compute System Overall Financial Totals
  console.log("========================================================");
  console.log("📊 System Financial Net Profit Summary");
  console.log("========================================================");

  const salesAgg = await prisma.sale.aggregate({
    where: { status: { notIn: ["CANCELLED"] } },
    _sum: {
      subtotal: true,
      totalAmount: true,
      iceCharges: true,
      railwayCharges: true,
      coverRopeCharges: true,
      thermocolBoxCharges: true,
      packingCharges: true,
    },
  });

  const purchaseAgg = await prisma.purchase.aggregate({
    where: { status: { notIn: ["CANCELLED"] } },
    _sum: {
      subtotal: true,
      transportCharges: true,
      iceCharges: true,
      labourCharges: true,
      totalAmount: true,
    },
  });

  const packingAgg = await prisma.packingCost.aggregate({
    _sum: { totalCost: true },
  });

  const expenseAgg = await prisma.expense.aggregate({
    _sum: { amount: true },
  });

  const totalBilledRevenue = salesAgg._sum.totalAmount ?? 0;
  const totalPurchaseCost = purchaseAgg._sum.subtotal ?? 0;
  const totalPurchaseOverheads =
    (purchaseAgg._sum.transportCharges ?? 0) +
    (purchaseAgg._sum.iceCharges ?? 0) +
    (purchaseAgg._sum.labourCharges ?? 0) +
    (packingAgg._sum.totalCost ?? 0);

  const totalOrderDirectExpenses =
    (salesAgg._sum.iceCharges ?? 0) +
    (salesAgg._sum.railwayCharges ?? 0) +
    (salesAgg._sum.coverRopeCharges ?? 0) +
    (salesAgg._sum.thermocolBoxCharges ?? 0) +
    (salesAgg._sum.packingCharges ?? 0);

  const totalExpenses = expenseAgg._sum.amount ?? 0;

  const netProfit = totalBilledRevenue - totalPurchaseCost - totalPurchaseOverheads - totalExpenses;
  const netProfitMargin = totalBilledRevenue > 0 ? (netProfit / totalBilledRevenue) * 100 : 0;

  console.log(`  Total Billed Sales Revenue:  ₹${totalBilledRevenue.toLocaleString("en-IN")}`);
  console.log(`  Less Fish Purchase Cost:    -₹${totalPurchaseCost.toLocaleString("en-IN")}`);
  console.log(`  Less Purchase Overheads:    -₹${totalPurchaseOverheads.toLocaleString("en-IN")}`);
  console.log(`  Less Business Expenses:     -₹${totalExpenses.toLocaleString("en-IN")}`);
  console.log("  ------------------------------------------------------");
  console.log(`  Net Realized Profit:         ₹${netProfit.toLocaleString("en-IN")} (${netProfitMargin.toFixed(1)}% Net Margin)`);
  console.log("========================================================\n");
}

main()
  .catch((e) => {
    console.error("Error during recalculation:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
