"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Fish,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AddSpeciesDialog } from "@/components/inventory/add-species-dialog";
import { formatCurrency, formatWeight } from "@/lib/utils";
import { DELIVERY_STATUSES } from "@/constants";
import type {
  CustomerDTO,
  FishTypeWithStockDTO,
  CreateSaleInput,
  SaleItemInput,
  SaleDetailDTO,
  InventoryStockSummaryDTO,
  FishTypeDTO,
} from "@/types";

interface SalesFormProps {
  customers: CustomerDTO[];
  fishTypes: FishTypeWithStockDTO[];
  initialData?: SaleDetailDTO;
}

const EMPTY_ITEM: SaleItemInput = {
  fishTypeId: "",
  grade: "Grade A",
  weightKg: 0,
  unitPricePerKg: 0,
  exactPurchasingCost: null,
  notes: null,
};

const PAYMENT_METHODS = [
  { label: "Bank Transfer", value: "BANK_TRANSFER" },
  { label: "Cash", value: "CASH" },
  { label: "Cheque", value: "CHEQUE" },
  { label: "UPI", value: "UPI" },
  { label: "Credit Card", value: "CREDIT_CARD" },
];

export function SalesForm({ customers, fishTypes, initialData }: SalesFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(initialData);
  const [customerList, setCustomerList] = React.useState<CustomerDTO[]>(customers);
  const [fishTypeList, setFishTypeList] = React.useState<FishTypeWithStockDTO[]>(fishTypes);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync prop updates
  React.useEffect(() => {
    if (fishTypes && fishTypes.length > 0) {
      setFishTypeList(fishTypes);
    }
  }, [fishTypes]);

  React.useEffect(() => {
    if (customers && customers.length > 0) {
      setCustomerList(customers);
    }
  }, [customers]);

  // Client-side refresh on mount to ensure latest live inventory stock
  React.useEffect(() => {
    async function refreshLookups() {
      try {
        const res = await fetch("/api/sales/lookups");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.fishTypes && Array.isArray(json.data.fishTypes)) {
            setFishTypeList(json.data.fishTypes);
          }
          if (json.data?.customers && Array.isArray(json.data.customers)) {
            setCustomerList(json.data.customers);
          }
        }
      } catch (err) {
        console.error("Failed to auto-refresh sales lookups:", err);
      }
    }
    refreshLookups();
  }, []);

  // Quick Add Customer Dialog state
  const [showAddCustomer, setShowAddCustomer] = React.useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = React.useState(false);
  const [newCustomerData, setNewCustomerData] = React.useState({
    name: "",
    companyName: "",
    deliveryAddress: "",
  });

  // Quick Add Species Dialog State
  const [showAddSpecies, setShowAddSpecies] = React.useState(false);
  const [targetSpeciesRowIndex, setTargetSpeciesRowIndex] = React.useState<number | null>(null);

  const handleSpeciesCreated = (created: InventoryStockSummaryDTO & FishTypeDTO) => {
    const formatted: FishTypeWithStockDTO = {
      id: created.fishTypeId || created.id,
      code: created.code,
      name: created.name,
      scientificName: created.scientificName,
      category: created.category,
      grade: created.grade || "Grade A",
      description: created.description,
      imageUrl: created.imageUrl,
      isActive: created.isActive ?? true,
      availableStockKg: created.currentStockKg || 0,
    };

    setFishTypeList((prev) => {
      const exists = prev.some((p) => p.id === formatted.id);
      if (exists) return prev;
      return [formatted, ...prev];
    });

    if (targetSpeciesRowIndex !== null && targetSpeciesRowIndex >= 0) {
      updateItem(targetSpeciesRowIndex, "fishTypeId", formatted.id);
      if (created.grade) {
        updateItem(targetSpeciesRowIndex, "grade", created.grade);
      }
    }
    setTargetSpeciesRowIndex(null);
  };

  // Form state — pre-fill from initialData when editing
  const [customerId, setCustomerId] = React.useState(initialData?.customerId ?? "");
  const [saleDate, setSaleDate] = React.useState(
    initialData?.saleDate
      ? new Date(initialData.saleDate).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [deliveryDate, setDeliveryDate] = React.useState(
    initialData?.deliveryDate
      ? new Date(initialData.deliveryDate).toISOString().slice(0, 16)
      : ""
  );
  const [deliveryStatus, setDeliveryStatus] = React.useState<CreateSaleInput["status"]>(
    initialData?.status ?? "CONFIRMED"
  );
  const [paymentMethod, setPaymentMethod] = React.useState("BANK_TRANSFER");
  const [initialPaidAmount, setInitialPaidAmount] = React.useState(
    isEditMode ? 0 : 0
  );
  const [iceCharges, setIceCharges] = React.useState(
    initialData?.iceCharges ?? 0
  );
  const [railwayCharges, setRailwayCharges] = React.useState(
    initialData?.railwayCharges ?? 0
  );
  const [coverRopeCharges, setCoverRopeCharges] = React.useState(
    initialData?.coverRopeCharges ?? 0
  );
  const [thermocolBoxCharges, setThermocolBoxCharges] = React.useState(
    initialData?.thermocolBoxCharges ?? 0
  );
  const [packingCharges, setPackingCharges] = React.useState(
    initialData?.packingCharges ?? 0
  );
  const [taxAmount, setTaxAmount] = React.useState(initialData?.taxAmount ?? 0);
  const [discountAmount, setDiscountAmount] = React.useState(initialData?.discountAmount ?? 0);
  const [notes, setNotes] = React.useState(initialData?.notes ?? "");
  const [items, setItems] = React.useState<SaleItemInput[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((item) => ({
          fishTypeId: item.fishTypeId,
          grade: item.grade || "Grade A",
          weightKg: item.weightKg,
          unitPricePerKg: item.unitPricePerKg,
          exactPurchasingCost: item.exactPurchasingCost ?? null,
          notes: item.notes ?? null,
        }))
      : [{ ...EMPTY_ITEM }]
  );

  // Invoice file upload state
  const [invoiceFile, setInvoiceFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [invoiceUrl, setInvoiceUrl] = React.useState<string | null>(null);
  const [invoiceFileName, setInvoiceFileName] = React.useState<string | null>(null);

  // Authoritative calculations on client preview
  const calculatedItems = items.map((item) => {
    const selectedFish = fishTypeList.find((f) => f.id === item.fishTypeId);
    let availableStock = selectedFish ? selectedFish.availableStockKg : 0;
    if (initialData && item.fishTypeId) {
      const originalAllocated = initialData.items
        .filter((i) => i.fishTypeId === item.fishTypeId)
        .reduce((sum, i) => sum + i.weightKg, 0);
      availableStock += originalAllocated;
    }
    const isOverStock = Boolean(item.fishTypeId && item.weightKg > availableStock);
    const sellingRate = Number(item.unitPricePerKg) || 0;
    const costRate =
      item.exactPurchasingCost !== null && item.exactPurchasingCost !== undefined
        ? Number(item.exactPurchasingCost)
        : null;
    const marginPerKg = costRate !== null ? sellingRate - costRate : null;

    return {
      ...item,
      totalPrice: Number((item.weightKg * item.unitPricePerKg).toFixed(2)),
      availableStock,
      isOverStock,
      costRate,
      marginPerKg,
    };
  });

  const totalWeightKg = calculatedItems.reduce(
    (sum, item) => sum + item.weightKg,
    0
  );
  const subtotal = calculatedItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );
  const totalCharges =
    iceCharges + railwayCharges + coverRopeCharges + thermocolBoxCharges + packingCharges;
  const grandTotal = Math.max(0, subtotal + taxAmount - discountAmount);

  const totalEstimatedCost = calculatedItems.reduce(
    (sum, item) =>
      sum + (item.costRate !== null && item.costRate !== undefined ? item.costRate * item.weightKg : 0),
    0
  );
  const hasCostRates = calculatedItems.some(
    (i) => i.costRate !== null && i.costRate !== undefined && i.costRate > 0
  );
  const estimatedOrderNetProfit = grandTotal - totalEstimatedCost - totalCharges;
  const estimatedOrderNetMargin =
    grandTotal > 0 ? (estimatedOrderNetProfit / grandTotal) * 100 : 0;

  const dueAmount = isEditMode
    ? Math.max(0, grandTotal - (initialData?.paidAmount ?? 0))
    : Math.max(0, grandTotal - initialPaidAmount);

  const paymentStatus =
    grandTotal > 0 && dueAmount <= 0
      ? "PAID"
      : initialPaidAmount > 0
      ? "PARTIAL"
      : "UNPAID";

  const selectedCustomer = customerList.find((c) => c.id === customerId);
  const hasOverStockItems = calculatedItems.some((i) => i.isOverStock);

  async function handleCreateNewCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomerData.name.trim()) {
      alert("Please provide at least a customer/buyer name.");
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const res = await fetch("/api/sales/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomerData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create company");
      }

      const { data: created } = await res.json();
      setCustomerList((prev) => [created, ...prev]);
      setCustomerId(created.id);
      setShowAddCustomer(false);
      setNewCustomerData({
        name: "",
        companyName: "",
        deliveryAddress: "",
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create new customer");
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  // Item handlers
  function addItem() {
    setItems([...items, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(
    index: number,
    field: keyof SaleItemInput,
    value: string | number | null
  ) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  // Invoice upload
  async function handleInvoiceUpload(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "fish_business/invoices");

      const res = await fetch("/api/upload/invoice", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setInvoiceUrl(data.url || data.data?.url);
      setInvoiceFileName(file.name);
    } catch {
      setError("Failed to upload invoice. You can still save the sale order.");
    } finally {
      setIsUploading(false);
    }
  }

  // Form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validations
    if (!customerId) {
      setError("Please select a customer or buyer company");
      return;
    }
    if (!saleDate) {
      setError("Please select a sale date & time");
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.fishTypeId && item.weightKg > 0 && item.unitPricePerKg > 0
    );
    if (validItems.length === 0) {
      setError("At least one fish item with quantity and selling price is required");
      return;
    }

    if (hasOverStockItems) {
      setError("One or more items exceed current warehouse stock. Please adjust quantities.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateSaleInput = {
        customerId,
        saleDate,
        deliveryDate: deliveryDate || null,
        status: deliveryStatus,
        paymentStatus,
        paymentMethod: paymentMethod as CreateSaleInput["paymentMethod"],
        initialPaidAmount: isEditMode ? undefined : initialPaidAmount,
        iceCharges,
        railwayCharges,
        coverRopeCharges,
        thermocolBoxCharges,
        packingCharges,
        taxAmount,
        discountAmount,
        notes: notes || null,
        invoiceUrl,
        invoiceFileName,
        invoiceFileType: invoiceFile?.type || null,
        invoiceFileSize: invoiceFile?.size || null,
        items: validItems,
      };

      const url = isEditMode ? `/api/sales/${initialData!.id}` : "/api/sales";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${isEditMode ? "update" : "create"} sale order`);
      }

      if (isEditMode) {
        router.push(`/sales/${initialData!.id}`);
      } else {
        router.push("/sales");
      }
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `Failed to ${isEditMode ? "update" : "create"} sale order`;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {isEditMode ? `Edit ${initialData!.saleNumber}` : "New Sale & Invoice Order"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? "Update order details. Inventory and customer balance will be recalculated."
                : "Create customer order, allocate stock, and issue outward dispatch"}
            </p>
          </div>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || hasOverStockItems}
          className="w-full sm:w-auto gap-1.5 shadow-xs"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSubmitting ? "Saving..." : isEditMode ? "Update Sale Order" : "Create Sale Order"}
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Fish Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Delivery Schedule */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm">Customer & Order Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      Customer / Buyer Company *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(true)}
                      className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add New Company
                    </button>
                  </div>
                  <Select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="h-9 text-sm"
                  >
                    <option value="">Select Customer...</option>
                    {customerList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.companyName ? `(${c.companyName})` : ""}
                      </option>
                    ))}
                  </Select>
                  {selectedCustomer && (
                    <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      <span>📞 {selectedCustomer.phone}</span>
                      {selectedCustomer.deliveryAddress && (
                        <span>📍 {selectedCustomer.deliveryAddress}</span>
                      )}
                      {selectedCustomer.outstandingBalance > 0 && (
                        <span className="text-warning font-medium">
                          Current Due: {formatCurrency(selectedCustomer.outstandingBalance)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Sale Date & Time *
                  </label>
                  <Input
                    type="datetime-local"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Target Delivery Date
                  </label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Delivery Status
                  </label>
                  <Select
                    value={deliveryStatus}
                    onChange={(e) =>
                      setDeliveryStatus(e.target.value as CreateSaleInput["status"])
                    }
                    className="h-9 text-sm"
                  >
                    {DELIVERY_STATUSES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fish Items Table */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Fish Varieties & Quantities ({items.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTargetSpeciesRowIndex(null);
                      setShowAddSpecies(true);
                    }}
                    className="gap-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Fish className="h-3 w-3" />
                    + New Species
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add Variety
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => {
                const calculated = calculatedItems[index];
                return (
                  <div
                    key={index}
                    className={`rounded-lg border p-4 space-y-3 transition-colors ${
                      calculated.isOverStock
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Line Item #{index + 1}
                        </span>
                        {item.fishTypeId && (
                          <Badge
                            variant={calculated.isOverStock ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            In Stock: {formatWeight(calculated.availableStock)}
                          </Badge>
                        )}
                        {calculated.costRate !== null && calculated.costRate > 0 && item.unitPricePerKg > 0 && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono font-medium ${
                              (calculated.marginPerKg ?? 0) >= 0
                                ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                                : "text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                            }`}
                          >
                            Margin: {(calculated.marginPerKg ?? 0) >= 0 ? "+" : ""}
                            {formatCurrency(calculated.marginPerKg ?? 0)}/kg
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {item.fishTypeId &&
                          item.weightKg > 0 &&
                          item.unitPricePerKg > 0 && (
                            <span className="text-xs font-mono font-semibold text-primary">
                              = {formatCurrency(calculated.totalPrice)}
                            </span>
                          )}
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Fish Species *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetSpeciesRowIndex(index);
                              setShowAddSpecies(true);
                            }}
                            className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="h-2.5 w-2.5" /> New Species
                          </button>
                        </div>
                        <Select
                          value={item.fishTypeId}
                          onChange={(e) =>
                            updateItem(index, "fishTypeId", e.target.value)
                          }
                          className="h-8 text-xs"
                        >
                          <option value="">Select Fish Variety...</option>
                          {fishTypeList.map((ft) => (
                            <option key={ft.id} value={ft.id}>
                              {ft.name} ({ft.code}) — {formatWeight(ft.availableStockKg)} avail
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Grade
                        </label>
                        <Select
                          value={item.grade || "Grade A"}
                          onChange={(e) =>
                            updateItem(index, "grade", e.target.value)
                          }
                          className="h-8 text-xs"
                        >
                          <option value="Grade AAA Export">Grade AAA Export</option>
                          <option value="Grade A Export">Grade A Export</option>
                          <option value="Grade A">Grade A</option>
                          <option value="Grade B">Grade B</option>
                          <option value="Grade C">Grade C</option>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Quantity Sold (kg) *
                          </label>
                          {calculated.isOverStock && (
                            <span className="text-[10px] text-destructive font-medium">
                              Exceeds Stock!
                            </span>
                          )}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.weightKg || ""}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "weightKg",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className={`h-8 text-xs font-mono ${
                            calculated.isOverStock
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center justify-between">
                          <span>Exact Cost / kg</span>
                          <span className="text-[10px] text-muted-foreground">Purchased</span>
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.exactPurchasingCost ?? ""}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "exactPurchasingCost",
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          placeholder="₹ 0.00"
                          className="h-8 text-xs font-mono border-blue-500/30 focus-visible:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Selling Price / kg *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPricePerKg || ""}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "unitPricePerKg",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Item Total
                        </label>
                        <div className="h-8 flex items-center px-3 rounded-md bg-muted text-xs font-mono font-semibold text-foreground">
                          {formatCurrency(calculated.totalPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Invoice Document Upload & Notes */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm">Invoice & Order Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Order Notes / Shipping Instructions
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Export crate packaging with dry ice at -20°C..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Sales Invoice / Packing List Document
                </label>
                {invoiceFileName ? (
                  <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span className="text-xs text-foreground font-medium truncate flex-1">
                      {invoiceFileName}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setInvoiceFile(null);
                        setInvoiceUrl(null);
                        setInvoiceFileName(null);
                      }}
                      className="h-7 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {isUploading
                          ? "Uploading to Cloudinary..."
                          : "Click to upload sales invoice / manifest (PDF, JPG, PNG)"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setInvoiceFile(file);
                            handleInvoiceUpload(file);
                          }
                        }}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Pricing & Payment Breakdown */}
        <div className="space-y-6">
          {/* Dispatch & Packing Charges (Recorded to Order and Logged as Expenses) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dispatch & Packing Charges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Ice Charge (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={iceCharges || ""}
                  onChange={(e) =>
                    setIceCharges(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Railway Charge (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={railwayCharges || ""}
                  onChange={(e) =>
                    setRailwayCharges(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Cover & Rope Charge (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={coverRopeCharges || ""}
                  onChange={(e) =>
                    setCoverRopeCharges(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Thermocol Box Charge (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={thermocolBoxCharges || ""}
                  onChange={(e) =>
                    setThermocolBoxCharges(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Packing Charge (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={packingCharges || ""}
                  onChange={(e) =>
                    setPackingCharges(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                These are handling &amp; delivery expenses for this sale (borne by seller). They are automatically recorded as operational expenses to deduct from sales revenue.
              </p>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          {!isEditMode ? (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm">Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Payment Method
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-9 text-sm"
                    options={PAYMENT_METHODS}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Initial Payment Received (₹)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialPaidAmount || ""}
                    onChange={(e) =>
                      setInitialPaidAmount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm">Payment Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Paid So Far:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(initialData?.paidAmount ?? 0)}
                  </span>
                </p>
                <p className="text-[11px]">
                  Customer payments can be recorded and managed directly from the Sale Details page.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Authoritative Order Summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sale Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Weight</span>
                <span className="font-mono font-medium">
                  {formatWeight(totalWeightKg)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Items Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>

              {taxAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-mono">+{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-mono text-success">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>
              )}

              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>Customer Billed Total</span>
                  <span className="font-mono text-primary">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>

              {totalCharges > 0 && (
                <div className="mt-3 pt-2 border-t border-dashed border-border/80 space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Order Expenses (Borne by Seller)</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">
                      {formatCurrency(totalCharges)}
                    </span>
                  </div>
                  {iceCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Ice Cost</span>
                      <span className="font-mono">{formatCurrency(iceCharges)}</span>
                    </div>
                  )}
                  {railwayCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Railway Freight</span>
                      <span className="font-mono">{formatCurrency(railwayCharges)}</span>
                    </div>
                  )}
                  {coverRopeCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Cover &amp; Rope</span>
                      <span className="font-mono">{formatCurrency(coverRopeCharges)}</span>
                    </div>
                  )}
                  {thermocolBoxCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Thermocol Box</span>
                      <span className="font-mono">{formatCurrency(thermocolBoxCharges)}</span>
                    </div>
                  )}
                  {packingCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Packing Cost</span>
                      <span className="font-mono">{formatCurrency(packingCharges)}</span>
                    </div>
                  )}
                </div>
              )}

              {(isEditMode ? (initialData?.paidAmount ?? 0) > 0 : initialPaidAmount > 0) && (
                <>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-mono text-success">
                      -{formatCurrency(isEditMode ? (initialData?.paidAmount ?? 0) : initialPaidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Due Amount</span>
                    <span className="font-mono text-warning">
                      {formatCurrency(dueAmount)}
                    </span>
                  </div>
                </>
              )}

              {hasCostRates && (
                <div className="mt-3 pt-2 border-t border-emerald-500/20 bg-emerald-500/10 p-2.5 rounded-lg space-y-1">
                  <div className="flex justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <span>Est. Order Net Profit</span>
                    <span className="font-mono">{formatCurrency(estimatedOrderNetProfit)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>(Billed Total − Raw Cost − Expenses)</span>
                    <span className="font-mono font-medium text-foreground">
                      {estimatedOrderNetMargin.toFixed(1)}% Margin
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Badge
                  variant={
                    paymentStatus === "PAID"
                      ? "success"
                      : paymentStatus === "PARTIAL"
                      ? "warning"
                      : "destructive"
                  }
                >
                  {paymentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Add Customer / Company Dialog */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building className="h-4.5 w-4.5 text-primary" />
            Add New Buyer / Company
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create a new client record instantly. It will automatically be selected for this order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateNewCustomer} className="space-y-3.5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Customer / Buyer Name *
              </label>
              <Input
                placeholder="e.g. Apex Ocean Foods"
                value={newCustomerData.name}
                onChange={(e) =>
                  setNewCustomerData({ ...newCustomerData, name: e.target.value })
                }
                required
                className="h-8.5 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Company / Legal Trade Name
              </label>
              <Input
                placeholder="e.g. Apex Marine Exports Pvt Ltd"
                value={newCustomerData.companyName}
                onChange={(e) =>
                  setNewCustomerData({ ...newCustomerData, companyName: e.target.value })
                }
                className="h-8.5 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" /> Delivery / Warehouse Address
            </label>
            <Input
              placeholder="e.g. Export Wharf Shed #4, Willingdon Island, Cochin"
              value={newCustomerData.deliveryAddress}
              onChange={(e) =>
                setNewCustomerData({ ...newCustomerData, deliveryAddress: e.target.value })
              }
              className="h-8.5 text-xs"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddCustomer(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isCreatingCustomer}
              className="gap-1.5"
            >
              {isCreatingCustomer ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : (
                "Save & Select Company"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Quick Add Fish Species Dialog */}
      <AddSpeciesDialog
        open={showAddSpecies}
        onOpenChange={setShowAddSpecies}
        onSuccess={handleSpeciesCreated}
      />
    </form>
  );
}
