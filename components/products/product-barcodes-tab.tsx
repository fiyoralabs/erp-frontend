"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ComboboxField } from "@/components/shared/combobox-field";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { barcodeSchema, type BarcodeFormValues } from "@/lib/validation/product";
import { BARCODE_TYPES, type Barcode, type Product, type Variant } from "@/lib/types/product";

const emptyValues: BarcodeFormValues = { barcode: "", barcodeType: "PRIMARY" };
const barcodeTypeOptions = BARCODE_TYPES.map((t) => ({ value: t, label: t }));

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function ProductBarcodesTab({ productId }: { productId: number }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Barcode | null>(null);

  const productQuery = useQuery({ queryKey: ["products", productId], queryFn: () => apiClient.get<Product>(`products/${productId}`) });
  const variantsQuery = useQuery({ queryKey: ["products", productId, "variants"], queryFn: () => apiClient.get<Variant[]>(`products/${productId}/variants`), enabled: !!productQuery.data?.hasVariants });
  const barcodesQuery = useQuery({ queryKey: ["products", productId, "barcodes"], queryFn: () => apiClient.get<Barcode[]>(`products/${productId}/barcodes`) });
  const barcodes = barcodesQuery.data ?? [];

  const form = useForm<BarcodeFormValues>({
    resolver: zodResolver(barcodeSchema),
    defaultValues: emptyValues,
  });

  React.useEffect(() => {
    if (createOpen) form.reset(emptyValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  const createMutation = useMutation({
    mutationFn: (values: BarcodeFormValues) =>
      apiClient.post<Barcode>("products/barcodes", { ...values, productId }),
    onSuccess: (created) => {
      toast.success("Barcode added");
      qc.invalidateQueries({ queryKey: ["products", productId, "barcodes"] });
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["products", productId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete<void>(`products/barcodes/${id}`),
    onSuccess: (_data, id) => {
      toast.success("Barcode removed");
      qc.invalidateQueries({ queryKey: ["products", productId, "barcodes"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleteTarget(null);
    },
  });

  const generateMutation = useMutation({
    mutationFn: (variantId: number | null | undefined) => apiClient.post<Barcode>(
      `products/${productId}/barcodes/generate${variantId == null ? "" : `?variantId=${variantId}`}`,
      {}
    ),
    onSuccess: () => {
      toast.success("Internal CODE128 barcode generated");
      qc.invalidateQueries({ queryKey: ["products", productId, "barcodes"] });
      setCreateOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: DataTableColumn<Barcode>[] = [
    { key: "barcode", header: "Barcode", render: (r) => r.barcode },
    { key: "type", header: "Type", render: (r) => r.barcodeType },
    { key: "primary", header: "Primary", render: (r) => (r.isPrimary ? "Yes" : "—") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          A simple product shares one retail barcode. Variant products use a barcode per sellable variant; batches use separate batch numbers.
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add barcode
        </Button>
      </div>

      {barcodes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No barcodes assigned yet.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={barcodes}
          rowKey={(row) => row.id}
          actions={(row) => (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-destructive hover:text-destructive sm:size-8"
              aria-label="Delete barcode"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add barcode</DialogTitle>
            <DialogDescription>Scannable code for this product.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="variantId"
                render={({ field }) => productQuery.data?.hasVariants ? (
                  <FormItem>
                    <FormLabel>Variant</FormLabel>
                    <FormControl>
                      <Select
                        items={Object.fromEntries((variantsQuery.data ?? []).filter((variant) => variant.isActive).map((variant) => [String(variant.id), `${variant.variantName} (${variant.sku})`]))}
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                      >
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select variant" /></SelectTrigger>
                        <SelectContent>{(variantsQuery.data ?? []).filter((variant) => variant.isActive).map((variant) => <SelectItem key={variant.id} value={String(variant.id)}>{variant.variantName} ({variant.sku})</SelectItem>)}</SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                ) : <></>}
              />
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="8901234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barcodeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <ComboboxField
                        id={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        options={barcodeTypeOptions}
                        placeholder="EAN13"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        Primary barcode
                      </label>
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="animate-spin" />}
                  Add
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={generateMutation.isPending || (!!productQuery.data?.hasVariants && !form.watch("variantId"))}
                  onClick={() => generateMutation.mutate(form.getValues("variantId"))}
                >
                  {generateMutation.isPending && <Loader2 className="animate-spin" />}
                  Generate internal
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove barcode?"
        description={`This permanently deletes the barcode "${deleteTarget?.barcode ?? ""}".`}
        confirmLabel="Remove"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
