"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  CreditCard,
  FileText,
  Truck,
  Package,
  Clock,
  Loader2,
  Building,
  User,
  CheckCircle,
  Receipt,
  Plus,
  AlertTriangle,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, formatWeight, formatDate } from "@/lib/utils";
import { STATUS_BADGE_VARIANTS, DELIVERY_STATUSES } from "@/constants";
import type { SaleDetailDTO } from "@/types";

interface SaleDetailsProps {
  sale: SaleDetailDTO;
}

const PAYMENT_METHODS = [
  { label: "Bank Transfer", value: "BANK_TRANSFER" },
  { label: "Cash", value: "CASH" },
  { label: "Cheque", value: "CHEQUE" },
  { label: "UPI", value: "UPI" },
  { label: "Credit Card", value: "CREDIT_CARD" },
];

function formatPaymentMethod(method: string): string {
  return (
    PAYMENT_METHODS.find((m) => m.value === method)?.label ||
    method.replace(/_/g, " ")
  );
}

interface SpoilageItemState {
  itemId: string;
  fishTypeName: string;
  fishTypeCode: string;
  grade: string;
  weightKg: number;
  spoiledWeightKg: number;
  spoilageReason: string;
  unitPricePerKg: number;
}

export function SaleDetails({ sale }: SaleDetailsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);
  const [showSpoilageDialog, setShowSpoilageDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isSavingSpoilage, setIsSavingSpoilage] = React.useState(false);
  const [spoilageError, setSpoilageError] = React.useState<string | null>(null);

  // Status state
  const [currentStatus, setCurrentStatus] = React.useState(sale.status);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = React.useState(sale.balanceAmount);
  const [paymentMethod, setPaymentMethod] = React.useState("BANK_TRANSFER");
  const [paymentDate, setPaymentDate] = React.useState(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentRef, setPaymentRef] = React.useState("");
  const [paymentNotes, setPaymentNotes] = React.useState("");

  // Spoilage state
  const [spoilageItems, setSpoilageItems] = React.useState<SpoilageItemState[]>(
    []
  );

  const openSpoilageDialog = () => {
    setSpoilageItems(
      sale.items.map((item) => ({
        itemId: item.id,
        fishTypeName: item.fishTypeName,
        fishTypeCode: item.fishTypeCode,
        grade: item.grade,
        weightKg: item.weightKg,
        spoiledWeightKg: item.spoiledWeightKg ?? 0,
        spoilageReason: item.spoilageReason ?? "",
        unitPricePerKg: item.unitPricePerKg,
      }))
    );
    setSpoilageError(null);
    setShowSpoilageDialog(true);
  };

  const handleSpoilageChange = (
    itemId: string,
    field: "spoiledWeightKg" | "spoilageReason",
    value: string | number
  ) => {
    setSpoilageItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          if (field === "spoiledWeightKg") {
            const num = typeof value === "number" ? value : parseFloat(value) || 0;
            const clamped = Math.max(0, Math.min(item.weightKg, num));
            return { ...item, spoiledWeightKg: clamped };
          }
          return { ...item, spoilageReason: String(value) };
        }
        return item;
      })
    );
  };

  async function handleSaveSpoilage() {
    setIsSavingSpoilage(true);
    setSpoilageError(null);
    try {
      const payload = {
        items: spoilageItems.map((item) => ({
          itemId: item.itemId,
          spoiledWeightKg: item.spoiledWeightKg,
          spoilageReason: item.spoilageReason.trim() || null,
        })),
      };

      const res = await fetch(`/api/sales/${sale.id}/spoilage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save spoilage records");
      }

      setShowSpoilageDialog(false);
      router.refresh();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to record spoilage";
      setSpoilageError(msg);
    } finally {
      setIsSavingSpoilage(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setCurrentStatus(newStatus as SaleDetailDTO["status"]);
      router.refresh();
    } catch {
      // Keep existing status
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete sale order");
      router.push("/sales");
      router.refresh();
    } catch {
      setIsDeleting(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setIsRecordingPayment(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMethod,
          paymentDate,
          referenceNumber: paymentRef || null,
          notes: paymentNotes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment receipt");
      }
      router.refresh();
      setShowPaymentForm(false);
    } catch {
      // Keep form open
    } finally {
      setIsRecordingPayment(false);
    }
  }

  const totalSpoiledKg = sale.items.reduce(
    (sum, item) => sum + (item.spoiledWeightKg ?? 0),
    0
  );
  const totalEffectiveKg = sale.items.reduce(
    (sum, item) =>
      sum + (item.effectiveWeightKg ?? Math.max(0, item.weightKg - (item.spoiledWeightKg ?? 0))),
    0
  );

  const totalRawProcurementCost = sale.items.reduce((sum, item) => {
    const effectiveKg =
      item.effectiveWeightKg ??
      Math.max(0, item.weightKg - (item.spoiledWeightKg ?? 0));
    const cost = item.exactPurchasingCost ?? 0;
    return sum + effectiveKg * cost;
  }, 0);

  const hasProcurementCosts = sale.items.some(
    (item) =>
      item.exactPurchasingCost !== null &&
      item.exactPurchasingCost !== undefined &&
      item.exactPurchasingCost > 0
  );

  const totalOrderDirectExpenses =
    (sale.iceCharges || 0) +
    (sale.railwayCharges || 0) +
    (sale.coverRopeCharges || 0) +
    (sale.thermocolBoxCharges || 0) +
    (sale.packingCharges || 0) +
    (sale.expenses || [])
      .filter(
        (e) =>
          ![
            "Ice Cost",
            "Railway Freight / Charges",
            "Cover & Rope Charges",
            "Thermocol Boxes Cost",
            "Packing Charges",
          ].includes(e.categoryName)
      )
      .reduce((sum, e) => sum + e.amount, 0);

  const saleNetProfit =
    sale.totalAmount - totalRawProcurementCost - totalOrderDirectExpenses;
  const saleNetProfitMargin =
    sale.totalAmount > 0 ? (saleNetProfit / sale.totalAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/sales")}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-mono">
                {sale.saleNumber}
              </h1>
              <Badge
                variant={STATUS_BADGE_VARIANTS[currentStatus] ?? "secondary"}
              >
                {currentStatus}
              </Badge>
              <Badge
                variant={
                  STATUS_BADGE_VARIANTS[sale.paymentStatus] ?? "secondary"
                }
              >
                {sale.paymentStatus}
              </Badge>
              {totalSpoiledKg > 0 && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {formatWeight(totalSpoiledKg)} Spoiled / Deducted
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sale.customerName} • {formatDate(sale.saleDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status quick switcher */}
          <div className="w-36">
            <Select
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-8 text-xs font-medium"
              disabled={isUpdatingStatus}
            >
              {DELIVERY_STATUSES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Record Delivery Spoilage Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            onClick={openSpoilageDialog}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {totalSpoiledKg > 0 ? "Edit Delivery Spoilage" : "Record Delivery Spoilage"}
          </Button>

          {sale.paymentStatus !== "PAID" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowPaymentForm(!showPaymentForm)}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Record Payment
            </Button>
          )}

          <Link href={`/expenses/new?saleId=${sale.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Receipt className="h-3.5 w-3.5 text-amber-500" />
              Add Expense
            </Button>
          </Link>

          <Link href={`/sales/${sale.id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Edit3 className="h-3.5 w-3.5 text-primary" />
              Edit Sale
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Payment Form Drawer */}
      {showPaymentForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Record Customer Payment for {sale.saleNumber}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Receipt Amount ($) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={sale.balanceAmount}
                    value={paymentAmount || ""}
                    onChange={(e) =>
                      setPaymentAmount(parseFloat(e.target.value) || 0)
                    }
                    className="h-8 text-xs font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Due Balance: {formatCurrency(sale.balanceAmount)}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Payment Method
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-8 text-xs"
                    options={PAYMENT_METHODS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Receipt Date
                  </label>
                  <Input
                    type="datetime-local"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Transaction / Cheque #
                  </label>
                  <Input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="SWIFT-991823"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Receipt Notes
                </label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes for this customer payment..."
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1 text-xs"
                  disabled={isRecordingPayment || paymentAmount <= 0}
                >
                  {isRecordingPayment && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {isRecordingPayment ? "Recording..." : "Record Payment"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowPaymentForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Order Logistics */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm">Customer & Fulfillment Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                    <User className="h-3 w-3" /> Customer Name
                  </div>
                  <p className="text-sm font-medium">{sale.customerName}</p>
                  {sale.customerCompany && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building className="h-3 w-3" /> {sale.customerCompany}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📞 {sale.customerPhone}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                    <Clock className="h-3 w-3" /> Sale Order Date
                  </div>
                  <p className="text-sm font-medium">{formatDate(sale.saleDate)}</p>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                    <Truck className="h-3 w-3" /> Target Delivery
                  </div>
                  <p className="text-sm font-medium">
                    {sale.deliveryDate ? formatDate(sale.deliveryDate) : "Standard dispatch"}
                  </p>
                </div>

                {sale.customerAddress && (
                  <div className="sm:col-span-2">
                    <div className="text-[11px] text-muted-foreground mb-1">
                      Delivery Address
                    </div>
                    <p className="text-xs text-foreground">{sale.customerAddress}</p>
                  </div>
                )}

                {sale.invoiceUrl && (
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                      <FileText className="h-3 w-3" /> Invoice Attachment
                    </div>
                    <Link
                      href={sale.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline-offset-4 hover:underline flex items-center gap-1"
                    >
                      <CheckCircle className="h-3 w-3" />
                      {sale.invoiceFileName || "Download Invoice"}
                    </Link>
                  </div>
                )}
              </div>

              {sale.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-[11px] text-muted-foreground mb-1">
                    Order Instructions & Notes
                  </div>
                  <p className="text-sm text-foreground">{sale.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fish Items Table */}
          <Card>
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Fish Varieties Sold ({sale.items.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 text-amber-600 dark:text-amber-400"
                onClick={openSpoilageDialog}
              >
                <AlertTriangle className="h-3 w-3" />
                Adjust Spoilage
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[650px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fish Variety</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Dispatched (kg)</TableHead>
                      <TableHead className="text-center">Spoiled / Rejected</TableHead>
                      <TableHead className="text-right">Billable Qty (kg)</TableHead>
                      <TableHead className="text-right text-blue-600 dark:text-blue-400">Purchasing Cost / kg</TableHead>
                      <TableHead className="text-right">Selling Price / kg</TableHead>
                      <TableHead className="text-right">Billed Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((item) => {
                      const spoiledKg = item.spoiledWeightKg ?? 0;
                      const effectiveKg =
                        item.effectiveWeightKg ??
                        Math.max(0, item.weightKg - spoiledKg);
                      const costRate = item.exactPurchasingCost;
                      const marginPerKg =
                        costRate !== null && costRate !== undefined
                          ? item.unitPricePerKg - costRate
                          : null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <span className="text-xs font-semibold">
                                {item.fishTypeName}
                              </span>
                              <br />
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {item.fishTypeCode}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{item.grade}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-medium">
                            {formatWeight(item.weightKg)}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {spoiledKg > 0 ? (
                              <div className="inline-flex flex-col items-center">
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] font-mono px-1.5 py-0 cursor-pointer hover:opacity-80"
                                  onClick={openSpoilageDialog}
                                >
                                  -{formatWeight(spoiledKg)}
                                </Badge>
                                {item.spoilageReason && (
                                  <span
                                    className="text-[10px] text-muted-foreground max-w-[120px] truncate mt-0.5"
                                    title={item.spoilageReason}
                                  >
                                    {item.spoilageReason}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-primary">
                            {formatWeight(effectiveKg)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {costRate !== null && costRate !== undefined ? (
                              <div>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(costRate)}
                                </span>
                                {marginPerKg !== null && (
                                  <div className={`text-[10px] font-medium ${marginPerKg >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                    {marginPerKg >= 0 ? "+" : ""}{formatCurrency(marginPerKg)}/kg
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {formatCurrency(item.unitPricePerKg)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold">
                            {formatCurrency(item.totalPrice)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Payment Receipts History */}
          {sale.payments.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Customer Payment Receipts ({sale.payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sale.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-xs font-mono font-semibold text-primary">
                            {payment.paymentNumber}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(payment.paymentDate)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatPaymentMethod(payment.paymentMethod)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {payment.referenceNumber || "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linked Direct Expenses */}
          <Card>
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-500" />
                Linked Order Expenses ({(sale.expenses || []).length})
              </CardTitle>
              <Link href={`/expenses/new?saleId=${sale.id}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Expense
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {(sale.expenses || []).length > 0 ? (
                <div className="overflow-x-auto">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Expense #</TableHead>
                        <TableHead>Title / Purpose</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(sale.expenses || []).map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell className="text-xs font-mono font-semibold text-primary">
                            {exp.expenseNumber}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {exp.title}
                            {exp.invoiceUrl && (
                              <a
                                href={exp.invoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 text-[10px] text-primary hover:underline"
                              >
                                [Doc ↗]
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {exp.categoryName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(exp.expenseDate)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatPaymentMethod(exp.paymentMethod)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {formatCurrency(exp.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-5 text-center text-xs text-muted-foreground">
                  No direct expenses linked to this sale yet. Use &ldquo;Add Expense&rdquo; above to link packing, ice, or freight costs.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Financial Breakdown */}
        <div className="space-y-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Financial Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Dispatched Gross Weight</span>
                <span className="font-mono font-medium">
                  {formatWeight(sale.totalWeightKg)}
                </span>
              </div>

              {totalSpoiledKg > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Spoiled / Rejected Loss
                    </span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
                      -{formatWeight(totalSpoiledKg)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold bg-primary/10 px-2 py-1 rounded">
                    <span className="text-foreground">Net Billable Weight</span>
                    <span className="font-mono text-primary">
                      {formatWeight(totalEffectiveKg)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-xs pt-1">
                <span className="text-muted-foreground">Billable Items Subtotal</span>
                <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
              </div>

              {sale.taxAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-mono">+{formatCurrency(sale.taxAmount)}</span>
                </div>
              )}
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-mono text-emerald-600">
                    -{formatCurrency(sale.discountAmount)}
                  </span>
                </div>
              )}

              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>Customer Billed Total</span>
                  <span className="font-mono text-primary">
                    {formatCurrency(sale.totalAmount)}
                  </span>
                </div>
              </div>

              {((sale.iceCharges || 0) + (sale.railwayCharges || 0) + (sale.coverRopeCharges || 0) + (sale.thermocolBoxCharges || 0) + (sale.packingCharges || 0)) > 0 && (
                <div className="mt-3 pt-2 border-t border-dashed border-border/80 space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Order Expenses (Borne by Seller)</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">
                      {formatCurrency(
                        (sale.iceCharges || 0) +
                        (sale.railwayCharges || 0) +
                        (sale.coverRopeCharges || 0) +
                        (sale.thermocolBoxCharges || 0) +
                        (sale.packingCharges || 0)
                      )}
                    </span>
                  </div>
                  {sale.iceCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Ice Cost</span>
                      <span className="font-mono">{formatCurrency(sale.iceCharges)}</span>
                    </div>
                  )}
                  {sale.railwayCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Railway Freight</span>
                      <span className="font-mono">{formatCurrency(sale.railwayCharges)}</span>
                    </div>
                  )}
                  {sale.coverRopeCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Cover &amp; Rope</span>
                      <span className="font-mono">{formatCurrency(sale.coverRopeCharges)}</span>
                    </div>
                  )}
                  {sale.thermocolBoxCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Thermocol Box</span>
                      <span className="font-mono">{formatCurrency(sale.thermocolBoxCharges)}</span>
                    </div>
                  )}
                  {sale.packingCharges > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
                      <span>• Packing Cost</span>
                      <span className="font-mono">{formatCurrency(sale.packingCharges)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between text-xs pt-1">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-mono text-emerald-600">
                  -{formatCurrency(sale.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Due Balance</span>
                <span
                  className={`font-mono ${
                    sale.balanceAmount > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatCurrency(sale.balanceAmount)}
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <Badge
                  variant={
                    STATUS_BADGE_VARIANTS[sale.paymentStatus] ?? "secondary"
                  }
                >
                  {sale.paymentStatus}
                </Badge>
                <Badge
                  variant={STATUS_BADGE_VARIANTS[currentStatus] ?? "secondary"}
                >
                  {currentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Order Net Profit Realization Card */}
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Order Net Profit</span>
                <span
                  className={`text-xs font-mono font-bold ${
                    saleNetProfit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {saleNetProfitMargin.toFixed(1)}% Margin
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Grand Total (Billed)</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(sale.totalAmount)}
                </span>
              </div>
              {hasProcurementCosts && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Less: Fish Procurement Cost</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    -{formatCurrency(totalRawProcurementCost)}
                  </span>
                </div>
              )}
              {totalOrderDirectExpenses > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Less: Order Expenses</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    -{formatCurrency(totalOrderDirectExpenses)}
                  </span>
                </div>
              )}
              <div className="border-t border-emerald-500/20 pt-2 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>Take-Home Net Profit</span>
                  <span
                    className={`font-mono ${
                      saleNetProfit >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    }`}
                  >
                    {formatCurrency(saleNetProfit)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Net profit calculated as Billed Grand Total minus Fish Procurement Cost minus Order Expenses.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Order Logged</span>
                <span className="text-foreground">{formatDate(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">{formatDate(sale.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Spoilage / Rejection Management Dialog */}
      <Dialog open={showSpoilageDialog} onOpenChange={setShowSpoilageDialog}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Update Delivery Spoilage / Rejected Fish
          </DialogTitle>
          <DialogDescription>
            Enter spoiled or rejected weight (kg) delivered for invoice #{sale.saleNumber}. Billable delivered weight, items total, and customer balance will recalculate automatically.
          </DialogDescription>
        </DialogHeader>

        {spoilageError && (
          <div className="p-3 mb-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
            {spoilageError}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto space-y-4 py-2 pr-1">
          {spoilageItems.map((item) => {
            const effectiveKg = Math.max(0, item.weightKg - item.spoiledWeightKg);
            const revisedTotal = Number((effectiveKg * item.unitPricePerKg).toFixed(2));

            return (
              <div
                key={item.itemId}
                className="p-3 border rounded-lg bg-card/60 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      {item.fishTypeName}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground ml-2">
                      ({item.fishTypeCode} • {item.grade})
                    </span>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Dispatched: <strong className="text-foreground font-mono">{item.weightKg} kg</strong> @ <strong className="text-foreground font-mono">{formatCurrency(item.unitPricePerKg)}/kg</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-primary font-mono">
                      Revised: {formatCurrency(revisedTotal)}
                    </span>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Billable: {effectiveKg.toFixed(2)} kg
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground">
                      Spoiled / Rejected (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.weightKg}
                      value={item.spoiledWeightKg === 0 ? "" : item.spoiledWeightKg}
                      onChange={(e) =>
                        handleSpoilageChange(
                          item.itemId,
                          "spoiledWeightKg",
                          e.target.value
                        )
                      }
                      placeholder="0.00"
                      className="h-8 text-xs font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Max: {item.weightKg} kg
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground">
                      Reason / Cause
                    </label>
                    <Input
                      type="text"
                      value={item.spoilageReason}
                      onChange={(e) =>
                        handleSpoilageChange(
                          item.itemId,
                          "spoilageReason",
                          e.target.value
                        )
                      }
                      placeholder="e.g., Ice melted, quality issue"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSpoilageDialog(false)}
            disabled={isSavingSpoilage}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveSpoilage}
            disabled={isSavingSpoilage}
            className="gap-1.5"
          >
            {isSavingSpoilage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isSavingSpoilage ? "Updating..." : "Save Spoilage & Update Invoice"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Sale Order"
        description={`Are you sure you want to delete invoice ${sale.saleNumber}? This will roll back the outward inventory transactions (+kg stock restored) and remove related payment receipts. This action cannot be undone.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete Order"}
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
