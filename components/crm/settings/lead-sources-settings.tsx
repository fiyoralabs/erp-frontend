"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ActiveBadge } from "@/components/shared/active-badge";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { leadSourceSchema, type LeadSourceFormValues } from "@/lib/validation/crm";
import type { LeadSource } from "@/lib/types/crm";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function LeadSourcesSettings() {
  const qc = useQueryClient();
  const [dialogState, setDialogState] = React.useState<{ mode: "create" } | { mode: "edit"; row: LeadSource } | null>(null);

  const listQuery = useQuery({
    queryKey: ["crm", "lead-sources"],
    queryFn: () => apiClient.get<LeadSource[]>("crm/settings/lead-sources"),
  });

  const form = useForm<LeadSourceFormValues>({ resolver: zodResolver(leadSourceSchema), defaultValues: { code: "", name: "", active: true } });

  React.useEffect(() => {
    if (!dialogState) return;
    form.reset(dialogState.mode === "edit" ? { code: dialogState.row.code, name: dialogState.row.name, active: dialogState.row.active } : { code: "", name: "", active: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogState]);

  const saveMutation = useMutation({
    mutationFn: (values: LeadSourceFormValues) => dialogState?.mode === "edit"
      ? apiClient.put<LeadSource>(`crm/settings/lead-sources/${dialogState.row.id}`, values)
      : apiClient.post<LeadSource>("crm/settings/lead-sources", values),
    onSuccess: () => {
      toast.success("Lead source saved.");
      qc.invalidateQueries({ queryKey: ["crm", "lead-sources"] });
      setDialogState(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`crm/settings/lead-sources/${id}`),
    onSuccess: () => {
      toast.success("Lead source deactivated.");
      qc.invalidateQueries({ queryKey: ["crm", "lead-sources"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: DataTableColumn<LeadSource>[] = [
    { key: "code", header: "Code", render: (r) => r.code },
    { key: "name", header: "Name", render: (r) => r.name },
    { key: "system", header: "System", render: (r) => (r.system ? "Yes" : "No") },
    { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.active} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="size-4" /> Add Lead Source
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={listQuery.data ?? []}
        rowKey={(r) => r.id}
        isLoading={listQuery.isLoading}
        emptyMessage="No lead sources configured."
        actions={(row) => (
          <>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialogState({ mode: "edit", row })} aria-label="Edit"><Pencil className="size-4" /></Button>
            {row.active && !row.system && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deactivateMutation.mutate(row.id)}>Deactivate</Button>
            )}
          </>
        )}
      />

      <Dialog open={dialogState !== null} onOpenChange={(o) => !o && setDialogState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState?.mode === "edit" ? "Edit Lead Source" : "Add Lead Source"}</DialogTitle>
            <DialogDescription>Custom lead sources appear in the Lead form&apos;s Source dropdown.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-4">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={form.watch("active")} onCheckedChange={(v) => form.setValue("active", !!v)} />
                Active
              </label>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
