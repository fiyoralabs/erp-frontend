"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries, useQuery, useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, Filter, LayoutGrid, List, Package, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ActiveBadge } from "@/components/shared/active-badge";
import { apiClient, type PagedResult } from "@/lib/api-client";
import { categoryAndDescendantIds, categoryHierarchy } from "@/lib/category-hierarchy";
import type { Brand, CategoryAttribute } from "@/lib/types/master";
import type { ProductSummary } from "@/lib/types/product";
import { SetsManagementClient } from "@/components/products/sets-management-client";
import { useCategoriesLookup, usePriceListsLookup } from "@/lib/hooks/use-master-data";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function ProductsListClient({ companyId: _companyId }: { companyId: number }) {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = React.useState(true);
  const [sort, setSort] = React.useState("name,asc");
  const [categoryId, setCategoryId] = React.useState("");
  const [brandIds, setBrandIds] = React.useState<Set<number>>(new Set());
  const [priceListId, setPriceListId] = React.useState("");
  const [minPrice, setMinPrice] = React.useState("");
  const [maxPrice, setMaxPrice] = React.useState("");
  const [attributes, setAttributes] = React.useState<Set<string>>(new Set());
  const [deleteTargetProduct, setDeleteTargetProduct] = React.useState<{ id: number; name: string } | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const categories = useCategoriesLookup();
  const priceLists = usePriceListsLookup();
  const relevantCategoryIds = categoryId
    ? categoryAndDescendantIds(categories.data?.content ?? [], Number(categoryId))
    : [];
  const categoryAttributeQueries = useQueries({ queries: relevantCategoryIds.map((id) => ({
    queryKey: ["master", "categories", String(id), "filter-attributes"],
    queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${id}/attributes`),
  })) });

  React.useEffect(() => { setAttributes(new Set()); }, [categoryId]);
  React.useEffect(() => { setPage(0); }, [debouncedSearch, categoryId, brandIds, priceListId, minPrice, maxPrice, attributes, sort]);

  const params = React.useMemo(() => {
    const value = new URLSearchParams({ page: String(page), size: "20", sort });
    if (debouncedSearch) value.set("search", debouncedSearch);
    if (categoryId) value.set("categoryId", categoryId);
    for (const id of [...brandIds].sort((a, b) => a - b)) value.append("brandId", String(id));
    if (priceListId) value.set("priceListId", priceListId);
    if (minPrice) value.set("minPrice", minPrice);
    if (maxPrice) value.set("maxPrice", maxPrice);
    for (const attribute of [...attributes].sort()) value.append("attribute", attribute);
    return value.toString();
  }, [page, debouncedSearch, categoryId, brandIds, priceListId, minPrice, maxPrice, attributes, sort]);

  const query = useQuery({
    queryKey: ["products", "search", params],
    queryFn: () => apiClient.get<PagedResult<ProductSummary>>(`products?${params}`),
  });
  const categoryOptions = categoryHierarchy(categories.data?.content ?? []);
  const activePriceLists = (priceLists.data?.content ?? []).filter((list) => list.isActive);
  const filterAttributes = React.useMemo(() => {
    const byId = new Map<number, CategoryAttribute>();
    for (const result of categoryAttributeQueries) for (const attribute of result.data ?? []) {
      if ((attribute.filterable || attribute.variant) && !byId.has(attribute.id)) byId.set(attribute.id, attribute);
    }
    return [...byId.values()].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }, [categoryAttributeQueries]);
  const activeFilterCount = (categoryId ? 1 : 0) + brandIds.size + (priceListId ? 1 : 0) + (minPrice || maxPrice ? 1 : 0) + attributes.size;

  function toggleBrand(id: number) {
    setBrandIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleAttribute(id: number, value: string) {
    const key = `${id}:${value}`;
    setAttributes((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  function clearFilters() {
    setCategoryId(""); setBrandIds(new Set()); setPriceListId(""); setMinPrice(""); setMaxPrice(""); setAttributes(new Set());
  }

  const columns: DataTableColumn<ProductSummary>[] = [
    { key: "image", header: "", render: (row) => <ProductPhoto product={row} compact /> },
    { key: "code", header: "Code", render: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: "name", header: "Product", render: (row) => row.name },
    { key: "category", header: "Category", render: (row) => row.categoryName ?? "—" },
    { key: "brand", header: "Brand", render: (row) => row.brandName ?? "—" },
    { key: "type", header: "Catalog type", render: (row) => (row as any).productType === "SET" ? <Badge variant="default">Set Product</Badge> : row.hasVariants ? <Badge variant="outline">Variants</Badge> : "Simple" },
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
  ];
  const products = query.data?.content ?? [];
  const filterContent = (
    <div className="space-y-5">
      <FilterField label="Category">
        <CategoryPicker options={categoryOptions} value={categoryId} onChange={setCategoryId}/>
        <p className="text-xs text-muted-foreground">Includes every subcategory below the selection.</p>
      </FilterField>
      <FilterField label="Brands">
        <BrandPicker selected={brandIds} onToggle={toggleBrand}/>
      </FilterField>
      <FilterField label="Price list">
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={priceListId} onChange={(event) => setPriceListId(event.target.value)}>
          <option value="">Any price list</option>
          {activePriceLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
      </FilterField>
      <div className="grid grid-cols-2 gap-2">
        <FilterField label="Min price">
          <Input type="number" min="0" step="0.01" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="0.00" />
        </FilterField>
        <FilterField label="Max price">
          <Input type="number" min="0" step="0.01" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Any" />
        </FilterField>
      </div>
      {categoryId && (
        <div className="space-y-4 border-t pt-4">
          <div>
            <p className="text-sm font-medium">Attributes</p>
            <p className="text-xs text-muted-foreground">From this category and its subcategories. All selected filters must match.</p>
          </div>
          {categoryAttributeQueries.some((result) => result.isLoading) ? (
            <p className="text-sm text-muted-foreground">Loading attributes…</p>
          ) : filterAttributes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No filterable attributes.</p>
          ) : (
            filterAttributes.map((attribute) => (
              <FilterGroup key={attribute.id} label={attribute.name}>
                {attribute.options.filter((option) => option.isActive).map((option) => (
                  <CheckOption key={option.id} checked={attributes.has(`${attribute.id}:${option.value}`)} onChange={() => toggleAttribute(attribute.id, option.value)}>
                    {option.value}
                  </CheckOption>
                ))}
              </FilterGroup>
            ))
          )}
        </div>
      )}
      <Button className="w-full" variant="outline" onClick={clearFilters} disabled={activeFilterCount === 0}>
        <X className="mr-1 size-4" />Clear filters
      </Button>
    </div>
  );

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`products/${id}`),
    onSuccess: () => {
      toast.success("Product deleted successfully");
      query.refetch();
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete product"),
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">Find and manage sellable items, variants, pricing, media and labels.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/products/new" />}>
          <Plus className="mr-1 size-4" />Create product
        </Button>
      </div>

      <div className={desktopFiltersOpen ? "grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]" : "grid gap-5"}>
        {/* Desktop Filter Sidebar */}
        {desktopFiltersOpen && (
          <aside className="hidden h-fit rounded-xl border bg-card p-4 lg:block">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Filters</h2>
                {activeFilterCount > 0 && <Badge>{activeFilterCount}</Badge>}
              </div>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Hide filters" title="Hide filters" onClick={() => setDesktopFiltersOpen(false)}>
                <ChevronLeft />
              </Button>
            </div>
            {filterContent}
          </aside>
        )}

        <div className="min-w-0 space-y-4">
          {/* Toolbar: Responsive Layout for Mobile & Desktop */}
          <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, codes, SKUs or barcodes"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button className="h-9 text-xs px-2.5 shrink-0 lg:hidden" variant="outline" onClick={() => setMobileFiltersOpen(true)}>
                <Filter className="mr-1 size-3.5" />
                Filters
                {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{activeFilterCount}</Badge>}
              </Button>
              {!desktopFiltersOpen && (
                <div className="hidden lg:block">
                  <Button variant="outline" onClick={() => setDesktopFiltersOpen(true)}>
                    <Filter className="mr-1 size-4" />Show filters{activeFilterCount > 0 && <Badge className="ml-1">{activeFilterCount}</Badge>}
                  </Button>
                </div>
              )}
              <select
                aria-label="Sort products"
                className="h-9 rounded-lg border bg-background px-2.5 text-xs font-medium flex-1 min-w-0 sm:flex-none sm:w-40 sm:text-sm"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="name,asc">Name: A to Z</option>
                <option value="name,desc">Name: Z to A</option>
                <option value="createdAt,desc">Newest first</option>
                <option value="createdAt,asc">Oldest first</option>
                <option value="code,asc">Product code</option>
              </select>
              <div className="flex rounded-lg border p-0.5 shrink-0 h-9 items-center">
                <Button size="icon-sm" variant={view === "grid" ? "secondary" : "ghost"} aria-label="Grid view" onClick={() => setView("grid")}>
                  <LayoutGrid className="size-4" />
                </Button>
                <Button size="icon-sm" variant={view === "list" ? "secondary" : "ghost"} aria-label="List view" onClick={() => setView("list")}>
                  <List className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Product Listing */}
          {query.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-44 sm:h-72 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              No active products match these filters.
            </div>
          ) : (
            <>
              {/* Mobile Card View (renders on screens <640px) */}
              <div className="flex flex-col gap-3 sm:hidden">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden border border-border/60 bg-card shadow-xs transition hover:shadow-sm">
                    <div className="flex p-3 gap-3 items-start">
                      {/* Thumbnail Photo */}
                      <Link href={`/products/${product.id}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/40">
                        {product.primaryImageUrl ? (
                          <img src={product.primaryImageUrl} alt={product.name} className="size-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground/50">
                            <Package className="size-8" />
                          </div>
                        )}
                      </Link>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-mono text-[11px] font-medium text-muted-foreground truncate">
                            {product.code}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <ActiveBadge isActive={product.isActive} className="text-[10px] px-1.5 py-0" />
                            {(product as any).productType === "SET" ? (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">Set</Badge>
                            ) : product.hasVariants ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Variants</Badge>
                            ) : null}
                          </div>
                        </div>

                        <Link href={`/products/${product.id}`} className="block">
                          <h3 className="font-heading text-sm font-semibold text-foreground line-clamp-2 leading-snug hover:text-primary transition-colors">
                            {product.name}
                          </h3>
                        </Link>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground pt-0.5">
                          {product.categoryName && (
                            <span className="truncate max-w-[130px] text-[#545f73] dark:text-[#a3cfcf]">
                              {product.categoryName}
                            </span>
                          )}
                          {product.categoryName && product.brandName && (
                            <span className="text-muted-foreground/40">•</span>
                          )}
                          {product.brandName && (
                            <span className="truncate max-w-[110px] font-medium text-foreground/80">
                              {product.brandName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-medium" nativeButton={false} render={<Link href={`/products/${product.id}`} />}>
                          View
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-medium" nativeButton={false} render={<Link href={`/products/${product.id}/edit`} />}>
                          Edit
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label="Delete product"
                        onClick={() => setDeleteTargetProduct({ id: product.id, name: product.name })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop / Tablet View (renders on screens >=640px) */}
              <div className="hidden sm:block">
                {view === "list" ? (
                  <DataTable
                    columns={columns}
                    data={products}
                    rowKey={(row) => row.id}
                    isLoading={query.isLoading}
                    emptyMessage="No active products match these filters."
                    page={page}
                    totalPages={query.data?.totalPages}
                    onPageChange={setPage}
                    actions={(row) => (
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/products/${row.id}`} />}>View</Button>
                        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/products/${row.id}/edit`} />}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTargetProduct({ id: row.id, name: row.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {products.map((product) => (
                      <Card key={product.id} className="group overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">
                        <Link href={`/products/${product.id}`} className="block">
                          <ProductPhoto product={product} />
                          <CardContent className="space-y-2 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h2 className="truncate font-semibold">{product.name}</h2>
                                <p className="truncate font-mono text-xs text-muted-foreground">{product.code}</p>
                              </div>
                              {(product as any).productType === "SET" ? (
                                <Badge variant="default">Set Product</Badge>
                              ) : product.hasVariants && (
                                <Badge variant="outline">Variants</Badge>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{product.categoryName ?? "Uncategorized"}</span>
                              <span className="truncate">{product.brandName ?? "No brand"}</span>
                            </div>
                          </CardContent>
                        </Link>
                        <div className="flex border-t">
                          <Button className="flex-1 rounded-none" variant="ghost" nativeButton={false} render={<Link href={`/products/${product.id}`} />}>View</Button>
                          <Button className="flex-1 rounded-none border-l" variant="ghost" nativeButton={false} render={<Link href={`/products/${product.id}/edit`} />}>Edit</Button>
                          <Button className="rounded-none border-l text-destructive hover:text-destructive" variant="ghost" size="icon" onClick={() => setDeleteTargetProduct({ id: product.id, name: product.name })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button>
            <span className="text-xs sm:text-sm text-muted-foreground">Page {page + 1} of {Math.max(1, query.data?.totalPages ?? 1)}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= (query.data?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Next</Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteTargetProduct}
        onOpenChange={(open) => !open && setDeleteTargetProduct(null)}
        title="Delete Product?"
        description={`Are you sure you want to delete "${deleteTargetProduct?.name}"? This action will remove the product from your active catalog.`}
        confirmText="Delete Product"
        variant="destructive"
        isLoading={deleteProductMutation.isPending}
        onConfirm={() => {
          if (deleteTargetProduct) {
            deleteProductMutation.mutate(deleteTargetProduct.id);
          }
        }}
      />
      <div className="mt-8 border-t pt-6">
        <SetsManagementClient />
      </div>
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}><SheetContent side="left" className="w-[85vw] max-w-[340px] overflow-y-auto sm:max-w-sm"><SheetHeader><SheetTitle>Filter products</SheetTitle><SheetDescription>All selected filters must match.</SheetDescription></SheetHeader><div className="px-4 pb-6">{filterContent}</div></SheetContent></Sheet>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}</label>; }
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><p className="text-sm font-medium">{label}</p><div className="flex flex-wrap gap-2">{children}</div></div>; }
function CheckOption({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) { return <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm hover:bg-muted"><Checkbox checked={checked} onCheckedChange={onChange}/>{children}</label>; }
function CategoryPicker({ options, value, onChange }: { options: ReturnType<typeof categoryHierarchy>; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find(({ category }) => String(category.id) === value);
  const visible = search.trim() ? options.filter(({ category }) => `${category.name} ${category.code}`.toLowerCase().includes(search.trim().toLowerCase())) : options;
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}><span className="truncate">{selected?.category.name ?? "All categories"}</span><ChevronDown /></PopoverTrigger><PopoverContent className="w-64 p-2" align="start"><div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-9 pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" autoFocus/></div><div className="max-h-56 overflow-y-auto"><button type="button" className="flex min-h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted" onClick={() => { onChange(""); setOpen(false); }}>All categories</button>{visible.map(({ category, depth }) => <button key={category.id} type="button" className={`flex min-h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted ${String(category.id) === value ? "bg-muted font-medium" : ""}`} style={{ paddingLeft: `${8 + depth * 18}px` }} onClick={() => { onChange(String(category.id)); setOpen(false); }}>{depth > 0 && <span className="mr-1 text-muted-foreground">↳</span>}{category.name}</button>)}{visible.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">No categories found.</p>}</div></PopoverContent></Popover>;
}
function BrandPicker({ selected, onToggle }: { selected: Set<number>; onToggle: (id: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const query = useQuery({
    queryKey: ["master", "brands", "picker", search, page],
    queryFn: () => { const params = new URLSearchParams({ page: String(page), size: "10" }); if (search) params.set("search", search); return apiClient.get<PagedResult<Brand>>(`master/brands?${params}`); },
    enabled: open,
  });
  function submitSearch(event: React.FormEvent) { event.preventDefault(); setPage(0); setSearch(draft.trim()); }
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}><span>{selected.size ? `${selected.size} brand${selected.size === 1 ? "" : "s"} selected` : "All brands"}</span><ChevronDown /></PopoverTrigger><PopoverContent className="w-64 p-2" align="start"><form className="relative" onSubmit={submitSearch}><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-9 pl-8 pr-12" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search brands"/><Button type="submit" size="sm" variant="ghost" className="absolute right-0 top-0 h-9 px-2 text-xs">Go</Button></form><div className="max-h-56 space-y-1 overflow-y-auto">{query.isLoading ? <p className="p-3 text-sm text-muted-foreground">Loading brands…</p> : (query.data?.content ?? []).filter((brand) => brand.isActive).length === 0 ? <p className="p-3 text-sm text-muted-foreground">No active brands found.</p> : (query.data?.content ?? []).filter((brand) => brand.isActive).map((brand) => <label key={brand.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted"><Checkbox checked={selected.has(brand.id)} onCheckedChange={() => onToggle(brand.id)}/><span className="min-w-0 flex-1 truncate">{brand.name}</span></label>)}</div><div className="flex items-center justify-between border-t pt-1"><Button type="button" size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Prev</Button><span className="text-xs text-muted-foreground">{page + 1}/{Math.max(1, query.data?.totalPages ?? 1)}</span><Button type="button" size="sm" variant="ghost" disabled={page + 1 >= (query.data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button></div></PopoverContent></Popover>;
}
function ProductPhoto({ product, compact = false }: { product: ProductSummary; compact?: boolean }) { return <div className={compact ? "flex size-12 items-center justify-center overflow-hidden rounded-lg bg-muted" : "flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted"}>{product.primaryImageUrl ? <img src={product.primaryImageUrl} alt={product.name} className="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy"/> : <Package className={compact ? "size-5 text-muted-foreground" : "size-12 text-muted-foreground/50"}/>}</div>; }
