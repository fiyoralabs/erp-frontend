"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Loader2, Plus, Power, PowerOff, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ActiveBadge } from "@/components/shared/active-badge";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { CategoryAttribute } from "@/lib/types/master";
import type { ProductAttribute, Variant } from "@/lib/types/product";
import { ProductAttributesManager } from "./product-attributes-manager";

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError || error instanceof Error) return error.message;
  return "Something went wrong";
}

function skuPart(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// A single variant "group" the combination grid can pick values from -- either a
// shared category attribute or one of this product's own attributes. groupKey is
// unique across BOTH kinds (their numeric ids come from separate DB sequences and
// can collide), so it -- not the raw id -- is what selection state, combinations,
// and duplicate-detection key off of.
type AttributeGroup = {
  groupKey: string;
  id: number;
  productLevel: boolean;
  name: string;
  required: boolean;
  options: { id: number; value: string; isActive: boolean }[];
};

function combinations(groups: { groupKey: string; values: string[] }[]) {
  return groups.reduce<{ groupKey: string; value: string }[][]>(
    (rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, { groupKey: group.groupKey, value }])),
    [[]]
  );
}

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function ProductVariantsTab({ productId, categoryId, productCode }: {
  productId: number;
  categoryId: number;
  productCode: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<Record<string, Set<string>>>({});
  const [deleteTargetVariant, setDeleteTargetVariant] = React.useState<{ id: number; name: string } | null>(null);

  const variantsQuery = useQuery({
    queryKey: ["products", productId, "variants"],
    queryFn: () => apiClient.get<Variant[]>(`products/${productId}/variants`),
  });
  const categoryAttributesQuery = useQuery({
    queryKey: ["master", "categories", categoryId, "attributes"],
    queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${categoryId}/attributes`),
  });
  const productAttributesQuery = useQuery({
    queryKey: ["products", productId, "attributes"],
    queryFn: () => apiClient.get<ProductAttribute[]>(`products/${productId}/attributes`),
  });

  const attributes: AttributeGroup[] = React.useMemo(() => [
    ...(categoryAttributesQuery.data ?? []).filter((a) => a.variant).map((a): AttributeGroup => ({
      groupKey: `c:${a.id}`, id: a.id, productLevel: false, name: a.name, required: a.required, options: a.options,
    })),
    ...(productAttributesQuery.data ?? []).map((a): AttributeGroup => ({
      groupKey: `p:${a.id}`, id: a.id, productLevel: true, name: a.name, required: false, options: a.options,
    })),
  ], [categoryAttributesQuery.data, productAttributesQuery.data]);

  React.useEffect(() => {
    if (attributes.length === 0) return;
    setSelected((current) => {
      if (Object.keys(current).length > 0) return current;
      return Object.fromEntries(attributes.map((attribute) => [
        attribute.groupKey,
        new Set(attribute.options.filter((option) => option.isActive).map((option) => option.value)),
      ]));
    });
  }, [attributes]);

  const planned = React.useMemo(() => combinations(attributes.map((attribute) => ({
    groupKey: attribute.groupKey,
    values: Array.from(selected[attribute.groupKey] ?? []),
  }))), [attributes, selected]);

  const groupKeyOf = (value: { attributeId: number; productLevel?: boolean }) => `${value.productLevel ? "p" : "c"}:${value.attributeId}`;
  const existingKeys = new Set((variantsQuery.data ?? []).map((variant) =>
    (variant.attributeValues ?? []).map((value) => `${groupKeyOf(value)}:${value.value.toLowerCase()}`).sort().join("|")
  ));
  const missing = planned.filter((row) => !existingKeys.has(
    row.map((value) => `${value.groupKey}:${value.value.toLowerCase()}`).sort().join("|")
  ));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const created: Variant[] = [];
      for (const row of missing) {
        created.push(await apiClient.post<Variant>(`products/${productId}/variants`, {
          productId,
          sku: [productCode, ...row.map((value) => skuPart(value.value))].join("-"),
          attributeValues: row.map((value) => {
            const group = attributes.find((a) => a.groupKey === value.groupKey)!;
            return { attributeId: group.id, value: value.value, productLevel: group.productLevel };
          }),
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

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: number) => apiClient.delete(`products/${productId}/variants/${variantId}`),
    onSuccess: () => {
      toast.success("Variant deleted");
      qc.invalidateQueries({ queryKey: ["products", productId, "variants"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columns: DataTableColumn<Variant>[] = [
    { key: "sku", header: "SKU", render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    { key: "variant", header: "Variant", render: (row) => <div className="flex flex-wrap gap-1">{(row.attributeValues ?? []).length > 0 ? row.attributeValues.map((value) => <Badge key={`${value.productLevel ? "p" : "c"}-${value.attributeId}`} variant="outline">{value.attributeName}: {value.value}</Badge>) : row.variantName}</div> },
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
  ];

  if (categoryAttributesQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading category variant setup...</p>;

  return <div className="flex flex-col gap-4 min-w-0 w-full">
    <ProductAttributesManager productId={productId} />
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4" />Variant configuration</CardTitle><CardDescription>Choose the values sold for this product. Fiyora creates one SKU for every selected combination.</CardDescription></div>
          <Button className="w-full sm:w-auto shrink-0" disabled={missing.length === 0 || generateMutation.isPending || attributes.length === 0} onClick={() => generateMutation.mutate()}>
            {generateMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="mr-1 size-4" />}
            Generate {missing.length} missing variant{missing.length === 1 ? "" : "s"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {attributes.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center"><p className="font-medium">No variant attributes configured</p><p className="text-sm text-muted-foreground">Open Master Data → Categories → Attributes for shared options, or add a product-specific attribute above.</p></div> : attributes.map((attribute) => <div key={attribute.groupKey} className="flex flex-col gap-2"><div className="flex items-center gap-2"><span className="text-sm font-medium">{attribute.name}</span>{attribute.productLevel && <Badge variant="secondary">Product-specific</Badge>}{attribute.required && <Badge variant="secondary">Required</Badge>}</div><div className="flex flex-wrap gap-2">{attribute.options.filter((option) => option.isActive).map((option) => {
          const checked = selected[attribute.groupKey]?.has(option.value) ?? false;
          return <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted/50"><Checkbox checked={checked} onCheckedChange={(value) => setSelected((current) => { const next = { ...current, [attribute.groupKey]: new Set(current[attribute.groupKey] ?? []) }; if (value) next[attribute.groupKey].add(option.value); else next[attribute.groupKey].delete(option.value); return next; })} />{option.value}</label>;
        })}</div></div>)}
        {attributes.length > 0 && <p className="text-xs text-muted-foreground">{planned.length} selected combination{planned.length === 1 ? "" : "s"} · {(variantsQuery.data ?? []).length} already created · {missing.length} missing</p>}
      </CardContent>
    </Card>

    <div><h3 className="font-medium">Sellable variants</h3><p className="text-sm text-muted-foreground">Each row is a stock-keeping unit with its own inventory, price, and barcode.</p></div>
    <DataTable columns={columns} data={variantsQuery.data ?? []} rowKey={(row) => row.id} isLoading={variantsQuery.isLoading} emptyMessage={attributes.length ? "Select values above and generate the missing variants." : "Configure category or product-specific attributes first."} actions={(row) => <div className="flex items-center gap-1"><Button variant="ghost" size="sm" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate(row)}>{row.isActive ? <PowerOff /> : <Power />}{row.isActive ? "Deactivate" : "Activate"}</Button><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTargetVariant({ id: row.id, name: row.variantName || row.sku })}><Trash2 className="h-4 w-4" />Delete</Button></div>} />
    <Button variant="outline" className="w-full sm:w-fit" onClick={() => variantsQuery.refetch()}><RefreshCw className="mr-1 size-4" />Refresh variants</Button>

    <ConfirmDialog
      open={!!deleteTargetVariant}
      onOpenChange={(open) => !open && setDeleteTargetVariant(null)}
      title="Delete Variant?"
      description={`Are you sure you want to delete variant "${deleteTargetVariant?.name}"?`}
      confirmText="Delete Variant"
      variant="destructive"
      isLoading={deleteVariantMutation.isPending}
      onConfirm={() => {
        if (deleteTargetVariant) {
          deleteVariantMutation.mutate(deleteTargetVariant.id);
        }
      }}
    />
  </div>;
}
