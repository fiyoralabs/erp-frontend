"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, IndianRupee, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Price, Variant } from "@/lib/types/product";
import { usePriceListsLookup } from "@/lib/hooks/use-master-data";

interface PriceRow {
  variantId: number | null;
  label: string;
  sku: string;
  priceId: number | null;
  sellingPrice: string;
  mrp: string;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError || error instanceof Error) return error.message;
  return "Something went wrong";
}

function currentPrice(prices: Price[], variantId: number | null, priceListId: number) {
  return prices
    .filter((price) => price.priceListId === priceListId && price.variantId === variantId && price.isActive)
    .sort((left, right) => new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime())[0];
}

export function ProductPricingTab({ productId, companyId, hasVariants }: {
  productId: number;
  companyId: number;
  hasVariants: boolean;
}) {
  const qc = useQueryClient();
  const [priceListId, setPriceListId] = React.useState<number | null>(null);
  const [rows, setRows] = React.useState<PriceRow[]>([]);

  const priceListsQuery = usePriceListsLookup();
  const variantsQuery = useQuery({
    queryKey: ["products", productId, "variants"],
    queryFn: () => apiClient.get<Variant[]>(`products/${productId}/variants`),
    enabled: hasVariants,
  });
  const pricesQuery = useQuery({
    queryKey: ["products", productId, "prices", "all"],
    queryFn: () => apiClient.get<Price[]>(`products/prices/product/${productId}`),
  });

  const priceLists = (priceListsQuery.data?.content ?? []).filter((priceList) => priceList.isActive);
  const variants = (variantsQuery.data ?? []).filter((variant) => variant.isActive);

  React.useEffect(() => {
    if (priceListId == null || !pricesQuery.data) { setRows([]); return; }
    const identities = hasVariants
      ? variants.map((variant) => ({ id: variant.id, label: variant.variantName, sku: variant.sku }))
      : [{ id: null, label: "Base product", sku: "—" }];
    setRows(identities.map((identity) => {
      const price = currentPrice(pricesQuery.data!, identity.id, priceListId);
      return {
        variantId: identity.id,
        label: identity.label,
        sku: identity.sku,
        priceId: price?.id ?? null,
        sellingPrice: price ? String(price.sellingPrice) : "",
        mrp: price?.mrp == null ? "" : String(price.mrp),
      };
    }));
  }, [hasVariants, priceListId, pricesQuery.data, variantsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (priceListId == null) throw new Error("Select a price list");
      const invalid = rows.find((row) => Number(row.sellingPrice) <= 0);
      if (invalid) throw new Error(`Enter a valid selling price for ${invalid.label}`);
      for (const row of rows) {
        const values = {
          sellingPrice: Number(row.sellingPrice),
          mrp: row.mrp === "" ? null : Number(row.mrp),
          isActive: true,
        };
        if (row.priceId) await apiClient.put<Price>(`products/prices/${row.priceId}`, values);
        else await apiClient.post<Price>("products/prices", {
          ...values, companyId, productId, variantId: row.variantId, priceListId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Variant price matrix saved");
      qc.invalidateQueries({ queryKey: ["products", productId, "prices"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function updateRow(index: number, field: "sellingPrice" | "mrp", value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function copyFirstToAll() {
    const first = rows[0];
    if (!first) return;
    setRows((current) => current.map((row, index) => index === 0 ? row : {
      ...row, sellingPrice: first.sellingPrice, mrp: first.mrp,
    }));
  }

  return <div className="flex flex-col gap-4 min-w-0 w-full">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><IndianRupee className="size-4" />Price-list worksheet</CardTitle>
        <CardDescription>Select the selling price list, then enter prices for every sellable SKU. Locations inherit these prices through their assigned price lists.</CardDescription>
      </CardHeader>
      <CardContent className="max-w-md">
        <label className="mb-2 block text-sm font-medium">Price list</label>
        <Select
          items={Object.fromEntries(priceLists.map((priceList) => [String(priceList.id), `${priceList.name} (${priceList.code})`]))}
          value={priceListId ? String(priceListId) : ""}
          onValueChange={(value) => setPriceListId(value ? Number(value) : null)}
        >
          <SelectTrigger className="w-full"><SelectValue placeholder="Select price list" /></SelectTrigger>
          <SelectContent>{priceLists.map((priceList) => <SelectItem key={priceList.id} value={String(priceList.id)}>{priceList.name} ({priceList.code})</SelectItem>)}</SelectContent>
        </Select>
      </CardContent>
    </Card>

    {priceListId != null && <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle className="text-base">{hasVariants ? "Variant prices" : "Product price"}</CardTitle><CardDescription>{hasVariants ? "Every variant can have a different selling price and MRP." : "Set the base product price for this price list."}</CardDescription></div>
          {rows.length > 1 && <Button variant="outline" className="w-full sm:w-auto shrink-0" onClick={copyFirstToAll}><Copy className="mr-1 size-4" />Copy first row to all</Button>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pricesQuery.isLoading || variantsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading price worksheet...</p> : rows.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center"><p className="font-medium">No active variants to price</p><p className="text-sm text-muted-foreground">Generate variants in the Variants tab first.</p></div> : <>
          <div className="hidden grid-cols-[minmax(220px,1fr)_140px_140px] gap-3 border-b pb-2 text-xs font-medium text-muted-foreground md:grid"><span>Sellable SKU</span><span>Selling price</span><span>MRP</span></div>
          {rows.map((row, index) => <div key={row.variantId ?? "product"} className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(220px,1fr)_140px_140px] md:items-center md:border-0 md:border-b md:px-0">
            <div><div className="flex items-center gap-2 font-medium">{row.label}{row.priceId ? <Badge variant="secondary">Priced</Badge> : <Badge variant="outline">New</Badge>}</div><p className="font-mono text-xs text-muted-foreground">{row.sku}</p></div>
            {(["sellingPrice", "mrp"] as const).map((field) => <label key={field} className="flex flex-col gap-1"><span className="text-xs text-muted-foreground md:hidden">{field === "sellingPrice" ? "Selling price" : "MRP"}</span><Input type="number" min="0" step="0.01" value={row[field]} placeholder="0.00" onChange={(event) => updateRow(index, field, event.target.value)} /></label>)}
          </div>)}
          <div className="flex justify-end pt-2"><Button className="w-full sm:w-auto" disabled={saveMutation.isPending || rows.length === 0} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save className="mr-1 size-4" />}Save all prices</Button></div>
        </>}
      </CardContent>
    </Card>}
  </div>;
}
