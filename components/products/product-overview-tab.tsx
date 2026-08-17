"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, PowerOff, Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Product } from "@/lib/types/product";
import { useBrandsLookup, useTaxesLookup } from "@/lib/hooks/use-master-data";

const NONE = "__none__";

const overviewSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Max 255 characters"),
  description: z.string().max(2000, "Max 2000 characters").optional().or(z.literal("")),
  brandId: z.number().nullable().optional(),
  taxId: z.number().nullable().optional(),
  trackInventory: z.boolean().optional(),
  allowNegativeStock: z.boolean().optional(),
});
type OverviewFormValues = z.infer<typeof overviewSchema>;

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function ProductOverviewTab({ product }: { product: Product }) {
  const qc = useQueryClient();

  const brandsQuery = useBrandsLookup();
  const taxesQuery = useTaxesLookup();

  const form = useForm<OverviewFormValues>({
    resolver: zodResolver(overviewSchema),
    values: {
      name: product.name,
      description: product.description ?? "",
      brandId: product.brandId,
      taxId: product.taxId,
      trackInventory: product.trackInventory,
      allowNegativeStock: product.allowNegativeStock,
    },
    defaultValues: {
      name: "",
      description: "",
      brandId: null,
      taxId: null,
      trackInventory: true,
      allowNegativeStock: false,
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["products", product.id] });
  }

  const updateMutation = useMutation({
    mutationFn: (values: OverviewFormValues) =>
      apiClient.put<Product>(`products/${product.id}`, values),
    onSuccess: () => {
      toast.success("Product updated");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Product has dedicated activate/deactivate endpoints (distinct from the
  // general update) -- confirmed live these enforce "an active product
  // must have at least one active price", so this is kept as its own
  // explicit action rather than folded into the edit form's isActive.
  const toggleActiveMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<Product>(`products/${product.id}/${product.isActive ? "deactivate" : "activate"}`),
    onSuccess: () => {
      toast.success(product.isActive ? "Product deactivated" : "Product activated");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const brands = brandsQuery.data?.content ?? [];
  const taxes = taxesQuery.data?.content ?? [];
  // See products-list-client.tsx for why `items` is required here --
  // without it Select.Value displays the raw id instead of the name.
  const brandItems = { [NONE]: "None", ...Object.fromEntries(brands.map((b) => [String(b.id), b.name])) };
  const taxItems = { [NONE]: "None", ...Object.fromEntries(taxes.map((t) => [String(t.id), t.name])) };

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
      <Card className="overflow-hidden border border-border/60">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:gap-1.5 min-w-0">
              <span className="text-xs text-muted-foreground sm:text-sm">Code</span>
              <span className="font-mono font-semibold text-foreground text-xs sm:text-sm truncate">{product.code}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-1.5 min-w-0">
              <span className="text-xs text-muted-foreground sm:text-sm">Category</span>
              <span className="font-medium text-foreground truncate text-xs sm:text-sm">{product.categoryName ?? "—"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-1.5 min-w-0">
              <span className="text-xs text-muted-foreground sm:text-sm">Unit</span>
              <span className="font-medium text-foreground truncate text-xs sm:text-sm">{product.unitName ?? "—"}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-1.5 min-w-0">
              <span className="text-xs text-muted-foreground sm:text-sm">Type</span>
              <span className="font-medium text-foreground truncate text-xs sm:text-sm">{product.productType}</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto gap-1.5 shrink-0"
            disabled={toggleActiveMutation.isPending}
            onClick={() => toggleActiveMutation.mutate()}
          >
            {toggleActiveMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : product.isActive ? (
              <PowerOff className="size-3.5 text-destructive" />
            ) : (
              <Power className="size-3.5 text-emerald-600" />
            )}
            {product.isActive ? "Deactivate" : "Activate"}
          </Button>
        </CardContent>
      </Card>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Select
                      items={brandItems}
                      value={field.value ? String(field.value) : NONE}
                      onValueChange={(v) => field.onChange(v === NONE || !v ? null : Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {brands.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax</FormLabel>
                  <FormControl>
                    <Select
                      items={taxItems}
                      value={field.value ? String(field.value) : NONE}
                      onValueChange={(v) => field.onChange(v === NONE || !v ? null : Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {taxes.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trackInventory"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                      Track inventory
                    </label>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowNegativeStock"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                      Allow negative stock
                    </label>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="w-full sm:w-fit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </form>
      </Form>
    </div>
  );
}
