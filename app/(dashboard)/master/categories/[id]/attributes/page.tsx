"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Category, CategoryAttribute } from "@/lib/types/master";
import { categoryAttributeSchema, type CategoryAttributeFormValues } from "@/lib/validation/master";

const emptyValues: CategoryAttributeFormValues = {
  code: "", name: "", dataType: "SELECT", required: true, variant: true,
  filterable: true, displayOrder: 0, optionText: "",
};

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError || error instanceof Error) return error.message;
  return "Something went wrong";
}

export default function CategoryAttributesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<CategoryAttribute | "create" | null>(null);
  const [deleting, setDeleting] = React.useState<CategoryAttribute | null>(null);

  const categoryQuery = useQuery({ queryKey: ["master", "categories", id], queryFn: () => apiClient.get<Category>(`master/categories/${id}`) });
  const attributesQuery = useQuery({ queryKey: ["master", "categories", id, "attributes"], queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${id}/attributes`) });
  const form = useForm<CategoryAttributeFormValues>({ resolver: zodResolver(categoryAttributeSchema), defaultValues: emptyValues });

  React.useEffect(() => {
    if (!editing) return;
    form.reset(editing === "create" ? emptyValues : {
      code: editing.code ?? "", name: editing.name, dataType: editing.dataType,
      required: editing.required, variant: editing.variant, filterable: editing.filterable,
      displayOrder: editing.displayOrder,
      optionText: editing.options.filter((option) => option.isActive).map((option) => option.value).join(", "),
    });
  }, [editing, form]);

  const payload = (values: CategoryAttributeFormValues) => ({
    code: values.code || null, name: values.name, dataType: values.dataType,
    required: values.required, variant: values.variant, filterable: values.filterable,
    displayOrder: values.displayOrder,
    options: values.dataType === "SELECT" ? (values.optionText ?? "").split(",").map((value, index) => ({ value: value.trim(), displayOrder: index, isActive: true })).filter((option) => option.value) : [],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["master", "categories", id, "attributes"] });
  const saveMutation = useMutation({
    mutationFn: (values: CategoryAttributeFormValues) => editing === "create"
      ? apiClient.post<CategoryAttribute>(`master/categories/${id}/attributes`, payload(values))
      : apiClient.put<CategoryAttribute>(`master/categories/${id}/attributes/${editing!.id}`, payload(values)),
    onSuccess: () => { toast.success("Category attribute saved"); invalidate(); setEditing(null); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (attributeId: number) => apiClient.delete<void>(`master/categories/${id}/attributes/${attributeId}`),
    onSuccess: () => { toast.success("Attribute removed from category"); invalidate(); setDeleting(null); },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columns: DataTableColumn<CategoryAttribute>[] = [
    { key: "name", header: "Attribute", render: (row) => row.name },
    { key: "type", header: "Type", render: (row) => <Badge variant="outline">{row.dataType}</Badge> },
    { key: "options", header: "Options", render: (row) => row.options.filter((option) => option.isActive).map((option) => option.value).join(", ") || "—" },
    { key: "rules", header: "Rules", render: (row) => [row.required && "Required", row.variant && "Variant", row.filterable && "Filterable"].filter(Boolean).join(" · ") },
  ];

  return <div className="flex flex-col gap-4">
    <Button variant="ghost" className="w-fit gap-1.5 px-2" onClick={() => router.push("/master/categories")}><ArrowLeft className="size-4" />Back to categories</Button>
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-semibold sm:text-2xl">{categoryQuery.data?.name ?? "Category"} attributes</h1><p className="text-sm text-muted-foreground">Define options such as Color: Red, Black, Blue and Storage: 128GB, 256GB.</p></div><Button onClick={() => setEditing("create")}><Plus className="size-4" />Add attribute</Button></div>
    <DataTable columns={columns} data={attributesQuery.data ?? []} rowKey={(row) => row.id} isLoading={attributesQuery.isLoading} emptyMessage="No attributes yet." actions={(row) => <><Button variant="ghost" size="icon" onClick={() => setEditing(row)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(row)}><Trash2 className="size-4" /></Button></>} />
    <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>{editing === "create" ? "Add attribute" : "Edit attribute"}</DialogTitle><DialogDescription>SELECT attributes provide controlled values for variant generation.</DialogDescription></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="flex flex-col gap-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Color" {...field} /></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="COLOR" {...field} /></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="dataType" render={({ field }) => <FormItem><FormLabel>Data type</FormLabel><FormControl><Select items={{SELECT:"Select",TEXT:"Text",NUMBER:"Number",BOOLEAN:"Boolean"}} value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["SELECT","TEXT","NUMBER","BOOLEAN"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="displayOrder" render={({ field }) => <FormItem><FormLabel>Display order</FormLabel><FormControl><Input type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
      {form.watch("dataType") === "SELECT" && <FormField control={form.control} name="optionText" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Options</FormLabel><FormControl><Input placeholder="Red, Black, Blue" {...field} value={field.value ?? ""} /></FormControl><p className="text-xs text-muted-foreground">Separate options with commas.</p><FormMessage /></FormItem>} />}
      {(["required","variant","filterable"] as const).map((name) => <FormField key={name} control={form.control} name={name} render={({ field }) => <FormItem><FormControl><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={field.value} onCheckedChange={field.onChange} />{name[0].toUpperCase()+name.slice(1)}</label></FormControl></FormItem>} />)}
    </div><DialogFooter><DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="animate-spin" />}Save</Button></DialogFooter></form></Form></DialogContent></Dialog>
    <ConfirmDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} title="Remove attribute?" description={`Remove ${deleting?.name ?? "this attribute"} from the category? Existing variant values remain for historical records.`} confirmLabel="Remove" onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} isPending={deleteMutation.isPending} />
  </div>;
}
