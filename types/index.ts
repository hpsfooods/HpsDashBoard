export * from "./purchase";
export * from "./sale";
export * from "./report";
export * from "./dashboard";
export * from "./financial-reports";

export type Role = "ADMIN" | "MANAGER" | "STAFF" | "ACCOUNTANT";

export type PurchaseStatus =
  | "DRAFT"
  | "RECEIVED"
  | "INSPECTED"
  | "COMPLETED"
  | "CANCELLED";

export type SaleStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";

export type PaymentType =
  | "CUSTOMER_RECEIPT"
  | "SUPPLIER_PAYMENT"
  | "EXPENSE_PAYMENT";

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "UPI"
  | "CREDIT_CARD";

export type InventoryTransactionType =
  | "PURCHASE_INWARD"
  | "SALE_OUTWARD"
  | "WASTAGE_OUTWARD"
  | "ADJUSTMENT_INWARD"
  | "ADJUSTMENT_OUTWARD";

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "PARTIAL"
  | "CANCELLED"
  | "OVERDUE";

export interface UserSession {
  id: string;
  supabaseId: string;
  email: string;
  name?: string | null;
  role: Role;
}

export interface FishTypeDTO {
  id: string;
  code: string;
  name: string;
  scientificName?: string | null;
  category: string;
  grade?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface SupplierDTO {
  id: string;
  code: string;
  name: string;
  harborLocation?: string | null;
  boatName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  balance: number;
  rating: number;
  isActive: boolean;
}

export interface CustomerDTO {
  id: string;
  code: string;
  name: string;
  companyName?: string | null;
  customerType: string;
  phone?: string | null;
  email?: string | null;
  deliveryAddress?: string | null;
  outstandingBalance: number;
  creditLimit: number;
  isActive: boolean;
}

export interface PurchaseItemDTO {
  id: string;
  purchaseId: string;
  fishTypeId: string;
  fishTypeName: string;
  grade: string;
  fishCount?: number | null;
  weightKg: number;
  unitPricePerKg: number;
  totalCost: number;
  temperatureC?: number | null;
  notes?: string | null;
}

export interface PurchaseDTO {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  status: PurchaseStatus;
  totalWeightKg: number;
  subtotal: number;
  transportCharges: number;
  iceCharges: number;
  labourCharges: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  landingHarbor?: string | null;
  truckNumber?: string | null;
  invoiceUrl?: string | null;
  itemsCount: number;
}

export interface SaleItemDTO {
  id: string;
  saleId: string;
  fishTypeId: string;
  fishTypeName: string;
  grade: string;
  weightKg: number;
  unitPricePerKg: number;
  totalPrice: number;
  notes?: string | null;
}

export interface SaleDTO {
  id: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  saleDate: string;
  deliveryDate?: string | null;
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  iceCharges: number;
  railwayCharges: number;
  coverRopeCharges: number;
  thermocolBoxCharges: number;
  packingCharges: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  totalWeightKg: number;
  itemsCount?: number;
  netProfit?: number;
  netProfitMargin?: number;
}

export interface InventoryTransactionDTO {
  id: string;
  fishTypeId: string;
  fishTypeName: string;
  transactionType: InventoryTransactionType;
  quantityKg: number;
  unitCost?: number | null;
  batchLotNumber?: string | null;
  storageLocation?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface InventoryStockSummaryDTO {
  fishTypeId: string;
  code: string;
  name: string;
  category: string;
  grade: string;
  currentStockKg: number;
  totalPurchasedKg: number;
  totalSoldKg: number;
  totalWastageKg: number;
  averageCostPerKg: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "DEPLETED";
}

export interface PackingCostDTO {
  id: string;
  saleId?: string | null;
  saleNumber?: string | null;
  packingType: string;
  thermocolBoxesCount: number;
  costPerBox: number;
  thermocolCost: number;
  iceCost: number;
  oxygenCost: number;
  packingMaterialCost: number;
  labourCost: number;
  transportCost: number;
  quantityKg: number;
  totalCost: number;
  costPerKg: number;
  notes?: string | null;
  createdAt: string;
}

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  saleId: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  pdfUrl?: string | null;
}

export interface ExpenseCategoryDTO {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface ExpenseDTO {
  id: string;
  expenseNumber: string;
  categoryId: string;
  categoryName: string;
  categoryCode?: string;
  title: string;
  description?: string | null;
  amount: number;
  paidTo?: string | null;
  paymentMethod: PaymentMethod;
  expenseDate: string;
  saleId?: string | null;
  saleNumber?: string | null;
  customerName?: string | null;
  receiptUrl?: string | null;
  invoiceUrl?: string | null;
  invoiceFileName?: string | null;
  notes?: string | null;
}

export interface ExpenseSaleLookupDTO {
  id: string;
  saleNumber: string;
  customerName: string;
  saleDate: string;
  totalAmount: number;
}

export interface ExpenseLookupsDTO {
  categories: ExpenseCategoryDTO[];
  sales: ExpenseSaleLookupDTO[];
}

export interface PaymentDTO {
  id: string;
  paymentNumber: string;
  paymentType: PaymentType;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string | null;
  partyName: string;
  notes?: string | null;
}

export interface AuditLogDTO {
  id: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

export interface DashboardMetricsDTO {
  todayInwardKg: number;
  todaySalesKg: number;
  revenueThisMonth: number;
  grossProfitMargin: number;
  activeInventoryKg: number;
  coldStorageOccupancyPct: number;
  outstandingReceivables: number;
  outstandingPayables: number;
}
