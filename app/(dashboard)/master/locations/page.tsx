"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronsDownUp, ChevronsUpDown, MessageSquare, Plus, Loader2, Search } from "lucide-react";

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
import { ComboboxField } from "@/components/shared/combobox-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { WhatsAppConfigDialog } from "@/components/settings/whatsapp-config-dialog";
import {
  buildLocationTree,
  collectAllIds,
  filterLocationTree,
  LocationTree,
} from "@/components/master/location-tree";
import { collectDescendantIds } from "@/lib/tree";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { usePriceListsLookup } from "@/lib/hooks/use-master-data";
import { locationSchema, type LocationFormValues } from "@/lib/validation/master";
import type { Location, LocationType } from "@/lib/types/master";

const LOCATION_TYPES: LocationType[] = ["STORE", "WAREHOUSE", "OFFICE", "KITCHEN", "OUTLET"];
const NO_PARENT = "__none__";

const emptyValues: LocationFormValues = {
  code: "",
  name: "",
  type: "STORE",
  parentId: null,
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  gstin: "",
  isDefault: false,
  priceLists: [],
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export default function LocationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [cityFilter, setCityFilter] = React.useState<string>("ALL");
  const [dialogState, setDialogState] = React.useState<
    { mode: "create"; parent: Location | null } | { mode: "edit"; row: Location } | null
  >(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Location | null>(null);
  const [isWaConfigOpen, setIsWaConfigOpen] = React.useState(false);

  // erp's GET /master/locations has no `city` filter and no dedicated
  // "flat list with hierarchy" endpoint -- Master Data lists realistically
  // stay well under 100 rows per company, so we fetch everything once and
  // build the parent/child tree plus do city filtering client-side.
  const listQuery = useQuery({
    queryKey: ["master", "locations", "all"],
    queryFn: () => apiClient.get<PagedResult<Location>>("master/locations?page=0&size=100"),
  });

  const priceListsQuery = usePriceListsLookup();

  const allLocations = (listQuery.data?.content ?? []).filter((location) => location.isActive);

  const cityOptions = React.useMemo(() => {
    const cities = allLocations
      .map((loc) => loc.city)
      .filter((city): city is string => !!city && city.trim().length > 0);
    return Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b));
  }, [allLocations]);

  const tree = React.useMemo(() => buildLocationTree(allLocations), [allLocations]);

  const visibleTree = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterLocationTree(tree, (loc) => {
      if (typeFilter !== "ALL" && loc.type !== typeFilter) return false;
      if (cityFilter !== "ALL" && loc.city !== cityFilter) return false;
      if (q && !loc.name.toLowerCase().includes(q) && !loc.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tree, typeFilter, cityFilter, search]);

  // Expand every node by default the first time real data arrives, so the
  // hierarchy is visible immediately rather than requiring manual expansion.
  React.useEffect(() => {
    if (!hasAutoExpanded && allLocations.length > 0) {
      setExpandedIds(new Set(collectAllIds(tree)));
      setHasAutoExpanded(true);
    }
  }, [hasAutoExpanded, allLocations.length, tree]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: emptyValues,
  });

  React.useEffect(() => {
    if (!dialogState) return;
    if (dialogState.mode === "edit") {
      const row = dialogState.row;
      form.reset({
        code: row.code,
        name: row.name,
        type: row.type,
        parentId: row.parentId,
        phone: row.phone ?? "",
        address: row.address ?? "",
        city: row.city ?? "",
        state: row.state ?? "",
        country: row.country ?? "",
        postalCode: row.postalCode ?? "",
        gstin: row.gstin ?? "",
        isDefault: row.isDefault,
        isActive: row.isActive,
        priceLists: undefined,
      });
    } else {
      form.reset({ ...emptyValues, parentId: dialogState.parent?.id ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogState]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["master", "locations"] });
  }

  const createMutation = useMutation({
    mutationFn: (values: LocationFormValues) =>
      apiClient.post<Location>("master/locations", values),
    onSuccess: (created) => {
      toast.success("Location created");
      invalidate();
      setDialogState(null);
      if (created.parentId != null) {
        setExpandedIds((prev) => new Set(prev).add(created.parentId as number));
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: LocationFormValues }) => {
      const { priceLists: _priceLists, ...locationValues } = values;
      return apiClient.put<Location>(`master/locations/${id}`, locationValues);
    },
    onSuccess: () => {
      toast.success("Location updated");
      invalidate();
      setDialogState(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // erp's DELETE is a soft delete (confirmed in source --
  // LocationServiceImpl.deleteLocation only does location.setIsActive(false),
  // there is no hard-delete/row-removal endpoint for Locations at all), so
  // this doubles as "deactivate". Un-deleting is a plain PUT with
  // isActive: true -- there's no separate "undelete" endpoint either, and
  // erp's partial-update semantics mean sending just {name, isActive} here
  // doesn't clobber the location's other fields (verified live).
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete<void>(`master/locations/${id}`),
    onSuccess: () => {
      toast.success("Location deactivated");
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleteTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (loc: Location) =>
      apiClient.put<Location>(`master/locations/${loc.id}`, { name: loc.name, isActive: true }),
    onSuccess: () => {
      toast.success("Location reactivated");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function onSubmit(values: LocationFormValues) {
    if (dialogState?.mode === "edit") {
      updateMutation.mutate({ id: dialogState.row.id, values });
      return;
    }

    const city = values.city?.trim();
    if (city && !cityOptions.includes(city)) {
      toast.info(`New city "${city}" is being added`);
    }
    createMutation.mutate(values);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const activePriceLists = (priceListsQuery.data?.content ?? []).filter((priceList) => priceList.isActive);

  // A location can't be its own parent, and (to avoid creating a cycle)
  // can't be moved under any of its own descendants either.
  const editingId = dialogState?.mode === "edit" ? dialogState.row.id : null;
  const excludedParentIds = React.useMemo(() => {
    if (editingId == null) return new Set<number>();
    return collectDescendantIds(allLocations, (loc) => loc.parentId, editingId);
  }, [editingId, allLocations]);

  const parentOptions = allLocations.filter((loc) => !excludedParentIds.has(loc.id));
  // Select.Value only shows the item's label instead of the raw id when
  // Select.Root gets this `items` map (confirmed live: without it the
  // trigger displayed the bare numeric id after picking a parent).
  const parentItems = {
    [NO_PARENT]: "None (top-level)",
    ...Object.fromEntries(parentOptions.map((loc) => [String(loc.id), `${loc.name} (${loc.code})`])),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#1a1c1c] dark:text-white sm:text-3xl">
            Locations
          </h1>
          <p className="mt-1 text-xs text-[#545f73] dark:text-[#a3cfcf] sm:text-sm">
            Stores and warehouses, organized by parent/child hierarchy. Each has its own POS
            configuration and allowed price lists.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 gap-1.5 rounded-xl border-emerald-200 text-emerald-600 dark:text-emerald-400 sm:h-9"
            onClick={() => setIsWaConfigOpen(true)}
          >
            <MessageSquare className="size-4" />
            WhatsApp Config
          </Button>
          <Button
            className="h-11 gap-1.5 rounded-xl bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90 sm:h-9"
            onClick={() => setDialogState({ mode: "create", parent: null })}
          >
            <Plus className="size-4" />
            Add location
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#717978]" />
          <Input
            placeholder="Search by name or code..."
            className="h-10 rounded-xl border-[#c0c8c8] bg-white pl-9 text-sm focus-visible:border-[#0F3D3E] focus-visible:ring-[#0F3D3E]/15 dark:border-[#717978] dark:bg-[#1a1c1c]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? "ALL")}>
            <SelectTrigger className="h-10 w-full rounded-xl border-[#c0c8c8] bg-white text-sm dark:border-[#717978] dark:bg-[#1a1c1c] sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {LOCATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={(value) => setCityFilter(value ?? "ALL")}>
            <SelectTrigger className="h-10 w-full rounded-xl border-[#c0c8c8] bg-white text-sm dark:border-[#717978] dark:bg-[#1a1c1c] sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All cities</SelectItem>
              {cityOptions.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 rounded-xl border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131]"
            onClick={() => setExpandedIds(new Set(collectAllIds(tree)))}
          >
            <ChevronsUpDown className="size-4" />
            Expand all
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 rounded-xl border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131]"
            onClick={() => setExpandedIds(new Set())}
          >
            <ChevronsDownUp className="size-4" />
            Collapse all
          </Button>
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-[#545f73] dark:text-[#a3cfcf]">Loading locations...</p>
      ) : visibleTree.length === 0 ? (
        <div className="rounded-2xl border border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c] py-10 text-center text-sm text-[#545f73] dark:text-[#a3cfcf]">
          No locations match this filter.
        </div>
      ) : (
        <LocationTree
          nodes={visibleTree}
          expandedIds={expandedIds}
          onToggle={toggleExpanded}
          onEdit={(row) => setDialogState({ mode: "edit", row })}
          onAddChild={(parent) => setDialogState({ mode: "create", parent })}
          onDelete={setDeleteTarget}
          onReactivate={(loc) => reactivateMutation.mutate(loc)}
        />
      )}

      <WhatsAppConfigDialog open={isWaConfigOpen} onOpenChange={setIsWaConfigOpen} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Deactivate location?"
        description={`erp doesn't support permanently deleting a location (historical transactions may reference it) -- this deactivates "${deleteTarget?.name ?? ""}" instead. It stays visible but can't be used in new transactions. You can reactivate it anytime with the "Reactivate" button that appears on inactive locations.`}
        confirmLabel="Deactivate"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogState?.mode === "edit" ? "Edit location" : "Add location"}</DialogTitle>
            <DialogDescription>
              {dialogState?.mode === "edit"
                ? "Update this location's details."
                : dialogState?.mode === "create" && dialogState.parent
                ? `Create a new location under "${dialogState.parent.name}".`
                : "Create a new store or warehouse."}
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
                          placeholder="HQ"
                          {...field}
                          disabled={dialogState?.mode === "edit"}
                        />
                      </FormControl>
                      {/* erp's UpdateLocationRequest has no `code` field --
                          it's permanent once set. Editing it here would
                          silently do nothing on save, so it's locked
                          instead of misleadingly editable. */}
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
                        <Input placeholder="Head Office" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LOCATION_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
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
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Location</FormLabel>
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
                            {parentOptions.map((loc) => (
                              <SelectItem key={loc.id} value={String(loc.id)}>
                                {loc.name} ({loc.code})
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <ComboboxField
                          id={field.name}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          options={cityOptions.map((city) => ({ value: city, label: city }))}
                          placeholder="Select an existing city or type a new one"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="29AAAAA0000A1Z5"
                          className="font-mono uppercase"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Printed on this store&apos;s sales invoices.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Only meaningful once a location already exists -- new
                    locations are always created active. This is also how a
                    deactivated (soft-deleted) location gets reactivated,
                    since erp has no separate "undelete" endpoint. */}
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
                          Uncheck to deactivate this location (same effect as the delete/trash
                          action). Check to reactivate a previously deactivated one.
                        </p>
                      </FormItem>
                    )}
                  />
                )}
                {dialogState?.mode === "create" && (
                  <FormField
                    control={form.control}
                    name="priceLists"
                    render={({ field }) => {
                      const assignments = field.value ?? [];
                      return (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Allowed price lists</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Select at least one price list and choose exactly one default.
                          </p>
                          <FormControl>
                            <div className="flex flex-col gap-2 rounded-lg border p-3">
                              {priceListsQuery.isLoading ? (
                                <p className="text-sm text-muted-foreground">Loading price lists...</p>
                              ) : activePriceLists.length === 0 ? (
                                <p className="text-sm text-destructive">
                                  Create an active price list before adding a location.
                                </p>
                              ) : activePriceLists.map((priceList) => {
                                const selected = assignments.some((item) => item.priceListId === priceList.id);
                                const isDefault = assignments.some(
                                  (item) => item.priceListId === priceList.id && item.isDefault
                                );
                                return (
                                  <div key={priceList.id} className="flex items-center gap-3">
                                    <Checkbox
                                      checked={selected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          const hasDefault = assignments.some((item) => item.isDefault);
                                          field.onChange([
                                            ...assignments,
                                            { priceListId: priceList.id, isDefault: !hasDefault },
                                          ]);
                                        } else {
                                          const remaining = assignments.filter(
                                            (item) => item.priceListId !== priceList.id
                                          );
                                          if (isDefault && remaining.length > 0) remaining[0].isDefault = true;
                                          field.onChange(remaining);
                                        }
                                      }}
                                    />
                                    <span className="flex-1 text-sm">
                                      {priceList.name} ({priceList.code})
                                    </span>
                                    {selected && (
                                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <input
                                          type="radio"
                                          name="new-location-default-price-list"
                                          checked={isDefault}
                                          onChange={() => field.onChange(assignments.map((item) => ({
                                            ...item,
                                            isDefault: item.priceListId === priceList.id,
                                          })))}
                                        />
                                        Default
                                      </label>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={saving || (dialogState?.mode === "create" && activePriceLists.length === 0)}
                >
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
