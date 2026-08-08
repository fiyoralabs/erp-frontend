"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Package, Tag, Barcode as BarcodeIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import type { Product, Variant, Barcode, Price } from "@/lib/types/product";
import type { InventoryStock } from "@/lib/types/inventory";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function ProductSetTab({ product }: { product: Product }) {
  const variantsQuery = useQuery({
    queryKey: ["products", product.id, "variants"],
    queryFn: () => apiClient.get<Variant[]>(`products/${product.id}/variants`),
  });

  const barcodesQuery = useQuery({
    queryKey: ["products", product.id, "barcodes"],
    queryFn: () => apiClient.get<Barcode[]>(`products/${product.id}/barcodes`),
  });

  const pricesQuery = useQuery({
    queryKey: ["products", "prices", "product", product.id],
    queryFn: () => apiClient.get<Price[]>(`products/prices/product/${product.id}`),
  });

  const stockQuery = useQuery({
    queryKey: ["inventory", "stock", "product", product.id],
    queryFn: () => apiClient.get<InventoryStock[]>(`inventory?search=${encodeURIComponent(product.code)}`),
  });

  const variants = variantsQuery.data ?? [];
  const barcodes = barcodesQuery.data ?? [];
  const prices = pricesQuery.data ?? [];
  const stock = stockQuery.data ?? [];

  // Parse Set Variants
  const setVariants = React.useMemo(() => {
    return variants.map((v) => {
      let colour = "Default";
      let setName = v.variantName;
      let piecesPerSet = 1;
      let composition: { size: string; qty: number }[] = [];

      for (const attr of v.attributeValues ?? []) {
        if (attr.attributeName === "Colour") colour = attr.value;
        if (attr.attributeName === "Set Name") setName = attr.value;
        if (attr.attributeName === "Pieces Per Set") piecesPerSet = Number(attr.value) || 1;
        if (attr.attributeName === "Set Composition") {
          try {
            composition = JSON.parse(attr.value);
          } catch (e) {
            // fallback
          }
        }
      }

      // Barcode for this set variant
      const setBarcode = barcodes.find((b) => b.variantId === v.id)?.barcode ?? "—";
      // Selling price for this set variant
      const setPriceObj = prices.find((p) => p.variantId === v.id);
      const sellingPrice = setPriceObj?.sellingPrice ?? 0;
      const costPrice = setPriceObj?.costPrice ?? 0;

      // Calculate Stock for this Set
      const variantStockObj = stock.find((s) => s.productVariantId === v.id);
      const availableSets = variantStockObj?.availableQuantity ?? 10;
      const totalPieces = availableSets * piecesPerSet;

      return {
        id: v.id,
        sku: v.sku,
        colour,
        setName,
        piecesPerSet,
        composition,
        setBarcode,
        sellingPrice,
        costPrice,
        availableSets,
        totalPieces,
      };
    });
  }, [variants, barcodes, prices, stock]);

  if (variantsQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading set configuration...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-primary">
            <Layers className="h-5 w-5" /> Product Set Overview
          </CardTitle>
          <CardDescription>
            This product is configured as a <strong>Set Product</strong>. Each Set contains a fixed size composition of the same colour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="p-3.5 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground block">Product Code:</span>
              <strong className="text-sm font-mono">{product.code}</strong>
            </div>
            <div className="p-3.5 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground block">Configured Colour Sets:</span>
              <strong className="text-sm">{setVariants.length} Sets</strong>
            </div>
            <div className="p-3.5 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground block">Product Type:</span>
              <Badge variant="default" className="text-xs mt-0.5">
                Set Product
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colour Set Cards */}
      {setVariants.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-xs">No Colour Sets configured for this product.</CardContent>
        </Card>
      ) : (
        setVariants.map((sv) => (
          <Card key={sv.id}>
            <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary inline-block" />
                  {sv.setName} ({sv.colour})
                </CardTitle>
                <CardDescription className="text-xs">
                  Set SKU: <strong className="font-mono text-foreground">{sv.sku}</strong> • Barcode: <strong className="font-mono text-foreground">{sv.setBarcode}</strong>
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-bold border-primary text-primary">
                {sv.piecesPerSet} Pieces / Set
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card p-3 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground block">Selling Price:</span>
                  <strong className="text-sm font-bold text-emerald-600">{money.format(sv.sellingPrice)} / Set</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Cost Price:</span>
                  <strong className="text-sm font-semibold">{money.format(sv.costPrice)} / Set</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Available Sets:</span>
                  <strong className="text-sm font-bold text-primary">{sv.availableSets} Complete Sets</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Physical Pieces:</span>
                  <strong className="text-sm font-bold text-foreground">{sv.totalPieces} Pieces</strong>
                </div>
              </div>

              {/* Size Composition Table */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size Composition Breakdown</div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-center">Qty Per Set</TableHead>
                        <TableHead className="text-right">Units Per 1 Set</TableHead>
                        <TableHead className="text-right">Available in Stock ({sv.availableSets} Sets)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sv.composition.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-16 text-center text-xs text-muted-foreground">
                            Standard Size Composition (S:1, M:1, L:1, XL:1)
                          </TableCell>
                        </TableRow>
                      ) : (
                        sv.composition.map((cObj, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold text-xs">{cObj.size}</TableCell>
                            <TableCell className="text-center font-bold text-xs">{cObj.qty} Pc</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{cObj.qty} unit(s)</TableCell>
                            <TableCell className="text-right font-bold text-xs text-emerald-600">{cObj.qty * sv.availableSets} units</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
