"use client";

import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatWeight, formatDate } from "@/lib/utils";
import { STATUS_BADGE_VARIANTS } from "@/constants";
import { EmptyState } from "@/components/ui/empty-state";
import type { SaleDTO } from "@/types";

interface SalesTableRowProps {
  sale: SaleDTO;
}

const SalesTableRow = React.memo(function SalesTableRow({ sale }: SalesTableRowProps) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
      <TableCell>
        <Link
          href={`/sales/${sale.id}`}
          className="font-mono text-xs font-semibold text-primary hover:underline underline-offset-4"
        >
          {sale.saleNumber}
        </Link>
      </TableCell>
      <TableCell className="font-medium text-xs">
        {sale.customerName}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDate(sale.saleDate)}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-right font-mono text-xs text-muted-foreground">
        {sale.itemsCount ?? 1}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-right font-mono text-xs font-medium">
        {formatWeight(sale.totalWeightKg)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
        {formatCurrency(sale.totalAmount)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {sale.netProfit !== undefined ? (
          <div>
            <span
              className={`font-semibold ${
                sale.netProfit >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {formatCurrency(sale.netProfit)}
            </span>
            {sale.netProfitMargin !== undefined && (
              <div className="text-[10px] text-muted-foreground font-medium">
                {sale.netProfitMargin.toFixed(1)}%
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-semibold">
        <span
          className={
            sale.balanceAmount > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }
        >
          {formatCurrency(sale.balanceAmount)}
        </span>
      </TableCell>
      <TableCell>
        <Badge
          variant={
            STATUS_BADGE_VARIANTS[sale.paymentStatus] ?? "secondary"
          }
        >
          {sale.paymentStatus}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge
          variant={STATUS_BADGE_VARIANTS[sale.status] ?? "secondary"}
        >
          {sale.status}
        </Badge>
      </TableCell>
    </TableRow>
  );
});

interface SalesTableProps {
  sales: SaleDTO[];
}

export const SalesTable = React.memo(function SalesTable({ sales }: SalesTableProps) {
  if (sales.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <EmptyState
            title="No sales orders found"
            description="No sales match the specified filter criteria. Try clearing or adjusting your filters."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Invoice / Sale #</TableHead>
                <TableHead>Customer / Company</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Items</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Qty (kg)</TableHead>
                <TableHead className="text-right">Total Billed</TableHead>
                <TableHead className="text-right">Net Profit</TableHead>
                <TableHead className="text-right">Due Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="hidden md:table-cell">Delivery Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <SalesTableRow key={sale.id} sale={sale} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});
