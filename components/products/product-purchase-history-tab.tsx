"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { PurchaseOrder, Supplier } from "@/lib/types/purchase";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function ProductPurchaseHistoryTab({ productId }: { productId: number }) {
  const ordersQuery = useQuery({
    queryKey: ["purchase", "orders", "product", productId],
    queryFn: async () => {
      const res = await apiClient.get<any>("purchases/orders");
      const list: PurchaseOrder[] = Array.isArray(res) ? res : res.content ?? [];
      return list.filter((po) =>
        po.lines && po.lines.some((l: any) => Number(l.productId) === Number(productId))
      );
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ["purchase", "suppliers"],
    queryFn: () => apiClient.get<Supplier[]>("purchases/suppliers"),
  });

  const orders = ordersQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];

  // Group purchase history for this product
  const historyEntries = React.useMemo(() => {
    const entries: Array<{
      id: number;
      poNumber: string;
      orderDate: string;
      supplierId: number;
      supplierName: string;
      orderedQty: number;
      receivedQty: number;
      pendingQty: number;
      unitPrice: number;
      status: string;
    }> = [];

    for (const po of orders) {
      for (const line of po.lines) {
        if (Number(line.productId) === Number(productId)) {
          const ordered = line.orderedQuantity ?? line.quantity ?? 0;
          const received = line.receivedQuantity ?? line.acceptedQuantity ?? 0;
          const pending = Math.max(0, ordered - received);
          const price = line.unitPrice ?? line.purchasePrice ?? 0;

          entries.push({
            id: po.id,
            poNumber: po.poNumber,
            orderDate: po.orderDate,
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            orderedQty: ordered,
            receivedQty: received,
            pendingQty: pending,
            unitPrice: price,
            status: po.status,
          });
        }
      }
    }

    return entries.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders, productId]);

  // Unique suppliers summary for this product
  const suppliersSummary = React.useMemo(() => {
    const map = new Map<number, { supplierName: string; lastPrice: number; lastDate: string; totalOrdered: number }>();

    for (const entry of historyEntries) {
      if (!map.has(entry.supplierId)) {
        map.set(entry.supplierId, {
          supplierName: entry.supplierName,
          lastPrice: entry.unitPrice,
          lastDate: entry.orderDate,
          totalOrdered: entry.orderedQty,
        });
      } else {
        const existing = map.get(entry.supplierId)!;
        existing.totalOrdered += entry.orderedQty;
      }
    }

    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
  }, [historyEntries]);

  if (ordersQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading purchase history...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Suppliers Summary Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" /> Product Suppliers ({suppliersSummary.length})
          </CardTitle>
          <CardDescription>Suppliers who have provided this product based on order history.</CardDescription>
        </CardHeader>
        <CardContent>
          {suppliersSummary.length === 0 ? (
            <p className="text-xs text-muted-foreground">No purchase records found for this product.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suppliersSummary.map((s) => {
                const supObj = suppliers.find((sup) => sup.id === s.id);
                return (
                  <div key={s.id} className="p-3.5 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{s.supplierName}</div>
                      {supObj?.code && <Badge variant="outline" className="text-[10px]">{supObj.code}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Last Purchase Price:</span>
                        <span className="font-semibold text-foreground">{money.format(s.lastPrice)}/unit</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Purchased:</span>
                        <span className="font-medium text-foreground">{s.lastDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Units Ordered:</span>
                        <span className="font-medium text-foreground">{s.totalOrdered}</span>
                      </div>
                    </div>
                    <div className="pt-1">
                      <Link href={`/purchases/new?supplierId=${s.id}&productId=${productId}`}>
                        <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1">
                          <ShoppingBag className="h-3 w-3" /> Reorder from {s.supplierName}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Purchase History Log ({historyEntries.length})</CardTitle>
          <CardDescription>Complete log of purchase orders, prices, and fulfillment status for this product.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Unit Price (₹)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-xs">No purchase orders recorded for this product yet.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  historyEntries.map((e, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{e.orderDate}</TableCell>
                      <TableCell className="font-medium text-xs font-mono">{e.poNumber}</TableCell>
                      <TableCell className="font-medium text-xs">{e.supplierName}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{e.orderedQty}</TableCell>
                      <TableCell className="text-right text-xs">{e.receivedQty}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-amber-600">{e.pendingQty}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">{money.format(e.unitPrice)}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "RECEIVED" ? "secondary" : "default"} className="text-[10px]">
                          {e.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
