"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { ProductAttribute } from "@/lib/types/product";
import { productAttributeSchema, type ProductAttributeFormValues as FormValues } from "@/lib/validation/master";

const emptyValues: FormValues = { code: "", name: "", dataType: "SELECT", displayOrder: 0, optionText: "" };

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError || error instanceof Error) return error.message;
  return "Something went wrong";
}

/** CRUD for a single product's own variant attributes -- separate from the
 *  category-wide attributes managed at Master Data → Categories → Attributes.
 *  Used both in the variant tab of an already-variant product and in the
 *  simple→variant conversion panel. */
export function ProductAttributesManager({ productId }: { productId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<ProductAttribute | "create" | null>(null);
  const [deleting, setDeleting] = React.useState<ProductAttribute | null>(null);

  const attributesQuery = useQuery({
    queryKey: ["products", productId, "attributes"],
    queryFn: () => apiClient.get<ProductAttribute[]>(`products/${productId}/attributes`),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(productAttributeSchema), defaultValues: emptyValues });

  React.useEffect(() => {
    if (!editing) return;
    form.reset(editing === "create" ? emptyValues : {
      code: editing.code ?? "", name: editing.name, dataType: editing.dataType,
      displayOrder: editing.displayOrder,
      optionText: editing.options.filter((option) => option.isActive).map((option) => option.value).join(", "),
    });
  }, [editing, form]);

  const payload = (values: FormValues) => ({
    code: values.code || null, name: values.name, dataType: values.dataType,
    displayOrder: values.displayOrder,
    options: values.dataType === "SELECT" ? (values.optionText ?? "").split(",").map((value, index) => ({ value: value.trim(), displayOrder: index, isActive: true })).filter((option) => option.value) : [],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["products", productId, "attributes"] });
  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => editing === "create"
      ? apiClient.post<ProductAttribute>(`products/${productId}/attributes`, payload(values))
      : apiClient.put<ProductAttribute>(`products/${productId}/attributes/${editing!.id}`, payload(values)),
    onSuccess: () => { toast.success("Product attribute saved"); invalidate(); setEditing(null); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (attributeId: number) => apiClient.delete<void>(`products/${productId}/attributes/${attributeId}`),
    onSuccess: () => { toast.success("Attribute removed"); invalidate(); setDeleting(null); },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columns: DataTableColumn<ProductAttribute>[] = [
    { key: "name", header: "Attribute", render: (row) => row.name },
    { key: "type", header: "Type", render: (row) => <Badge variant="outline">{row.dataType}</Badge> },
    { key: "options", header: "Options", render: (row) => row.options.filter((option) => option.isActive).map((option) => option.value).join(", ") || "—" },
  ];

  return <Card>
    <CardHeader>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Tag className="size-4" />Product-specific attributes</CardTitle>
          <CardDescription>Attributes that only apply to this product (e.g. a one-off Material option), separate from the shared category attributes.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing("create")}><Plus className="size-4" />Add attribute</Button>
      </div>
    </CardHeader>
    <CardContent>
      <DataTable columns={columns} data={attributesQuery.data ?? []} rowKey={(row) => row.id} isLoading={attributesQuery.isLoading} emptyMessage="No product-specific attributes yet." actions={(row) => <><Button variant="ghost" size="icon" onClick={() => setEditing(row)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(row)}><Trash2 className="size-4" /></Button></>} />
    </CardContent>

    <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>{editing === "create" ? "Add product attribute" : "Edit product attribute"}</DialogTitle><DialogDescription>SELECT attributes provide controlled values for variant generation.</DialogDescription></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="flex flex-col gap-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Material" {...field} /></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="MATERIAL" {...field} /></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="dataType" render={({ field }) => <FormItem><FormLabel>Data type</FormLabel><FormControl><Select items={{SELECT:"Select",TEXT:"Text",NUMBER:"Number",BOOLEAN:"Boolean"}} value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["SELECT","TEXT","NUMBER","BOOLEAN"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="displayOrder" render={({ field }) => <FormItem><FormLabel>Display order</FormLabel><FormControl><Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
      {form.watch("dataType") === "SELECT" && <FormField control={form.control} name="optionText" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Options</FormLabel><FormControl><Input placeholder="Leather, Canvas, Suede" {...field} value={field.value ?? ""} /></FormControl><p className="text-xs text-muted-foreground">Separate options with commas.</p><FormMessage /></FormItem>} />}
    </div><DialogFooter><DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="animate-spin" />}Save</Button></DialogFooter></form></Form></DialogContent></Dialog>
    <ConfirmDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} title="Remove attribute?" description={`Remove ${deleting?.name ?? "this attribute"}? Existing variant values remain for historical records.`} confirmLabel="Remove" onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} isPending={deleteMutation.isPending} />
  </Card>;
}
