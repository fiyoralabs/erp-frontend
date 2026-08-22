"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { CategoryAttribute } from "@/lib/types/master";
import type { ProductAttribute } from "@/lib/types/product";
import { ProductAttributesManager } from "./product-attributes-manager";

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError || error instanceof Error) return error.message;
  return "Something went wrong";
}

type Group = { groupKey: string; id: number; productLevel: boolean; name: string; required: boolean; options: { id: number; value: string; isActive: boolean }[] };

/** Shown instead of the variant tab for a SIMPLE product: converts it into a
 *  VARIANT product by creating its first variant from category and/or
 *  product-specific attribute values. That variant inherits the product's
 *  existing price and stock (which have nowhere else to live once the product
 *  stops being SIMPLE) -- more variants can be added afterward from the normal
 *  variant tab that appears once the conversion succeeds. */
export function ConvertToVariantCard({ productId, categoryId }: { productId: number; categoryId: number }) {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<Record<string, string>>({});
  const [sku, setSku] = React.useState("");
  const [variantName, setVariantName] = React.useState("");

  const categoryAttributesQuery = useQuery({
    queryKey: ["master", "categories", categoryId, "attributes"],
    queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${categoryId}/attributes`),
  });
  const productAttributesQuery = useQuery({
    queryKey: ["products", productId, "attributes"],
    queryFn: () => apiClient.get<ProductAttribute[]>(`products/${productId}/attributes`),
  });

  const groups: Group[] = React.useMemo(() => [
    ...(categoryAttributesQuery.data ?? []).filter((a) => a.variant).map((a): Group => ({
      groupKey: `c:${a.id}`, id: a.id, productLevel: false, name: a.name, required: a.required, options: a.options,
    })),
    ...(productAttributesQuery.data ?? []).map((a): Group => ({
      groupKey: `p:${a.id}`, id: a.id, productLevel: true, name: a.name, required: false, options: a.options,
    })),
  ], [categoryAttributesQuery.data, productAttributesQuery.data]);

  const convertMutation = useMutation({
    mutationFn: () => {
      const attributeValues = groups
        .filter((group) => selected[group.groupKey])
        .map((group) => ({ attributeId: group.id, value: selected[group.groupKey], productLevel: group.productLevel }));
      return apiClient.post(`products/${productId}/convert-to-variant`, {
        sku: sku.trim() || undefined,
        variantName: variantName.trim() || undefined,
        attributeValues,
      });
    },
    onSuccess: () => {
      toast.success("Converted to a variant product. Its price and stock moved to the new variant.");
      qc.invalidateQueries({ queryKey: ["products", productId] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="size-4" />Convert to a variant product</CardTitle>
      <CardDescription>
        This product is currently Simple (one SKU). Pick the value(s) that identify its first variant --
        its existing price and stock will move onto that variant. Add more variants afterward from this tab.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <ProductAttributesManager productId={productId} />

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No category or product-specific attributes yet -- add one above, or just give this first variant a name below.
        </p>
      ) : groups.map((group) => (
        <div key={group.groupKey} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{group.name}</span>
            {group.productLevel && <Badge variant="secondary">Product-specific</Badge>}
            {group.required && <Badge variant="secondary">Required</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.filter((option) => option.isActive).map((option) => {
              const checked = selected[group.groupKey] === option.value;
              return (
                <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted/50">
                  <input
                    type="radio"
                    name={group.groupKey}
                    checked={checked}
                    onChange={() => setSelected((current) => ({ ...current, [group.groupKey]: option.value }))}
                  />
                  {option.value}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>Variant name (optional if attribute values are picked above)</span>
          <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. Default" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>SKU (optional, auto-generated from the product code + values)</span>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
      </div>

      <Button className="w-fit" disabled={convertMutation.isPending} onClick={() => convertMutation.mutate()}>
        {convertMutation.isPending ? <Loader2 className="animate-spin" /> : <ArrowRightLeft className="mr-1 size-4" />}
        Convert to variant product
      </Button>
    </CardContent>
  </Card>;
}
