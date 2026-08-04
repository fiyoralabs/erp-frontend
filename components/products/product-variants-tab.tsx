"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Loader2, Plus, Power, PowerOff, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ActiveBadge } from "@/components/shared/active-badge";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { CategoryAttribute } from "@/lib/types/master";
import type { Variant } from "@/lib/types/product";

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError || error instanceof Error) return error.message;
  return "Something went wrong";
}

function skuPart(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function combinations(groups: { attributeId: number; values: string[] }[]) {
  return groups.reduce<{ attributeId: number; value: string }[][]>(
    (rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, { attributeId: group.attributeId, value }])),
    [[]]
  );
}

export function ProductVariantsTab({ productId, categoryId, productCode }: {
  productId: number;
  categoryId: number;
  productCode: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<Record<number, Set<string>>>({});

  const variantsQuery = useQuery({
    queryKey: ["products", productId, "variants"],
    queryFn: () => apiClient.get<Variant[]>(`products/${productId}/variants`),
  });
  const attributesQuery = useQuery({
    queryKey: ["master", "categories", categoryId, "attributes"],
    queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${categoryId}/attributes`),
  });
  const attributes = React.useMemo(
    () => (attributesQuery.data ?? []).filter((attribute) => attribute.variant),
    [attributesQuery.data]
  );

  React.useEffect(() => {
    if (attributes.length === 0) return;
    setSelected((current) => {
      if (Object.keys(current).length > 0) return current;
      return Object.fromEntries(attributes.map((attribute) => [
        attribute.id,
        new Set(attribute.options.filter((option) => option.isActive).map((option) => option.value)),
      ]));
    });
  }, [attributes]);

  const planned = React.useMemo(() => combinations(attributes.map((attribute) => ({
    attributeId: attribute.id,
    values: Array.from(selected[attribute.id] ?? []),
  }))), [attributes, selected]);

  const existingKeys = new Set((variantsQuery.data ?? []).map((variant) =>
    (variant.attributeValues ?? []).map((value) => `${value.attributeId}:${value.value.toLowerCase()}`).sort().join("|")
  ));
  const missing = planned.filter((row) => !existingKeys.has(
    row.map((value) => `${value.attributeId}:${value.value.toLowerCase()}`).sort().join("|")
  ));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const created: Variant[] = [];
      for (const row of missing) {
        created.push(await apiClient.post<Variant>(`products/${productId}/variants`, {
          productId,
          sku: [productCode, ...row.map((value) => skuPart(value.value))].join("-"),
          attributeValues: row,
          isActive: true,
        }));
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(`${created.length} variant${created.length === 1 ? "" : "s"} generated`);
      qc.invalidateQueries({ queryKey: ["products", productId, "variants"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggleMutation = useMutation({
    mutationFn: (variant: Variant) => apiClient.patch<Variant>(
      `products/${productId}/variants/${variant.id}/${variant.isActive ? "deactivate" : "activate"}`
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", productId, "variants"] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columns: DataTableColumn<Variant>[] = [
    { key: "sku", header: "SKU", render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    { key: "variant", header: "Variant", render: (row) => <div className="flex flex-wrap gap-1">{(row.attributeValues ?? []).length > 0 ? row.attributeValues.map((value) => <Badge key={value.attributeId} variant="outline">{value.attributeName}: {value.value}</Badge>) : row.variantName}</div> },
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
  ];

  if (attributesQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading category variant setup...</p>;

  return <div className="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4" />Variant configuration</CardTitle><CardDescription>Choose the values sold for this product. Fiyora creates one SKU for every selected combination.</CardDescription></div>
          <Button disabled={missing.length === 0 || generateMutation.isPending || attributes.length === 0} onClick={() => generateMutation.mutate()}>
            {generateMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Generate {missing.length} missing variant{missing.length === 1 ? "" : "s"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {attributes.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center"><p className="font-medium">No variant attributes configured for this category</p><p className="text-sm text-muted-foreground">Open Master Data → Categories → Attributes and add Color, Size, Storage, or another variant attribute.</p></div> : attributes.map((attribute) => <div key={attribute.id} className="flex flex-col gap-2"><div className="flex items-center gap-2"><span className="text-sm font-medium">{attribute.name}</span>{attribute.required && <Badge variant="secondary">Required</Badge>}</div><div className="flex flex-wrap gap-2">{attribute.options.filter((option) => option.isActive).map((option) => {
          const checked = selected[attribute.id]?.has(option.value) ?? false;
          return <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted/50"><Checkbox checked={checked} onCheckedChange={(value) => setSelected((current) => { const next = { ...current, [attribute.id]: new Set(current[attribute.id] ?? []) }; if (value) next[attribute.id].add(option.value); else next[attribute.id].delete(option.value); return next; })} />{option.value}</label>;
        })}</div></div>)}
        {attributes.length > 0 && <p className="text-xs text-muted-foreground">{planned.length} selected combination{planned.length === 1 ? "" : "s"} · {(variantsQuery.data ?? []).length} already created · {missing.length} missing</p>}
      </CardContent>
    </Card>

    <div><h3 className="font-medium">Sellable variants</h3><p className="text-sm text-muted-foreground">Each row is a stock-keeping unit with its own inventory, price, and barcode.</p></div>
    <DataTable columns={columns} data={variantsQuery.data ?? []} rowKey={(row) => row.id} isLoading={variantsQuery.isLoading} emptyMessage={attributes.length ? "Select values above and generate the missing variants." : "Configure category attributes first."} actions={(row) => <Button variant="ghost" size="sm" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate(row)}>{row.isActive ? <PowerOff /> : <Power />}{row.isActive ? "Deactivate" : "Activate"}</Button>} />
    <Button variant="outline" className="w-fit" onClick={() => variantsQuery.refetch()}><RefreshCw />Refresh variants</Button>
  </div>;
}
