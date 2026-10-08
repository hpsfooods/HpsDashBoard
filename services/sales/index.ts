import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit";
import {
  createSaleSchema,
  updateSaleSchema,
  recordSalePaymentSchema,
} from "@/validations/sale.schema";
import type {
  SaleDTO,
  SaleDetailDTO,
  SaleFilterParams,
  CreateSaleInput,
  UpdateSaleInput,
  UpdateSaleSpoilageInput,
  RecordSalePaymentInput,
  SalesLookupsDTO,
  PaymentStatus,
} from "@/types";

/**
 * Authoritative financial calculation helper for Sales.
 */
export function calculateSaleTotals<
  T extends { weightKg: number; unitPricePerKg: number; exactPurchasingCost?: number | null }
>(
  items: T[],
  taxAmount = 0,
  discountAmount = 0,
  paidAmount = 0,
  iceCharges = 0,
  railwayCharges = 0,
  coverRopeCharges = 0,
  thermocolBoxCharges = 0,
  packingCharges = 0
) {
  const calculatedItems = items.map((item) => ({
    ...item,
    exactPurchasingCost:
      item.exactPurchasingCost !== undefined && item.exactPurchasingCost !== null
        ? Number(item.exactPurchasingCost)
        : null,
    totalPrice: Number((item.weightKg * item.unitPricePerKg).toFixed(2)),
  }));

  const totalWeightKg = Number(
    items.reduce((sum, item) => sum + item.weightKg, 0).toFixed(2)
  );

  const subtotal = Number(
    calculatedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)
  );

  const iceChgs = Number((iceCharges || 0).toFixed(2));
  const rlyCharges = Number((railwayCharges || 0).toFixed(2));
  const cvrCharges = Number((coverRopeCharges || 0).toFixed(2));
  const boxCharges = Number((thermocolBoxCharges || 0).toFixed(2));
  const pkgCharges = Number((packingCharges || 0).toFixed(2));
  const tax = Number((taxAmount || 0).toFixed(2));
  const discount = Number((discountAmount || 0).toFixed(2));

  const totalAmount = Number(
    Math.max(
      0,
      subtotal + tax - discount
    ).toFixed(2)
  );
  const paid = Number((paidAmount || 0).toFixed(2));
  const balanceAmount = Number(Math.max(0, totalAmount - paid).toFixed(2));

  let paymentStatus: PaymentStatus = "UNPAID";
  if (balanceAmount <= 0 && totalAmount > 0) {
    paymentStatus = "PAID";
  } else if (paid > 0 && paid < totalAmount) {
    paymentStatus = "PARTIAL";
  }

  return {
    calculatedItems,
    totalWeightKg,
    subtotal,
    iceCharges: iceChgs,
    railwayCharges: rlyCharges,
    coverRopeCharges: cvrCharges,
    thermocolBoxCharges: boxCharges,
    packingCharges: pkgCharges,
    taxAmount: tax,
    discountAmount: discount,
    totalAmount,
    paidAmount: paid,
    balanceAmount,
    paymentStatus,
  };
}

/**
 * Automatically synchronizes operational expenses for sales charges.
 */
async function syncSaleExpenses(
  tx: any,
  sale: {
    id: string;
    saleNumber: string;
    saleDate: Date;
    iceCharges: number;
    railwayCharges: number;
    coverRopeCharges: number;
    thermocolBoxCharges: number;
    packingCharges: number;
    paymentMethod?: string;
  }
) {
  // Clean up previous auto-generated expenses for this sale order
  await tx.expense.deleteMany({
    where: {
      saleId: sale.id,
      notes: { contains: "[AUTO_SALE_CHARGE]" },
    },
  });

  const charges = [
    {
      code: "EXP-CAT-ICE",
      name: "Ice Cost",
      description: "Tube ice, crushed ice & dry ice for packing and dispatch",
      title: `Ice Charge - ${sale.saleNumber}`,
      amount: sale.iceCharges,
    },
    {
      code: "EXP-CAT-RLY",
      name: "Railway Freight / Charges",
      description: "Railway cargo and freight charges for sales dispatch",
      title: `Railway Charge - ${sale.saleNumber}`,
      amount: sale.railwayCharges,
    },
    {
      code: "EXP-CAT-CVR",
      name: "Cover & Rope Charges",
      description: "Cover sheets, plastic lining and securing ropes",
      title: `Cover & Rope Charge - ${sale.saleNumber}`,
      amount: sale.coverRopeCharges,
    },
    {
      code: "EXP-CAT-BOX",
      name: "Thermocol Boxes Cost",
      description: "Insulated thermocol packaging boxes",
      title: `Thermocol Box Charge - ${sale.saleNumber}`,
      amount: sale.thermocolBoxCharges,
    },
    {
      code: "EXP-CAT-PKG",
      name: "Packing Charges",
      description: "Packing labour and packaging processing charges",
      title: `Packing Charge - ${sale.saleNumber}`,
      amount: sale.packingCharges,
    },
  ];

  for (const charge of charges) {
    if (charge.amount > 0) {
      let category = await tx.expenseCategory.findUnique({
        where: { code: charge.code },
      });
      if (!category) {
        category = await tx.expenseCategory.create({
          data: {
            code: charge.code,
            name: charge.name,
            description: charge.description,
            isActive: true,
          },
        });
      }

      const expenseNumber = `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}-${Math.floor(Math.random() * 900 + 100)}`;
      await tx.expense.create({
        data: {
          expenseNumber,
          categoryId: category.id,
          title: charge.title,
          description: `Automatic operational expense for ${charge.name.toLowerCase()} on sale order ${sale.saleNumber}`,
          amount: Number(charge.amount.toFixed(2)),
          paymentMethod: (sale.paymentMethod as any) || "CASH",
          expenseDate: sale.saleDate,
          saleId: sale.id,
          notes: `[AUTO_SALE_CHARGE] Linked to ${sale.saleNumber}`,
        },
      });
    }
  }
}

/**
 * Helper to calculate current available stock for a specific fish species.
 */
export async function getAvailableFishStock(
  fishTypeId: string,
  tx: { inventoryTransaction: { findMany: (args: { where: { fishTypeId: string }; select: { quantityKg: true } }) => Promise<Array<{ quantityKg: number }>> } } = prisma
): Promise<number> {
  const transactions = await tx.inventoryTransaction.findMany({
    where: { fishTypeId },
    select: { quantityKg: true },
  });
  const currentStock = transactions.reduce((sum, t) => sum + t.quantityKg, 0);
  return Number(Math.max(0, currentStock).toFixed(2));
}

/**
 * Lists sales with multi-criteria filtering.
 */
export async function listSales(
  filterOptions: SaleFilterParams | number = {}
): Promise<SaleDTO[]> {
  const filters: SaleFilterParams =
    typeof filterOptions === "number"
      ? { limit: filterOptions }
      : filterOptions;

  try {
    const where: Record<string, unknown> = {};

    if (filters.customerId && filters.customerId !== "ALL") {
      where.customerId = filters.customerId;
    }

    if (filters.paymentStatus && filters.paymentStatus !== "ALL") {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.deliveryStatus && filters.deliveryStatus !== "ALL") {
      where.status = filters.deliveryStatus;
    }

    if (filters.fishTypeId && filters.fishTypeId !== "ALL") {
      where.items = {
        some: {
          fishTypeId: filters.fishTypeId,
        },
      };
    }

    // Date / Month / Year filter handling
    if (filters.date) {
      const startDate = new Date(filters.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.date);
      endDate.setHours(23, 59, 59, 999);
      where.saleDate = { gte: startDate, lte: endDate };
    } else if (
      (filters.year && filters.year !== "ALL") ||
      (filters.month && filters.month !== "ALL")
    ) {
      const year =
        filters.year && filters.year !== "ALL"
          ? parseInt(filters.year, 10)
          : new Date().getFullYear();
      const hasMonth = Boolean(filters.month && filters.month !== "ALL");
      const month =
        hasMonth && filters.month ? parseInt(filters.month, 10) - 1 : 0;
      const startMonth = hasMonth ? month : 0;
      const endMonth = hasMonth ? month + 1 : 12;

      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, endMonth, 0, 23, 59, 59, 999);
      where.saleDate = { gte: startDate, lte: endDate };
    }

    if (filters.invoiceNumber || filters.search) {
      const term = filters.invoiceNumber || filters.search;
      where.OR = [
        { saleNumber: { contains: term, mode: "insensitive" } },
        { customer: { name: { contains: term, mode: "insensitive" } } },
        { customer: { companyName: { contains: term, mode: "insensitive" } } },
      ];
    }

    const skip = filters.page && filters.limit ? (filters.page - 1) * filters.limit : 0;
    const take = filters.limit ?? 50;

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      take,
      skip,
      include: {
        customer: true,
        items: true,
      },
    });

    return sales.map((sale) => {
      const rawCost = sale.items.reduce((sum, item) => {
        const effectiveKg = Math.max(0, item.weightKg - (item.spoiledWeightKg ?? 0));
        return sum + effectiveKg * (item.exactPurchasingCost ?? 0);
      }, 0);
      const orderExpenses =
        (sale.iceCharges ?? 0) +
        (sale.railwayCharges ?? 0) +
        (sale.coverRopeCharges ?? 0) +
        (sale.thermocolBoxCharges ?? 0) +
        (sale.packingCharges ?? 0);
      const netProfit = Number((sale.totalAmount - rawCost - orderExpenses).toFixed(2));
      const netProfitMargin =
        sale.totalAmount > 0 ? Number(((netProfit / sale.totalAmount) * 100).toFixed(1)) : 0;

      return {
        id: sale.id,
        saleNumber: sale.saleNumber,
        customerId: sale.customerId,
        customerName: sale.customer.companyName
          ? `${sale.customer.name} (${sale.customer.companyName})`
          : sale.customer.name,
        saleDate: sale.saleDate.toISOString(),
        deliveryDate: sale.deliveryDate?.toISOString() ?? null,
        status: sale.status,
        paymentStatus: sale.paymentStatus,
        subtotal: sale.subtotal,
        iceCharges: sale.iceCharges ?? 0,
        railwayCharges: sale.railwayCharges ?? 0,
        coverRopeCharges: sale.coverRopeCharges ?? 0,
        thermocolBoxCharges: sale.thermocolBoxCharges ?? 0,
        packingCharges: sale.packingCharges ?? 0,
        taxAmount: sale.taxAmount,
        discountAmount: sale.discountAmount,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        balanceAmount: sale.balanceAmount,
        totalWeightKg: sale.items.reduce((sum, item) => sum + item.weightKg, 0),
        itemsCount: sale.items.length,
        netProfit,
        netProfitMargin,
      };
    });
  } catch (error) {
    console.error("Failed to fetch sales list:", error);
    return [];
  }
}

/**
 * Counts total sales matching filter criteria for pagination
 */
export async function countSales(
  filterOptions: SaleFilterParams | number = {}
): Promise<number> {
  const filters: SaleFilterParams =
    typeof filterOptions === "number"
      ? { limit: filterOptions }
      : filterOptions;

  try {
    const where: Record<string, unknown> = {};

    if (filters.customerId && filters.customerId !== "ALL") {
      where.customerId = filters.customerId;
    }

    if (filters.paymentStatus && filters.paymentStatus !== "ALL") {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.deliveryStatus && filters.deliveryStatus !== "ALL") {
      where.status = filters.deliveryStatus;
    }

    if (filters.fishTypeId && filters.fishTypeId !== "ALL") {
      where.items = {
        some: {
          fishTypeId: filters.fishTypeId,
        },
      };
    }

    if (filters.date) {
      const startDate = new Date(filters.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.date);
      endDate.setHours(23, 59, 59, 999);
      where.saleDate = { gte: startDate, lte: endDate };
    } else if (
      (filters.year && filters.year !== "ALL") ||
      (filters.month && filters.month !== "ALL")
    ) {
      const year =
        filters.year && filters.year !== "ALL"
          ? parseInt(filters.year, 10)
          : new Date().getFullYear();
      const hasMonth = Boolean(filters.month && filters.month !== "ALL");
      const month =
        hasMonth && filters.month ? parseInt(filters.month, 10) - 1 : 0;
      const startMonth = hasMonth ? month : 0;
      const endMonth = hasMonth ? month + 1 : 12;

      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, endMonth, 0, 23, 59, 59, 999);
      where.saleDate = { gte: startDate, lte: endDate };
    }

    if (filters.invoiceNumber || filters.search) {
      const term = filters.invoiceNumber || filters.search;
      where.OR = [
        { saleNumber: { contains: term, mode: "insensitive" } },
        { customer: { name: { contains: term, mode: "insensitive" } } },
        { customer: { companyName: { contains: term, mode: "insensitive" } } },
      ];
    }

    return await prisma.sale.count({ where });
  } catch {
    return 0;
  }
}


/**
 * Retrieves a single sale by ID with full customer, items, and payments.
 */
export async function getSaleById(id: string): Promise<SaleDetailDTO | null> {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            fishType: true,
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        expenses: {
          include: {
            category: true,
          },
          orderBy: { expenseDate: "desc" },
        },
      },
    });

    if (!sale) {
      return null;
    }

    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      customerId: sale.customerId,
      customerName: sale.customer.name,
      customerCompany: sale.customer.companyName,
      customerPhone: sale.customer.phone,
      customerEmail: sale.customer.email,
      customerAddress: sale.customer.deliveryAddress,
      saleDate: sale.saleDate.toISOString(),
      deliveryDate: sale.deliveryDate?.toISOString() ?? null,
      status: sale.status,
      subtotal: sale.subtotal,
      iceCharges: sale.iceCharges ?? 0,
      railwayCharges: sale.railwayCharges ?? 0,
      coverRopeCharges: sale.coverRopeCharges ?? 0,
      thermocolBoxCharges: sale.thermocolBoxCharges ?? 0,
      packingCharges: sale.packingCharges ?? 0,
      taxAmount: sale.taxAmount,
      discountAmount: sale.discountAmount,
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount,
      balanceAmount: sale.balanceAmount,
      paymentStatus: sale.paymentStatus,
      totalWeightKg: sale.items.reduce((sum, item) => sum + item.weightKg, 0),
      notes: sale.notes,
      createdAt: sale.createdAt.toISOString(),
      updatedAt: sale.updatedAt.toISOString(),
      items: sale.items.map((item) => ({
        id: item.id,
        saleId: item.saleId,
        fishTypeId: item.fishTypeId,
        fishTypeName: item.fishType.name,
        fishTypeCode: item.fishType.code,
        grade: item.grade,
        weightKg: item.weightKg,
        exactPurchasingCost: item.exactPurchasingCost ?? null,
        spoiledWeightKg: item.spoiledWeightKg ?? 0,
        spoilageReason: item.spoilageReason ?? null,
        effectiveWeightKg: Math.max(0, Number((item.weightKg - (item.spoiledWeightKg ?? 0)).toFixed(2))),
        unitPricePerKg: item.unitPricePerKg,
        totalPrice: item.totalPrice,
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
      })),
      payments: sale.payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate.toISOString(),
        referenceNumber: p.referenceNumber,
        notes: p.notes,
      })),
      expenses: (sale.expenses || []).map((e) => ({
        id: e.id,
        expenseNumber: e.expenseNumber,
        title: e.title,
        categoryName: e.category.name,
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        expenseDate: e.expenseDate.toISOString(),
        paidTo: e.paidTo,
        invoiceUrl: e.invoiceUrl,
        invoiceFileName: e.invoiceFileName,
      })),
      netProfit: Number(
        (
          sale.totalAmount -
          sale.items.reduce(
            (sum, item) =>
              sum +
              Math.max(0, item.weightKg - (item.spoiledWeightKg ?? 0)) *
                (item.exactPurchasingCost ?? 0),
            0
          ) -
          ((sale.iceCharges ?? 0) +
            (sale.railwayCharges ?? 0) +
            (sale.coverRopeCharges ?? 0) +
            (sale.thermocolBoxCharges ?? 0) +
            (sale.packingCharges ?? 0) +
            (sale.expenses || [])
              .filter(
                (e) =>
                  ![
                    "Ice Cost",
                    "Railway Freight / Charges",
                    "Cover & Rope Charges",
                    "Thermocol Boxes Cost",
                    "Packing Charges",
                  ].includes(e.category.name)
              )
              .reduce((sum, e) => sum + e.amount, 0))
        ).toFixed(2)
      ),
      netProfitMargin:
        sale.totalAmount > 0
          ? Number(
              (
                ((sale.totalAmount -
                  sale.items.reduce(
                    (sum, item) =>
                      sum +
                      Math.max(0, item.weightKg - (item.spoiledWeightKg ?? 0)) *
                        (item.exactPurchasingCost ?? 0),
                    0
                  ) -
                  ((sale.iceCharges ?? 0) +
                    (sale.railwayCharges ?? 0) +
                    (sale.coverRopeCharges ?? 0) +
                    (sale.thermocolBoxCharges ?? 0) +
                    (sale.packingCharges ?? 0) +
                    (sale.expenses || [])
                      .filter(
                        (e) =>
                          ![
                            "Ice Cost",
                            "Railway Freight / Charges",
                            "Cover & Rope Charges",
                            "Thermocol Boxes Cost",
                            "Packing Charges",
                          ].includes(e.category.name)
                      )
                      .reduce((sum, e) => sum + e.amount, 0))) /
                  sale.totalAmount) *
                100
              ).toFixed(1)
            )
          : 0,
    };
  } catch (error) {
    console.error(`Failed to fetch sale detail for ${id}:`, error);
    return null;
  }
}

/**
 * Creates a new customer/company on the fly
 */
export async function createCustomer(data: {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  deliveryAddress?: string;
  customerType?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
}) {
  const count = await prisma.customer.count();
  const code = `CUST-${String(count + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;

  const customer = await prisma.customer.create({
    data: {
      code,
      name: data.name.trim(),
      companyName: data.companyName?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      deliveryAddress: data.deliveryAddress?.trim() || null,
      customerType: data.customerType || "Wholesale",
      creditLimit: data.creditLimit ? Number(data.creditLimit) : 50000,
      paymentTermsDays: data.paymentTermsDays ? Number(data.paymentTermsDays) : 15,
      outstandingBalance: 0,
      isActive: true,
    },
  });

  return {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    companyName: customer.companyName,
    customerType: customer.customerType,
    email: customer.email,
    phone: customer.phone,
    deliveryAddress: customer.deliveryAddress,
    creditLimit: customer.creditLimit,
    outstandingBalance: customer.outstandingBalance,
    paymentTermsDays: customer.paymentTermsDays,
    isActive: customer.isActive,
  };
}

/**
 * Creates a sale order and logs negative inventory transaction.
 */
export async function createSale(
  rawInput: CreateSaleInput,
  userId?: string
) {
  const validated = createSaleSchema.parse(rawInput);

  const {
    calculatedItems,
    totalWeightKg,
    subtotal,
    iceCharges,
    railwayCharges,
    coverRopeCharges,
    thermocolBoxCharges,
    packingCharges,
    taxAmount,
    discountAmount,
    totalAmount,
    paidAmount,
    balanceAmount,
    paymentStatus,
  } = calculateSaleTotals(
    validated.items,
    validated.taxAmount,
    validated.discountAmount,
    validated.initialPaidAmount,
    validated.iceCharges,
    validated.railwayCharges,
    validated.coverRopeCharges,
    validated.thermocolBoxCharges,
    validated.packingCharges
  );

  const saleNumber =
    validated.saleNumber ||
    `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const sale = await prisma.$transaction(
    async (tx) => {
      // 1. Create Sale Header
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          customerId: validated.customerId,
          saleDate: new Date(validated.saleDate),
          deliveryDate: validated.deliveryDate ? new Date(validated.deliveryDate) : null,
          status: validated.status ?? "CONFIRMED",
          paymentStatus,
          subtotal,
          iceCharges,
          railwayCharges,
          coverRopeCharges,
          thermocolBoxCharges,
          packingCharges,
          taxAmount,
          discountAmount,
          totalAmount,
          paidAmount,
          balanceAmount,
          notes: validated.notes,
        },
      });

      // 2. Create Sale Items and corresponding Negative Inventory Transactions (-Quantity kg)
      for (const item of calculatedItems) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            fishTypeId: item.fishTypeId,
            grade: item.grade || "Grade A",
            weightKg: item.weightKg,
            exactPurchasingCost:
              item.exactPurchasingCost !== undefined && item.exactPurchasingCost !== null
                ? Number(item.exactPurchasingCost)
                : null,
            unitPricePerKg: item.unitPricePerKg,
            totalPrice: item.totalPrice,
            notes: item.notes,
          },
        });

        // Negative inventory transaction representing outward sales dispatch
        await tx.inventoryTransaction.create({
          data: {
            fishTypeId: item.fishTypeId,
            transactionType: "SALE_OUTWARD",
            quantityKg: -Math.abs(item.weightKg), // Negative stock movement
            unitCost: item.unitPricePerKg,
            saleItemId: saleItem.id,
            batchLotNumber: `LOT-SALE-${saleNumber}-${item.fishTypeId.slice(-4)}`,
            storageLocation: "Dispatched Cold Logistics",
            notes: `Sales fulfillment dispatch for order ${saleNumber}`,
          },
        });
      }

      // 3. Record initial payment receipt if paidAmount > 0
      if (paidAmount > 0) {
        const paymentNumber = `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        await tx.payment.create({
          data: {
            paymentNumber,
            paymentType: "CUSTOMER_RECEIPT",
            amount: paidAmount,
            paymentMethod: validated.paymentMethod || "BANK_TRANSFER",
            paymentDate: new Date(validated.saleDate),
            customerId: validated.customerId,
            saleId: sale.id,
            notes: `Initial customer receipt for ${saleNumber}`,
          },
        });
      }

      // 4. Automatically synchronize expenses for ice, railway, cover/rope, thermocol, and packing charges
      await syncSaleExpenses(tx, {
        id: sale.id,
        saleNumber: sale.saleNumber,
        saleDate: sale.saleDate,
        iceCharges,
        railwayCharges,
        coverRopeCharges,
        thermocolBoxCharges,
        packingCharges,
        paymentMethod: validated.paymentMethod,
      });

      // 5. Update Customer outstanding balance
      await tx.customer.update({
        where: { id: validated.customerId },
        data: {
          outstandingBalance: {
            increment: balanceAmount,
          },
        },
      });

      return sale;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  // 6. Audit log
  await logAuditEvent({
    userId,
    action: "SALE_CREATED",
    entity: "SALE",
    entityId: sale.id,
    metadata: {
      saleNumber,
      totalAmount,
      totalWeightKg,
      itemsCount: calculatedItems.length,
    },
  });

  return sale;
}

/**
 * Updates an existing sale order and recalibrates inventory transactions.
 */
export async function updateSale(
  id: string,
  rawInput: UpdateSaleInput,
  userId?: string
) {
  const validated = updateSaleSchema.parse(rawInput);

  const txResult = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.sale.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });

      const oldBalanceAmount = existing.balanceAmount;
      const oldCustomerId = existing.customerId;

      let subtotal = existing.subtotal;
      let iceCharges = validated.iceCharges !== undefined ? validated.iceCharges : (existing.iceCharges ?? 0);
      let railwayCharges = validated.railwayCharges !== undefined ? validated.railwayCharges : (existing.railwayCharges ?? 0);
      let coverRopeCharges = validated.coverRopeCharges !== undefined ? validated.coverRopeCharges : (existing.coverRopeCharges ?? 0);
      let thermocolBoxCharges = validated.thermocolBoxCharges !== undefined ? validated.thermocolBoxCharges : (existing.thermocolBoxCharges ?? 0);
      let packingCharges = validated.packingCharges !== undefined ? validated.packingCharges : (existing.packingCharges ?? 0);
      let taxAmount = validated.taxAmount ?? existing.taxAmount;
      let discountAmount = validated.discountAmount ?? existing.discountAmount;
      let totalAmount = existing.totalAmount;
      let balanceAmount = existing.balanceAmount;
      let paymentStatus = existing.paymentStatus;

      const adjustmentsChanged =
        iceCharges !== (existing.iceCharges ?? 0) ||
        railwayCharges !== (existing.railwayCharges ?? 0) ||
        coverRopeCharges !== (existing.coverRopeCharges ?? 0) ||
        thermocolBoxCharges !== (existing.thermocolBoxCharges ?? 0) ||
        packingCharges !== (existing.packingCharges ?? 0) ||
        taxAmount !== existing.taxAmount ||
        discountAmount !== existing.discountAmount;

      if (validated.items && validated.items.length > 0) {
        const totals = calculateSaleTotals(
          validated.items,
          taxAmount,
          discountAmount,
          existing.paidAmount,
          iceCharges,
          railwayCharges,
          coverRopeCharges,
          thermocolBoxCharges,
          packingCharges
        );
        subtotal = totals.subtotal;
        iceCharges = totals.iceCharges;
        railwayCharges = totals.railwayCharges;
        coverRopeCharges = totals.coverRopeCharges;
        thermocolBoxCharges = totals.thermocolBoxCharges;
        packingCharges = totals.packingCharges;
        taxAmount = totals.taxAmount;
        discountAmount = totals.discountAmount;
        totalAmount = totals.totalAmount;
        balanceAmount = totals.balanceAmount;
        paymentStatus = totals.paymentStatus;

        // Clean up previous sale inventory transactions and items
        await tx.inventoryTransaction.deleteMany({
          where: { saleItemId: { in: existing.items.map((i) => i.id) } },
        });
        await tx.saleItem.deleteMany({
          where: { saleId: id },
        });

        // Recreate updated items & negative inventory transactions
        for (const item of totals.calculatedItems) {
          const saleItem = await tx.saleItem.create({
            data: {
              saleId: id,
              fishTypeId: item.fishTypeId,
              grade: item.grade || "Grade A",
              weightKg: item.weightKg,
              exactPurchasingCost:
                item.exactPurchasingCost !== undefined && item.exactPurchasingCost !== null
                  ? Number(item.exactPurchasingCost)
                  : null,
              unitPricePerKg: item.unitPricePerKg,
              totalPrice: item.totalPrice,
              notes: item.notes,
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              fishTypeId: item.fishTypeId,
              transactionType: "SALE_OUTWARD",
              quantityKg: -Math.abs(item.weightKg),
              unitCost: item.unitPricePerKg,
              saleItemId: saleItem.id,
              batchLotNumber: `LOT-SALE-${existing.saleNumber}-${item.fishTypeId.slice(-4)}`,
              storageLocation: "Dispatched Cold Logistics",
              notes: `Updated sales fulfillment for ${existing.saleNumber}`,
            },
          });
        }
      } else if (adjustmentsChanged) {
        // Items not changed but charges/tax/discount changed — recalculate totals
        totalAmount = Number(
          Math.max(
            0,
            subtotal + taxAmount - discountAmount
          ).toFixed(2)
        );
        balanceAmount = Number(Math.max(0, totalAmount - existing.paidAmount).toFixed(2));
        if (balanceAmount <= 0 && totalAmount > 0) paymentStatus = "PAID";
        else if (existing.paidAmount > 0 && existing.paidAmount < totalAmount) paymentStatus = "PARTIAL";
        else if (existing.paidAmount <= 0) paymentStatus = "UNPAID";
      }

      const newCustomerId = validated.customerId ?? existing.customerId;

      const updated = await tx.sale.update({
        where: { id },
        data: {
          customerId: newCustomerId,
          saleDate: validated.saleDate ? new Date(validated.saleDate) : existing.saleDate,
          deliveryDate: validated.deliveryDate !== undefined ? (validated.deliveryDate ? new Date(validated.deliveryDate) : null) : existing.deliveryDate,
          status: validated.status ?? existing.status,
          subtotal,
          iceCharges,
          railwayCharges,
          coverRopeCharges,
          thermocolBoxCharges,
          packingCharges,
          taxAmount,
          discountAmount,
          totalAmount,
          balanceAmount,
          paymentStatus,
          notes: validated.notes !== undefined ? validated.notes : existing.notes,
        },
      });

      // Synchronize expenses for updated charges
      await syncSaleExpenses(tx, {
        id: updated.id,
        saleNumber: updated.saleNumber,
        saleDate: updated.saleDate,
        iceCharges,
        railwayCharges,
        coverRopeCharges,
        thermocolBoxCharges,
        packingCharges,
        paymentMethod: validated.paymentMethod,
      });

      // Adjust customer outstanding balance
      if (newCustomerId !== oldCustomerId) {
        await tx.customer.update({
          where: { id: oldCustomerId },
          data: { outstandingBalance: { decrement: oldBalanceAmount } },
        });
        await tx.customer.update({
          where: { id: newCustomerId },
          data: { outstandingBalance: { increment: balanceAmount } },
        });
      } else {
        const balanceDelta = Number((balanceAmount - oldBalanceAmount).toFixed(2));
        if (balanceDelta !== 0) {
          await tx.customer.update({
            where: { id: oldCustomerId },
            data: { outstandingBalance: { increment: balanceDelta } },
          });
        }
      }

      return {
        updated,
        totalAmount,
        oldTotal: existing.totalAmount,
      };
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  await logAuditEvent({
    userId,
    action: "SALE_UPDATED",
    entity: "SALE",
    entityId: id,
    metadata: { totalAmount: txResult.totalAmount, status: txResult.updated.status, oldTotal: txResult.oldTotal },
  });

  return txResult.updated;
}

/**
 * Deletes a sale order, rolls back negative inventory transactions, and removes payments.
 */
export async function deleteSale(id: string, userId?: string) {
  const saleInfo = await prisma.$transaction(
    async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });

      // Delete linked inventory transactions
      await tx.inventoryTransaction.deleteMany({
        where: { saleItemId: { in: sale.items.map((i) => i.id) } },
      });

      // Delete linked payments
      await tx.payment.deleteMany({
        where: { saleId: id },
      });

      // Delete sale items and sale record
      await tx.sale.delete({
        where: { id },
      });

      // Adjust customer balance
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          outstandingBalance: {
            decrement: sale.balanceAmount,
          },
        },
      });

      return { saleNumber: sale.saleNumber };
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  await logAuditEvent({
    userId,
    action: "SALE_DELETED",
    entity: "SALE",
    entityId: id,
    metadata: { saleNumber: saleInfo.saleNumber },
  });

  return true;
}

/**
 * Records a customer receipt payment against a sale.
 */
export async function recordSalePayment(
  saleId: string,
  rawPayment: RecordSalePaymentInput,
  userId?: string
) {
  const validated = recordSalePaymentSchema.parse(rawPayment);

  const txResult = await prisma.$transaction(
    async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: saleId },
      });

      const newPaidAmount = Number((sale.paidAmount + validated.amount).toFixed(2));
      const newBalanceAmount = Number(
        Math.max(0, sale.totalAmount - newPaidAmount).toFixed(2)
      );
      const newPaymentStatus: PaymentStatus =
        newBalanceAmount <= 0 ? "PAID" : "PARTIAL";

      const paymentNumber =
        validated.referenceNumber ||
        `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          paymentType: "CUSTOMER_RECEIPT",
          amount: validated.amount,
          paymentMethod: validated.paymentMethod,
          paymentDate: new Date(validated.paymentDate),
          customerId: sale.customerId,
          saleId: sale.id,
          referenceNumber: validated.referenceNumber,
          notes: validated.notes,
        },
      });

      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newPaymentStatus,
        },
      });

      // Decrement customer outstanding balance
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          outstandingBalance: {
            decrement: validated.amount,
          },
        },
      });

      return {
        payment,
        paymentNumber,
        amount: validated.amount,
        newBalance: newBalanceAmount,
      };
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  await logAuditEvent({
    userId,
    action: "SALE_PAYMENT_RECORDED",
    entity: "SALE",
    entityId: saleId,
    metadata: {
      paymentNumber: txResult.paymentNumber,
      amount: txResult.amount,
      newBalance: txResult.newBalance,
    },
  });

  return txResult.payment;
}

/**
 * Fetches lookup data for the sales entry form (Customers and Fish species with live inventory stock).
 */
export async function getCustomersAndFishTypes(): Promise<SalesLookupsDTO> {
  try {
    const [customers, fishTypes] = await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.fishType.findMany({
        where: { isActive: true },
        include: {
          inventoryTransactions: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      customers: customers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        companyName: c.companyName,
        customerType: c.customerType,
        phone: c.phone,
        email: c.email,
        deliveryAddress: c.deliveryAddress,
        outstandingBalance: c.outstandingBalance,
        creditLimit: c.creditLimit,
        isActive: c.isActive,
      })),
      fishTypes: fishTypes.map((f) => {
        const availableStockKg = f.inventoryTransactions.reduce(
          (sum, t) => sum + t.quantityKg,
          0
        );
        return {
          id: f.id,
          code: f.code,
          name: f.name,
          scientificName: f.scientificName,
          category: f.category,
          grade: f.grade,
          description: f.description,
          imageUrl: f.imageUrl,
          isActive: f.isActive,
          availableStockKg: Number(Math.max(0, availableStockKg).toFixed(2)),
        };
      }),
    };
  } catch (error) {
    console.error("Failed to fetch sales lookups:", error);
    return {
      customers: [],
      fishTypes: [],
    };
  }
}

// Backward compatibility alias
export const getSalesList = listSales;

/**
 * Updates spoilage / rejected quantities and reasons for items within a sale.
 * Recalculates billable subtotal, total amount, balance amount, payment status, and updates customer balance.
 */
export async function updateSaleSpoilage(
  saleId: string,
  input: UpdateSaleSpoilageInput,
  userId?: string
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          items: true,
        },
      });

      if (!sale) {
        throw new Error(`Sale with ID ${saleId} not found`);
      }

      // Apply spoilage updates to each specified item
      for (const itemInput of input.items) {
        const existingItem = sale.items.find((i) => i.id === itemInput.itemId);
        if (!existingItem) continue;

        const spoiledKg = Math.max(
          0,
          Math.min(existingItem.weightKg, Number(itemInput.spoiledWeightKg) || 0)
        );
        const effectiveKg = Math.max(0, existingItem.weightKg - spoiledKg);
        const newTotalPrice = Number(
          (effectiveKg * existingItem.unitPricePerKg).toFixed(2)
        );

        await tx.saleItem.update({
          where: { id: itemInput.itemId },
          data: {
            spoiledWeightKg: spoiledKg,
            spoilageReason: itemInput.spoilageReason ? itemInput.spoilageReason.trim() : null,
            totalPrice: newTotalPrice,
          },
        });
      }

      // Fetch updated items to recalculate totals
      const updatedItems = await tx.saleItem.findMany({
        where: { saleId },
      });

      const newSubtotal = Number(
        updatedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)
      );
      const newTotalAmount = Number(
        Math.max(0, newSubtotal + sale.taxAmount - sale.discountAmount).toFixed(2)
      );
      const newBalanceAmount = Number(
        Math.max(0, newTotalAmount - sale.paidAmount).toFixed(2)
      );

      let newPaymentStatus: PaymentStatus = sale.paymentStatus as PaymentStatus;
      if (sale.paidAmount >= newTotalAmount && newTotalAmount > 0) {
        newPaymentStatus = "PAID";
      } else if (sale.paidAmount > 0) {
        newPaymentStatus = "PARTIAL";
      } else {
        newPaymentStatus = "UNPAID";
      }

      const deltaTotal = Number((newTotalAmount - sale.totalAmount).toFixed(2));

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          subtotal: newSubtotal,
          totalAmount: newTotalAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newPaymentStatus,
        },
        include: {
          customer: true,
          items: {
            include: {
              fishType: true,
            },
          },
          payments: true,
        },
      });

      // Update customer outstanding balance if financial total changed
      if (deltaTotal !== 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            outstandingBalance: {
              increment: deltaTotal,
            },
          },
        });
      }

      return {
        updatedSale,
        saleNumber: sale.saleNumber,
        oldTotal: sale.totalAmount,
        newTotal: newTotalAmount,
        deltaTotal,
      };
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  if (userId) {
    await logAuditEvent({
      userId,
      action: "UPDATE",
      entity: "Sale",
      entityId: saleId,
      metadata: {
        event: "Delivery spoilage recorded / updated",
        saleNumber: result.saleNumber,
        oldTotal: result.oldTotal,
        newTotal: result.newTotal,
        delta: result.deltaTotal,
      },
    });
  }

  return result.updatedSale;
}


