"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { LeadProductLine } from "@/lib/types/crm";
import { formatCurrency } from "@/components/crm/shared/format";

interface LineForm {
  productId: number | undefined;
  quantity: number;
  estimatedPrice: number | undefined;
  discount: number | undefined;
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function LeadProductsTab({ leadId }: { leadId: number }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["crm", "leads", leadId, "products"],
    queryFn: () => apiClient.get<LeadProductLine[]>(`crm/leads/${leadId}/products`),
  });

  const form = useForm<LineForm>({ defaultValues: { productId: undefined, quantity: 1, estimatedPrice: undefined, discount: undefined } });

  const addMutation = useMutation({
    mutationFn: (values: LineForm) => apiClient.post(`crm/leads/${leadId}/products`, values),
    onSuccess: () => {
      toast.success("Product added.");
      qc.invalidateQueries({ queryKey: ["crm", "leads", leadId, "products"] });
      form.reset({ productId: undefined, quantity: 1, estimatedPrice: undefined, discount: undefined });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (lineId: number) => apiClient.delete(`crm/leads/${leadId}/products/${lineId}`),
    onSuccess: () => {
      toast.success("Product removed.");
      qc.invalidateQueries({ queryKey: ["crm", "leads", leadId, "products"] });
    },
  });

  const columns: DataTableColumn<LeadProductLine>[] = [
    { key: "product", header: "Product ID", render: (r) => `#${r.productId}` },
    { key: "qty", header: "Quantity", render: (r) => String(r.quantity) },
    { key: "price", header: "Est. Price", render: (r) => formatCurrency(r.estimatedPrice) },
    { key: "discount", header: "Discount", render: (r) => formatCurrency(r.discount) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Product ID</label>
            <Input type="number" {...form.register("productId", { valueAsNumber: true })} />
          </div>
          <div className="w-24">
            <label className="text-xs text-muted-foreground">Qty</label>
            <Input type="number" step="0.001" {...form.register("quantity", { valueAsNumber: true })} />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground">Est. Price</label>
            <Input type="number" {...form.register("estimatedPrice", { valueAsNumber: true })} />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground">Discount</label>
            <Input type="number" {...form.register("discount", { valueAsNumber: true })} />
          </div>
          <Button
            disabled={addMutation.isPending}
            onClick={form.handleSubmit((v) => addMutation.mutate(v))}
            className="gap-1.5"
          >
            {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={query.data ?? []}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        emptyMessage="No interested products added yet."
        actions={(r) => (
          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => removeMutation.mutate(r.id)} aria-label="Remove product">
            <Trash2 className="size-4" />
          </Button>
        )}
      />
    </div>
  );
}
