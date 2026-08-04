"use client";

// erp's GET /api/v1/products only accepts Pageable (page/size/sort) --
// confirmed live, no search/category/brand query params exist on this
// endpoint (unlike Master Data list endpoints). So this screen is plain
// pagination only; a text/category filter would need a new backend
// endpoint to be meaningful, noted in IMPLEMENTATION_PLAN.md.

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ActiveBadge } from "@/components/shared/active-badge";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { productSchema, type ProductFormValues } from "@/lib/validation/product";
import type { Product, ProductSummary } from "@/lib/types/product";
import type { Category, Brand, Unit, Tax } from "@/lib/types/master";

const NONE = "__none__";

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

const emptyValues: ProductFormValues = {
  categoryId: undefined as unknown as number,
  brandId: null,
  unitId: undefined as unknown as number,
  taxId: null,
  code: "",
  name: "",
  description: "",
  productType: "SIMPLE",
  trackInventory: true,
  allowNegativeStock: false,
};

export function ProductsListClient({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);

  const listQuery = useQuery({
    queryKey: ["products", page],
    queryFn: () => apiClient.get<PagedResult<ProductSummary>>(`products?page=${page}&size=20`),
  });

  const categoriesQuery = useQuery({
    queryKey: ["master", "categories", "all-for-products"],
    queryFn: () => apiClient.get<PagedResult<Category>>("master/categories?page=0&size=100"),
  });
  const brandsQuery = useQuery({
    queryKey: ["master", "brands", "all-for-products"],
    queryFn: () => apiClient.get<PagedResult<Brand>>("master/brands?page=0&size=100"),
  });
  const unitsQuery = useQuery({
    queryKey: ["master", "units", "all-for-products"],
    queryFn: () => apiClient.get<PagedResult<Unit>>("master/units?page=0&size=100"),
  });
  const taxesQuery = useQuery({
    queryKey: ["master", "taxes", "all-for-products"],
    queryFn: () => apiClient.get<PagedResult<Tax>>("master/taxes?page=0&size=100"),
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyValues,
  });

  React.useEffect(() => {
    if (createOpen) form.reset(emptyValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  const createMutation = useMutation({
    mutationFn: (values: ProductFormValues) =>
      apiClient.post<Product>("products", {
        ...values,
        companyId,
        hasVariants: values.productType === "VARIANT",
      }),
    onSuccess: () => {
      toast.success("Product created");
      qc.invalidateQueries({ queryKey: ["products"] });
      setCreateOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: DataTableColumn<ProductSummary>[] = [
    { key: "code", header: "Code", render: (r) => r.code },
    { key: "name", header: "Name", render: (r) => r.name },
    { key: "category", header: "Category", render: (r) => r.categoryName ?? "—" },
    { key: "brand", header: "Brand", render: (r) => r.brandName ?? "—" },
    {
      key: "type",
      header: "Type",
      render: (r) => (r.hasVariants ? <Badge variant="outline">Has variants</Badge> : "Simple"),
    },
    { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
  ];

  const data = listQuery.data;
  const categories = (categoriesQuery.data?.content ?? []).filter((item) => item.isActive);
  const units = (unitsQuery.data?.content ?? []).filter((item) => item.isActive);
  const brands = (brandsQuery.data?.content ?? []).filter((item) => item.isActive);
  const taxes = (taxesQuery.data?.content ?? []).filter((item) => item.isActive);

  // Select.Value only renders the item's label instead of the raw value
  // when Select.Root is given this `items` map -- without it, the trigger
  // displays the bare id (confirmed live: selecting "Electronics" showed
  // "1" in the trigger). Same fix applied everywhere else an id-valued
  // Select is used across the app.
  const categoryItems = Object.fromEntries(categories.map((c) => [String(c.id), c.name]));
  const unitItems = Object.fromEntries(units.map((u) => [String(u.id), `${u.name} (${u.symbol})`]));
  const brandItems = Object.fromEntries(brands.map((b) => [String(b.id), b.name]));
  const taxItems = Object.fromEntries(taxes.map((t) => [String(t.id), t.name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Products</h1>
          <p className="text-sm text-muted-foreground">
            Product catalog. Click a row&apos;s settings to manage variants, pricing, images,
            and barcodes.
          </p>
        </div>
        <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add product
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(data?.content ?? []).filter((product) => product.isActive)}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        emptyMessage="No products yet."
        page={page}
        totalPages={data?.totalPages}
        onPageChange={setPage}
        actions={(row) => (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/products/${row.id}`} />}
          >
            Manage
          </Button>
        )}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
            <DialogDescription>
              Category, unit, and code can&apos;t be changed after creation.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="SKU-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Wireless Mouse" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Select
                          items={categoryItems}
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
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
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Select
                          items={unitItems}
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.name} ({u.symbol})
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
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Select
                          items={{ [NONE]: "None", ...brandItems }}
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
                          items={{ [NONE]: "None", ...taxItems }}
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
                  name="productType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Type</FormLabel>
                      <FormControl>
                        <Select
                          items={{ SIMPLE: "Simple (no variants)", VARIANT: "Has variants (size/color/etc.)" }}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SIMPLE">Simple (no variants)</SelectItem>
                            <SelectItem value="VARIANT">Has variants (size/color/etc.)</SelectItem>
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
                        <label className="flex items-center gap-2 text-sm font-medium">
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
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                          Allow negative stock
                        </label>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
