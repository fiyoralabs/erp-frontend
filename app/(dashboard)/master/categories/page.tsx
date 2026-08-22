"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronsDownUp, ChevronsUpDown, Loader2, Plus, Search } from "lucide-react";

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
import { categoryHierarchy } from "@/lib/category-hierarchy";

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
  const [search, setSearch] = React.useState("");
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
    queryFn: () => apiClient.get<PagedResult<Category>>("master/categories?page=0&size=500"),
  });

  const allCategories = React.useMemo(
    () => (listQuery.data?.content ?? []).filter((category) => category.isActive),
    [listQuery.data?.content]
  );

  const tree = React.useMemo(
    () =>
      buildTree(allCategories, (c) => c.parentCategoryId, (a, b) => a.name.localeCompare(b.name)),
    [allCategories]
  );

  const allIds = React.useMemo(() => collectAllIds(tree), [tree]);

  const visibleTree = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filterTree(tree, () => true);
    return filterTree(tree, (cat) => cat.name.toLowerCase().includes(q) || cat.code.toLowerCase().includes(q));
  }, [tree, search]);

  React.useEffect(() => {
    if (!hasAutoExpanded && allCategories.length > 0) {
      setExpandedIds(new Set(allIds));
      setHasAutoExpanded(true);
    }
  }, [hasAutoExpanded, allCategories.length, allIds]);

  const toggleExpanded = React.useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExpandAll = React.useCallback(() => {
    setExpandedIds(new Set(allIds));
  }, [allIds]);

  const handleCollapseAll = React.useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const handleEdit = React.useCallback((row: Category) => {
    setDialogState({ mode: "edit", row });
  }, []);

  const handleAddChild = React.useCallback((parent: Category) => {
    setDialogState({ mode: "create", parent });
  }, []);

  const handleDelete = React.useCallback((category: Category) => {
    setDeleteTarget(category);
  }, []);

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

  const invalidate = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ["master", "categories"] });
  }, [qc]);

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

  const handleReactivate = React.useCallback(
    (cat: Category) => {
      reactivateMutation.mutate(cat);
    },
    [reactivateMutation]
  );

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

  const parentOptions = React.useMemo(
    () =>
      categoryHierarchy(allCategories).filter(
        ({ category }) => !excludedParentIds.has(category.id)
      ),
    [allCategories, excludedParentIds]
  );

  // Select.Value only shows the item's label instead of the raw id when
  // Select.Root gets this `items` map -- see products-list-client.tsx.
  const parentItems = React.useMemo(
    () => ({
      [NO_PARENT]: "None (top-level)",
      ...Object.fromEntries(
        parentOptions.map(({ category, label }) => [
          String(category.id),
          `${label} (${category.code})`,
        ])
      ),
    }),
    [parentOptions]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#1a1c1c] dark:text-white sm:text-3xl">
            Categories
          </h1>
          <p className="mt-1 text-xs text-[#545f73] dark:text-[#a3cfcf] sm:text-sm">
            Product categories, organized by parent/subcategory hierarchy.
          </p>
        </div>
        <Button
          className="h-11 gap-1.5 rounded-xl bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90 sm:h-9"
          onClick={() => setDialogState({ mode: "create", parent: null })}
        >
          <Plus className="size-4" />
          Add category
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#717978]" />
          <Input
            placeholder="Search by name or code..."
            className="h-10 rounded-xl border-[#c0c8c8] bg-white pl-9 text-sm focus-visible:border-[#0F3D3E] focus-visible:ring-[#0F3D3E]/15 dark:border-[#717978] dark:bg-[#1a1c1c]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 rounded-xl border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131]"
            onClick={handleExpandAll}
          >
            <ChevronsUpDown className="size-4" />
            Expand all
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 rounded-xl border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131]"
            onClick={handleCollapseAll}
          >
            <ChevronsDownUp className="size-4" />
            Collapse all
          </Button>
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-[#545f73] dark:text-[#a3cfcf]">Loading categories...</p>
      ) : visibleTree.length === 0 ? (
        <div className="rounded-2xl border border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c] py-10 text-center text-sm text-[#545f73] dark:text-[#a3cfcf]">
          {search ? `No categories match "${search}".` : "No categories yet."}
        </div>
      ) : (
        <CategoryTree
          nodes={visibleTree}
          expandedIds={expandedIds}
          onToggle={toggleExpanded}
          onEdit={handleEdit}
          onAddChild={handleAddChild}
          onDelete={handleDelete}
          onReactivate={handleReactivate}
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
                {/* Create mode: no Code field at all -- erp auto-generates it from the
                    name. Edit mode: shown read-only since UpdateCategoryRequest has no
                    `code` field (it's permanent once set; editing it here would silently
                    do nothing on save, confirmed live), so it's informational only. */}
                {dialogState?.mode === "edit" && (
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code</FormLabel>
                        <FormControl>
                          <Input placeholder="ELEC" {...field} disabled />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Code can&apos;t be changed after creation.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                            {parentOptions.map(({ category: cat, label }) => (
                              <SelectItem key={cat.id} value={String(cat.id)}>
                                {label} ({cat.code})
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
