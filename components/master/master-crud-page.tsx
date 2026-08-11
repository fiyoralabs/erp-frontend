"use client";

// Generic CRUD page for the 8 structurally-identical Master Data entities
// (Category/Brand/Unit/Tax/PaymentMethod/Reason/CustomerGroup/PriceList) --
// same POST/GET-paged/PUT/DELETE(soft) shape per erp's controllers, differing
// only in which fields they carry. Locations and Document Sequences are
// meaningfully different (extra sub-resources / no create-delete) and get
// their own hand-written pages instead of using this.

import * as React from "react";
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";

export interface CrudFieldConfig<TForm extends FieldValues> {
  name: Path<TForm>;
  label: string;
  type: "text" | "number" | "checkbox" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  step?: string;
  // erp's Update*Request DTOs never include a `code` field for any Master
  // Data entity (confirmed by grepping every UpdateXRequest.java in the
  // module) -- code is permanent once set. Editing it in the form silently
  // did nothing on save (the backend just ignores the field), which looked
  // exactly like "update is broken." Mark `code` fields with this so the
  // form is honest about it instead.
  disabledOnEdit?: boolean;
}

interface MasterCrudPageProps<
  TEntity extends { id: number; isActive: boolean },
  TForm extends FieldValues
> {
  title: string;
  description: string;
  apiPath: string; // e.g. "master/categories"
  queryKey: string;
  columns: DataTableColumn<TEntity>[];
  fields: CrudFieldConfig<TForm>[];
  schema: ZodType<TForm>;
  emptyValues: TForm;
  toFormValues: (row: TEntity) => TForm;
  entityLabel: string; // e.g. "category" -- used in confirm/toast copy
}

export function MasterCrudPage<
  TEntity extends { id: number; isActive: boolean },
  TForm extends FieldValues
>({
  title,
  description,
  apiPath,
  queryKey,
  columns,
  fields,
  schema,
  emptyValues,
  toFormValues,
  entityLabel,
}: MasterCrudPageProps<TEntity, TForm>) {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [dialogState, setDialogState] = React.useState<
    { mode: "create" } | { mode: "edit"; row: TEntity } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TEntity | null>(null);

  // Long staleTime is safe here: invalidate() below runs after every one of
  // this page's own mutations, so edits made on THIS screen are never
  // stale. It also lets this key double as the shared cache root for the
  // "lookup" queries other screens use to populate dropdowns (see
  // lib/hooks/use-master-data.ts) -- both share the ["master", queryKey]
  // prefix, so invalidating one refreshes the other too.
  const listQuery = useQuery({
    queryKey: ["master", queryKey, page],
    queryFn: () => apiClient.get<PagedResult<TEntity>>(`${apiPath}?page=${page}&size=20`),
    staleTime: 5 * 60_000,
  });

  // zod v4's inferred resolver generic, and react-hook-form's own
  // TFieldValues/TTransformedValues split, don't unify cleanly against a
  // generic `TForm extends FieldValues` type parameter -- functionally
  // correct at runtime (schema and TForm are always the matching pair for
  // a given entity page, enforced at each call site's explicit
  // MasterCrudPage<TEntity, TForm> instantiation), just needs an escape
  // hatch here to satisfy the compiler across the generic boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm({
    resolver: zodResolver(schema as any),
    defaultValues: emptyValues,
  } as any) as UseFormReturn<TForm>;

  React.useEffect(() => {
    if (!dialogState) return;
    form.reset(dialogState.mode === "edit" ? toFormValues(dialogState.row) : emptyValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogState]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["master", queryKey] });
  }

  const createMutation = useMutation({
    mutationFn: (values: TForm) => apiClient.post<TEntity>(apiPath, values),
    onSuccess: () => {
      toast.success(`${entityLabel} created`);
      invalidate();
      setDialogState(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: TForm }) =>
      apiClient.put<TEntity>(`${apiPath}/${id}`, values),
    onSuccess: () => {
      toast.success(`${entityLabel} updated`);
      invalidate();
      setDialogState(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete<void>(`${apiPath}/${id}`),
    onSuccess: () => {
      toast.success(`${entityLabel} deleted`);
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleteTarget(null);
    },
  });

  function onSubmit(values: TForm) {
    if (dialogState?.mode === "edit") {
      updateMutation.mutate({ id: dialogState.row.id, values });
    } else {
      createMutation.mutate(values);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const data = listQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="size-4" />
          Add {entityLabel}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(data?.content ?? []).filter((row) => row.isActive)}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        emptyMessage={`No ${entityLabel} records yet.`}
        page={page}
        totalPages={data?.totalPages}
        onPageChange={setPage}
        actions={(row) => (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 sm:size-8"
              aria-label={`Edit ${entityLabel}`}
              onClick={() => setDialogState({ mode: "edit", row })}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-destructive hover:text-destructive sm:size-8"
              aria-label={`Delete ${entityLabel}`}
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      />

      {listQuery.isError && (
        <p className="text-sm text-destructive">
          Failed to load {entityLabel} records: {errorMessage(listQuery.error)}
        </p>
      )}

      <Dialog
        open={dialogState !== null}
        onOpenChange={(open) => !open && setDialogState(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "edit" ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
            </DialogTitle>
            <DialogDescription>
              {dialogState?.mode === "edit"
                ? `Update this ${entityLabel}'s details.`
                : `Create a new ${entityLabel}.`}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fields.map((field) => {
                  const isDisabled = !!field.disabledOnEdit && dialogState?.mode === "edit";
                  return (
                    <FormField
                      key={field.name}
                      control={form.control}
                      name={field.name}
                      render={({ field: rhfField }) => (
                        <FormItem className={field.type === "checkbox" ? "sm:col-span-2" : undefined}>
                          {field.type !== "checkbox" && <FormLabel>{field.label}</FormLabel>}
                          <FormControl>
                            {field.type === "checkbox" ? (
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <Checkbox
                                  checked={!!rhfField.value}
                                  onCheckedChange={rhfField.onChange}
                                />
                                {field.label}
                              </label>
                            ) : field.type === "select" ? (
                              <Select
                                // Select.Value only shows the item's label
                                // instead of the raw value when Select.Root
                                // gets this `items` map (confirmed live).
                                items={Object.fromEntries(
                                  (field.options ?? []).map((opt) => [opt.value, opt.label])
                                )}
                                value={rhfField.value ?? ""}
                                onValueChange={rhfField.onChange}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options?.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : field.type === "number" ? (
                              <Input
                                type="number"
                                step={field.step ?? "1"}
                                placeholder={field.placeholder}
                                value={rhfField.value ?? ""}
                                disabled={isDisabled}
                                onChange={(e) =>
                                  rhfField.onChange(
                                    e.target.value === "" ? undefined : Number(e.target.value)
                                  )
                                }
                              />
                            ) : (
                              <Input
                                placeholder={field.placeholder}
                                {...rhfField}
                                value={rhfField.value ?? ""}
                                disabled={isDisabled}
                              />
                            )}
                          </FormControl>
                          {isDisabled && (
                            <p className="text-xs text-muted-foreground">
                              {field.label} can&apos;t be changed after creation.
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${entityLabel}?`}
        description={`This will deactivate "${deleteTarget ? getDisplayName(deleteTarget) : ""}". It can still be viewed but won't be usable in new transactions.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function getDisplayName(row: Record<string, unknown>): string {
  return (row.name as string) ?? (row.code as string) ?? String(row.id);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
