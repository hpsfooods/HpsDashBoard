import type {
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
  CustomerDTO,
  FishTypeDTO,
} from "./index";

export interface SaleItemInput {
  fishTypeId: string;
  grade?: string;
  weightKg: number; // Quantity in kg
  exactPurchasingCost?: number | null; // Exact purchasing cost per kg
  unitPricePerKg: number; // Selling rate per kg
  totalPrice?: number; // Calculated: Quantity * Selling Price/kg
  notes?: string | null;
}

export interface SaleItemDetailDTO {
  id: string;
  saleId: string;
  fishTypeId: string;
  fishTypeName: string;
  fishTypeCode: string;
  grade: string;
  weightKg: number; // Dispatched weight
  spoiledWeightKg?: number; // Spoiled / rejected weight
  spoilageReason?: string | null;
  effectiveWeightKg?: number; // weightKg - spoiledWeightKg
  exactPurchasingCost?: number | null; // Exact purchasing cost per kg
  unitPricePerKg: number;
  totalPrice: number;
  notes?: string | null;
  createdAt: string;
}

export interface UpdateSaleSpoilageItemInput {
  itemId: string;
  spoiledWeightKg: number;
  spoilageReason?: string | null;
}

export interface UpdateSaleSpoilageInput {
  items: UpdateSaleSpoilageItemInput[];
}

export interface CreateSaleInput {
  saleNumber?: string;
  customerId: string;
  saleDate: string;
  deliveryDate?: string | null;
  status?: SaleStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  initialPaidAmount?: number;
  iceCharges?: number;
  railwayCharges?: number;
  coverRopeCharges?: number;
  thermocolBoxCharges?: number;
  packingCharges?: number;
  taxAmount?: number;
  discountAmount?: number;
  notes?: string | null;
  invoiceUrl?: string | null;
  invoiceFileName?: string | null;
  invoiceFileType?: string | null;
  invoiceFileSize?: number | null;
  items: SaleItemInput[];
}

export interface UpdateSaleInput extends Partial<CreateSaleInput> {
  status?: SaleStatus;
}

export interface RecordSalePaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface SaleDetailDTO {
  id: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  customerCompany?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  saleDate: string;
  deliveryDate?: string | null;
  status: SaleStatus;
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
  balanceAmount: number; // Due Amount
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  totalWeightKg: number;
  notes?: string | null;
  invoiceUrl?: string | null;
  invoiceFileName?: string | null;
  invoiceFileType?: string | null;
  invoiceFileSize?: number | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItemDetailDTO[];
  payments: Array<{
    id: string;
    paymentNumber: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    referenceNumber?: string | null;
    notes?: string | null;
  }>;
  expenses?: Array<{
    id: string;
    expenseNumber: string;
    title: string;
    categoryName: string;
    amount: number;
    paymentMethod: PaymentMethod;
    expenseDate: string;
    paidTo?: string | null;
    invoiceUrl?: string | null;
    invoiceFileName?: string | null;
  }>;
  netProfit?: number;
  netProfitMargin?: number;
}

export interface SaleFilterParams {
  date?: string;
  month?: string;
  year?: string;
  customerId?: string;
  fishTypeId?: string;
  paymentStatus?: PaymentStatus | "ALL";
  deliveryStatus?: SaleStatus | "ALL";
  invoiceNumber?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface FishTypeWithStockDTO extends FishTypeDTO {
  availableStockKg: number;
}

export interface SalesLookupsDTO {
  customers: CustomerDTO[];
  fishTypes: FishTypeWithStockDTO[];
}
