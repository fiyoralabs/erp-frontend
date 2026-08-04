"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronsDownUp, ChevronsUpDown, Loader2, Plus } from "lucide-react";

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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CategoryTree } from "@/components/master/category-tree";
import { buildTree, collectAllIds, collectDescendantIds, filterTree } from "@/lib/tree";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { categorySchema, type CategoryFormValues } from "@/lib/validation/master";
import type { Category } from "@/lib/types/master";

const NO_PARENT = "__none__";

const emptyValues: CategoryFormValues = {
  code: "",
  name: "",
  parentCategoryId: null,
  displayOrder: 0,
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [dialogState, setDialogState] = React.useState<
    { mode: "create"; parent: Category | null } | { mode: "edit"; row: Category } | null
  >(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);

  // erp's GET /master/categories has no hierarchy-aware listing (the
  // separate /categories/tree endpoint returns a differently-shaped,
  // display-only tree without ids needed for edit/delete actions) -- so we
  // fetch the flat paginated list and build the parent/child tree
  // ourselves, same approach as Locations.
  const listQuery = useQuery({
    queryKey: ["master", "categories", "all"],
    queryFn: () => apiClient.get<PagedResult<Category>>("master/categories?page=0&size=100"),
  });

  const allCategories = (listQuery.data?.content ?? []).filter((category) => category.isActive);

  const tree = React.useMemo(
    () =>
      buildTree(allCategories, (c) => c.parentCategoryId, (a, b) => a.name.localeCompare(b.name)),
    [allCategories]
  );

  const visibleTree = filterTree(tree, () => true);

  React.useEffect(() => {
    if (!hasAutoExpanded && allCategories.length > 0) {
      setExpandedIds(new Set(collectAllIds(tree)));
      setHasAutoExpanded(true);
    }
  }, [hasAutoExpanded, allCategories.length, tree]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyValues,
  });

  React.useEffect(() => {
    if (!dialogState) return;
    if (dialogState.mode === "edit") {
      const row = dialogState.row;
      form.reset({
        code: row.code,
        name: row.name,
        parentCategoryId: row.parentCategoryId,
        displayOrder: row.displayOrder,
        isActive: row.isActive,
      });
    } else {
      form.reset({ ...emptyValues, parentCategoryId: dialogState.parent?.id ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogState]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["master", "categories"] });
  }

  const createMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      apiClient.post<Category>("master/categories", values),
    onSuccess: (created) => {
      toast.success("Category created");
      invalidate();
      setDialogState(null);
      if (created.parentCategoryId != null) {
        setExpandedIds((prev) => new Set(prev).add(created.parentCategoryId as number));
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: CategoryFormValues }) =>
      apiClient.put<Category>(`master/categories/${id}`, values),
    onSuccess: () => {
      toast.success("Category updated");
      invalidate();
      setDialogState(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // erp's DELETE is a soft delete (confirmed in source --
  // CategoryServiceImpl.deleteCategory only does category.setIsActive(false),
  // no hard-delete endpoint exists), so this doubles as "deactivate".
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete<void>(`master/categories/${id}`),
    onSuccess: () => {
      toast.success("Category deactivated");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (category: Category) =>
      apiClient.put<Category>(`master/categories/${category.id}`, {
        name: category.name,
        isActive: true,
      }),
    onSuccess: () => {
      toast.success("Category reactivated");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function onSubmit(values: CategoryFormValues) {
    if (dialogState?.mode === "edit") {
      updateMutation.mutate({ id: dialogState.row.id, values });
      return;
    }
    createMutation.mutate(values);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  // A category can't be its own parent, or moved under one of its own
  // descendants (that would create a cycle).
  const editingId = dialogState?.mode === "edit" ? dialogState.row.id : null;
  const excludedParentIds = React.useMemo(() => {
    if (editingId == null) return new Set<number>();
    return collectDescendantIds(allCategories, (c) => c.parentCategoryId, editingId);
  }, [editingId, allCategories]);

  const parentOptions = allCategories.filter((c) => !excludedParentIds.has(c.id));
  // Select.Value only shows the item's label instead of the raw id when
  // Select.Root gets this `items` map -- see products-list-client.tsx.
  const parentItems = {
    [NO_PARENT]: "None (top-level)",
    ...Object.fromEntries(parentOptions.map((c) => [String(c.id), `${c.name} (${c.code})`])),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Product categories, organized by parent/subcategory hierarchy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setExpandedIds(new Set(collectAllIds(tree)))}
          >
            <ChevronsUpDown className="size-4" />
            Expand all
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setExpandedIds(new Set())}
          >
            <ChevronsDownUp className="size-4" />
            Collapse all
          </Button>
          <Button
            className="h-11 gap-1.5 sm:h-8"
            onClick={() => setDialogState({ mode: "create", parent: null })}
          >
            <Plus className="size-4" />
            Add category
          </Button>
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading categories...</p>
      ) : visibleTree.length === 0 ? (
        <p className="rounded-xl py-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No categories yet.
        </p>
      ) : (
        <CategoryTree
          nodes={visibleTree}
          expandedIds={expandedIds}
          onToggle={toggleExpanded}
          onEdit={(row) => setDialogState({ mode: "edit", row })}
          onAddChild={(parent) => setDialogState({ mode: "create", parent })}
          onDelete={setDeleteTarget}
          onReactivate={(cat) => reactivateMutation.mutate(cat)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Deactivate category?"
        description={`erp doesn't support permanently deleting a category (products may reference it) -- this deactivates "${deleteTarget?.name ?? ""}" instead. You can reactivate it anytime with the "Reactivate" button that appears on inactive categories.`}
        confirmLabel="Deactivate"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState?.mode === "edit" ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>
              {dialogState?.mode === "edit"
                ? "Update this category's details."
                : dialogState?.mode === "create" && dialogState.parent
                ? `Create a new subcategory under "${dialogState.parent.name}".`
                : "Create a new top-level category."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ELEC"
                          {...field}
                          disabled={dialogState?.mode === "edit"}
                        />
                      </FormControl>
                      {/* erp's UpdateCategoryRequest has no `code` field --
                          it's permanent once set. Editing it here would
                          silently do nothing on save (confirmed live), so
                          it's locked instead of misleadingly editable. */}
                      {dialogState?.mode === "edit" && (
                        <p className="text-xs text-muted-foreground">
                          Code can&apos;t be changed after creation.
                        </p>
                      )}
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
                        <Input placeholder="Electronics" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parentCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Category</FormLabel>
                      <FormControl>
                        <Select
                          items={parentItems}
                          value={field.value == null ? NO_PARENT : String(field.value)}
                          onValueChange={(value) =>
                            field.onChange(value === NO_PARENT || !value ? null : Number(value))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PARENT}>None (top-level)</SelectItem>
                            {parentOptions.map((cat) => (
                              <SelectItem key={cat.id} value={String(cat.id)}>
                                {cat.name} ({cat.code})
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
                  name="displayOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {dialogState?.mode === "edit" && (
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormControl>
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            Active
                          </label>
                        </FormControl>
                        <p className="pl-6 text-xs text-muted-foreground">
                          Uncheck to deactivate this category. Check to reactivate a previously
                          deactivated one.
                        </p>
                      </FormItem>
                    )}
                  />
                )}
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
    </div>
  );
}
