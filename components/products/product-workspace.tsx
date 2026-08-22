"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Check, ImagePlus, Loader2, PackagePlus, Plus, Sparkles, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import type { CategoryAttribute } from "@/lib/types/master";
import type { Product, Variant, Price, Barcode, ProductImage, ProductType } from "@/lib/types/product";
import { categoryHierarchy } from "@/lib/category-hierarchy";
import {
  useBrandsLookup,
  useCategoriesLookup,
  usePriceListsLookup,
  useTaxesLookup,
  useUnitsLookup,
} from "@/lib/hooks/use-master-data";

// A pickable variant group -- either a shared category attribute (groupKey
// "c:<id>") or a product-specific attribute defined inline on this form
// (groupKey "p:<clientKey>"). The product doesn't have an id yet at this point,
// so product-level attributes are tracked by a client-generated key instead of a
// real database id until the whole product is submitted.
type AttributeGroup = {
  groupKey: string;
  name: string;
  required: boolean;
  productLevel: boolean;
  attributeId: number | null;
  clientKey: string | null;
  options: { id: number | string; value: string; isActive: boolean }[];
};
type ProductAttributeDraft = { clientKey: string; name: string; optionText: string };
type Combination = { key: string; values: { groupKey: string; value: string }[]; sku: string; enabled: boolean };
type Money = { costPrice: string; sellingPrice: string; mrp: string };
type SetupResponse = { product: Product; variants: Variant[]; prices: Price[]; barcodes: Barcode[] };

export type SetColorEntry = {
  id: string;
  colour: string;
  setName: string;
  sku: string;
  barcode: string;
  costPrice: string;
  sellingPrice: string;
  mrp: string;
  openingSets: string;
  sizes: { size: string; qty: number }[];
};

const DEFAULT_SIZES = [
  { size: "S", qty: 1 },
  { size: "M", qty: 1 },
  { size: "L", qty: 1 },
  { size: "XL", qty: 1 },
  { size: "XXL", qty: 0 },
];

function skuPart(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cartesian(groups: { groupKey: string; values: string[] }[]) {
  if (!groups.length || groups.some((g) => !g.values.length)) return [];
  return groups.reduce<{ groupKey: string; value: string }[][]>(
    (rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, { groupKey: group.groupKey, value }])),
    [[]]
  );
}

export function ProductWorkspace({ companyId }: { companyId: number }) {
  const router = useRouter();

  // Product Selection Type
  const [productKind, setProductKind] = React.useState<"SIMPLE" | "VARIANT">("SIMPLE");

  const [form, setForm] = React.useState({
    code: "",
    name: "",
    description: "",
    categoryId: "",
    unitId: "",
    brandId: "",
    taxId: "",
    hasVariants: false,
    trackInventory: true,
    allowNegativeStock: false,
    isActive: true,
  });

  const [selected, setSelected] = React.useState<Record<string, Set<string>>>({});
  const [combinations, setCombinations] = React.useState<Combination[]>([]);
  const [prices, setPrices] = React.useState<Record<string, Money>>({});
  const [files, setFiles] = React.useState<File[]>([]);
  const [productAttributeDrafts, setProductAttributeDrafts] = React.useState<ProductAttributeDraft[]>([]);

  const categories = useCategoriesLookup();
  const units = useUnitsLookup();
  const brands = useBrandsLookup();
  const taxes = useTaxesLookup();
  const priceLists = usePriceListsLookup();
  const attributes = useQuery({
    queryKey: ["master", "categories", form.categoryId, "attributes"],
    enabled: !!form.categoryId && productKind === "VARIANT",
    queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${form.categoryId}/attributes`),
  });

  const categoryVariantAttributes = (attributes.data ?? []).filter((a) => a.variant);
  const attributeGroups: AttributeGroup[] = React.useMemo(() => [
    ...categoryVariantAttributes.map((a): AttributeGroup => ({
      groupKey: `c:${a.id}`, name: a.name, required: a.required, productLevel: false,
      attributeId: a.id, clientKey: null, options: a.options,
    })),
    ...productAttributeDrafts.filter((d) => d.name.trim()).map((d): AttributeGroup => ({
      groupKey: `p:${d.clientKey}`, name: d.name, required: false, productLevel: true,
      attributeId: null, clientKey: d.clientKey,
      options: d.optionText.split(",").map((v) => v.trim()).filter(Boolean).map((value, index) => ({ id: `${d.clientKey}-${index}`, value, isActive: true })),
    })),
  ], [categoryVariantAttributes, productAttributeDrafts]);
  const activePriceLists = (priceLists.data?.content ?? []).filter((p) => p.isActive);
  const categoryOptions = categoryHierarchy(categories.data?.content ?? []);

  // Pre-populate product code from query parameters on mount (barcode scan workflow)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("code") || params.get("barcode");
      if (codeParam) {
        setForm((f) => ({ ...f, code: codeParam.trim() }));
      }
    }
  }, []);

  // Update hasVariants flag based on productKind
  React.useEffect(() => {
    setForm((f) => ({ ...f, hasVariants: productKind !== "SIMPLE" }));
  }, [productKind]);

  React.useEffect(() => {
    setSelected({});
    setCombinations([]);
  }, [form.categoryId]);

  function generate() {
    const missing = attributeGroups.filter((a) => a.required && (selected[a.groupKey]?.size ?? 0) === 0);
    if (missing.length) {
      toast.error(`Select a value for required attribute: ${missing[0].name}`);
      return;
    }
    const groups = attributeGroups.map((a) => ({ groupKey: a.groupKey, values: Array.from(selected[a.groupKey] ?? []) })).filter((g) => g.values.length > 0);
    const rows = cartesian(groups);
    const next = rows.map((values) => {
      const key = values.map((v) => `${v.groupKey}:${v.value}`).join("|");
      return {
        key,
        values,
        sku: [form.code || "SKU", ...values.map((v) => skuPart(v.value))].join("-"),
        enabled: combinations.find((c) => c.key === key)?.enabled ?? true,
      };
    });
    setCombinations(next);
    toast.success(`${next.length} combinations prepared`);
  }

  function moneyKey(comboKey: string, priceListId: number) {
    return `${comboKey}::${priceListId}`;
  }

  function updateMoney(key: string, field: keyof Money, value: string) {
    setPrices((current) => {
      const base: Money = current[key] ?? { costPrice: "", sellingPrice: "", mrp: "" };
      return { ...current, [key]: { ...base, [field]: value } };
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.name.trim() || !form.categoryId || !form.unitId) {
        throw new Error("Code, name, category and unit are required");
      }

      if (productKind === "VARIANT") {
        const enabled = combinations.filter((c) => c.enabled);
        if (!enabled.length) throw new Error("Generate and select at least one variant combination");
      }

      // Prepare Price setup
      const makePrices = (comboKey: string) =>
        activePriceLists
          .map((list) => ({ list, value: prices[moneyKey(comboKey, list.id)] }))
          .filter((row) => row.value?.costPrice && row.value?.sellingPrice)
          .map((row) => ({
            companyId,
            productId: 0,
            priceListId: row.list.id,
            costPrice: Number(row.value!.costPrice),
            sellingPrice: Number(row.value!.sellingPrice),
            mrp: row.value!.mrp ? Number(row.value!.mrp) : null,
            effectiveFrom: new Date().toISOString(),
            isActive: true,
          }));

      let response: SetupResponse;

      const enabled = form.hasVariants ? combinations.filter((c) => c.enabled) : [];
      response = await apiClient.post<SetupResponse>("products/setup", {
        product: {
          companyId,
          categoryId: Number(form.categoryId),
          brandId: form.brandId ? Number(form.brandId) : null,
          unitId: Number(form.unitId),
          taxId: form.taxId ? Number(form.taxId) : null,
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description || null,
          productType: productKind,
          hasVariants: form.hasVariants,
          trackInventory: form.trackInventory,
          allowNegativeStock: form.allowNegativeStock,
          isActive: form.isActive,
        },
        productAttributes: productAttributeDrafts.filter((d) => d.name.trim()).map((d) => ({
          clientKey: d.clientKey,
          attribute: {
            name: d.name.trim(),
            dataType: "SELECT",
            options: d.optionText.split(",").map((v) => v.trim()).filter(Boolean).map((value, index) => ({ value, displayOrder: index, isActive: true })),
          },
        })),
        variants: enabled.map((combo) => ({
          clientKey: combo.key,
          sku: combo.sku,
          attributeValues: combo.values.map((value) => {
            const group = attributeGroups.find((g) => g.groupKey === value.groupKey)!;
            return group.productLevel
              ? { productLevel: true, productAttributeClientKey: group.clientKey, value: value.value }
              : { productLevel: false, attributeId: group.attributeId, value: value.value };
          }),
          prices: makePrices(combo.key),
          isActive: true,
        })),
        prices: form.hasVariants ? [] : makePrices("simple"),
        generateBarcodes: true,
      });

      // Upload Images
      const uploads: Promise<ProductImage>[] = files.map((file, index) => {
        const data = new FormData();
        data.append("file", file);
        data.append("isPrimary", String(index === 0));
        data.append("displayOrder", String(index));
        return apiClient.post<ProductImage>(`products/${response.product.id}/images/upload`, data);
      });
      const results = await Promise.allSettled(uploads);
      const failed = results.filter((result) => result.status === "rejected").length;
      return { response, failed };
    },
    onSuccess: ({ response, failed }) => {
      toast.success("Product setup completed successfully!");
      if (failed) toast.error(`${failed} image upload(s) failed; retry from product workspace`);
      router.push(`/products/${response.product.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to create product"),
  });

  const sectionNav = ["Basics", "Variants", "Pricing", "Images", "Review"];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-24">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/products")}>
            <ArrowLeft />
            Products
          </Button>
          <h1 className="mt-2 text-2xl font-semibold">Create complete product</h1>
          <p className="text-sm text-muted-foreground">Configure catalog items—Simple or Variant products with prices and barcodes.</p>
        </div>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <PackagePlus />}
          Create product
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sectionNav.map((name, i) => (
          <a key={name} href={`#section-${i}`} className="whitespace-nowrap rounded-full border px-3 py-2 text-sm hover:bg-muted">
            {i + 1}. {name}
          </a>
        ))}
      </div>

      {/* Section 0: Basics */}
      <Card id="section-0">
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>Identity and shared rules inherited by every sellable catalog item.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Product Type Selection */}
          <div className="md:col-span-2 lg:col-span-3 space-y-1.5 mb-2">
            <Label className="text-sm font-semibold">Product Type *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex flex-col items-center justify-between gap-2 rounded-xl border p-4 cursor-pointer text-center transition-all ${
                  productKind === "SIMPLE" ? "border-primary bg-primary/5 shadow-sm font-semibold" : "hover:border-muted-foreground/40"
                }`}
              >
                <input type="radio" name="productKind" value="SIMPLE" checked={productKind === "SIMPLE"} onChange={() => setProductKind("SIMPLE")} className="sr-only" />
                <span className="text-sm font-bold">Simple Product</span>
                <span className="text-[11px] text-muted-foreground font-normal">Single standalone sellable product without size or color variations</span>
              </label>

              <label
                className={`flex flex-col items-center justify-between gap-2 rounded-xl border p-4 cursor-pointer text-center transition-all ${
                  productKind === "VARIANT" ? "border-primary bg-primary/5 shadow-sm font-semibold" : "hover:border-muted-foreground/40"
                }`}
              >
                <input type="radio" name="productKind" value="VARIANT" checked={productKind === "VARIANT"} onChange={() => setProductKind("VARIANT")} className="sr-only" />
                <span className="text-sm font-bold flex items-center gap-1">
                  <Boxes className="h-4 w-4" /> Product with Variants
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">Multiple sellable variants generated from category attributes (e.g. Size, Color)</span>
              </label>
            </div>
          </div>

          <Field label="Product code *">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="TSHIRT-001" />
          </Field>
          <Field label="Product name *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Men's Cotton T-Shirt" />
          </Field>

          <Field label="Category *">
            <select className="h-10 w-full rounded-md border bg-background px-3" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select category</option>
              {categoryOptions.map(({ category, label }) => (
                <option key={category.id} value={category.id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Unit *">
            <select className="h-10 w-full rounded-md border bg-background px-3" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              <option value="">Select unit</option>
              {(units.data?.content ?? [])
                .filter((x) => x.isActive)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.symbol})
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Brand">
            <select className="h-10 w-full rounded-md border bg-background px-3" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
              <option value="">No brand</option>
              {(brands.data?.content ?? [])
                .filter((x) => x.isActive)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Tax">
            <select className="h-10 w-full rounded-md border bg-background px-3" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}>
              <option value="">No tax</option>
              {(taxes.data?.content ?? [])
                .filter((x) => x.isActive)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.taxPercentage}%)
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Description" className="md:col-span-2 lg:col-span-3">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </Field>

          <Toggle checked={form.trackInventory} onChange={(v) => setForm({ ...form, trackInventory: v })} label="Track inventory" note="Maintain stock by exact SKU and location." />
          <Toggle checked={form.allowNegativeStock} onChange={(v) => setForm({ ...form, allowNegativeStock: v })} label="Allow negative stock" note="Use only for pre-orders or controlled exceptions." />
        </CardContent>
      </Card>

      {/* Section 1: Variant Combinations */}
      <Card id="section-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="size-5" />
            Variant combinations
          </CardTitle>
          <CardDescription>Select category options, generate combinations, then disable combinations you do not sell.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!form.hasVariants ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Simple product—one sellable SKU and one automatic barcode.</p>
          ) : (
            <>
              <div className="rounded-lg border border-dashed p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Product-specific attributes (optional)</span>
                  <Button variant="outline" size="sm" onClick={() => setProductAttributeDrafts((rows) => [...rows, { clientKey: `pa-${Date.now()}-${rows.length}`, name: "", optionText: "" }])}>
                    <Plus className="size-4" />Add attribute
                  </Button>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">Only apply to this one product -- for options shared across the whole category, use Master Data → Categories → Attributes instead.</p>
                {productAttributeDrafts.map((draft, index) => (
                  <div key={draft.clientKey} className="mb-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <Input placeholder="Attribute name (e.g. Material)" value={draft.name} onChange={(e) => setProductAttributeDrafts((rows) => rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))} />
                    <Input placeholder="Options, comma-separated (e.g. Leather, Canvas)" value={draft.optionText} onChange={(e) => setProductAttributeDrafts((rows) => rows.map((r, i) => (i === index ? { ...r, optionText: e.target.value } : r)))} />
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setProductAttributeDrafts((rows) => rows.filter((_, i) => i !== index))}><Trash2 /></Button>
                  </div>
                ))}
              </div>

              {attributeGroups.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Choose a category with variant attributes, or add a product-specific attribute above.</p>
              ) : (
                <>
                  {attributeGroups.map((a) => (
                    <div key={a.groupKey}>
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        {a.name}
                        {a.productLevel && <Badge variant="secondary">Product-specific</Badge>}
                        {a.required && <Badge>Required</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {a.options
                          .filter((o) => o.isActive)
                          .map((o) => {
                            const checked = selected[a.groupKey]?.has(o.value) ?? false;
                            return (
                              <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    setSelected((current) => {
                                      const next = { ...current, [a.groupKey]: new Set(current[a.groupKey] ?? []) };
                                      if (v) next[a.groupKey].add(o.value);
                                      else next[a.groupKey].delete(o.value);
                                      return next;
                                    })
                                  }
                                />
                                {o.value}
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={generate}>
                    <Sparkles />
                    Generate combinations
                  </Button>
                  <div className="grid gap-2">
                    {combinations.map((combo, index) => (
                      <div key={combo.key} className="grid items-center gap-3 rounded-lg border p-3 md:grid-cols-[auto_1fr_1fr]">
                        <Checkbox checked={combo.enabled} onCheckedChange={(v) => setCombinations((rows) => rows.map((r, i) => (i === index ? { ...r, enabled: !!v } : r)))} />
                        <div className="flex flex-wrap gap-1">
                          {combo.values.map((v) => (
                            <Badge variant="outline" key={v.groupKey}>
                              {v.value}
                            </Badge>
                          ))}
                        </div>
                        <Input value={combo.sku} onChange={(e) => setCombinations((rows) => rows.map((r, i) => (i === index ? { ...r, sku: e.target.value } : r)))} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Pricing */}
      <Card id="section-2">
          <CardHeader>
            <CardTitle>Variant pricing</CardTitle>
            <CardDescription>Cost price and selling price are compulsory for all active price lists on every sellable variant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activePriceLists.length === 0 ? (
              <p className="text-sm text-destructive">No active price list exists. Configure one before creating a sellable product.</p>
            ) : (
              (form.hasVariants ? combinations.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.values.map((v) => v.value).join(" / ") })) : [{ key: "simple", label: form.name || "Simple product" }]).map((item) => (
                <div key={item.key} className="rounded-lg border">
                  <div className="border-b bg-muted/30 px-4 py-3 font-medium">{item.label}</div>
                  {activePriceLists.map((list) => {
                    const key = moneyKey(item.key, list.id);
                    const row = prices[key] ?? { costPrice: "", sellingPrice: "", mrp: "" };
                    return (
                      <div key={list.id} className="grid gap-3 border-b p-4 last:border-0 md:grid-cols-[1fr_repeat(3,minmax(120px,1fr))]">
                        <div>
                          <div className="font-medium">
                            {list.name} <span className="text-destructive">*</span>
                          </div>
                          {list.isDefault && <span className="text-xs text-muted-foreground">Default price list</span>}
                        </div>
                        <Field label="Cost *">
                          <Input type="number" min="0.01" step="0.01" value={row.costPrice} onChange={(e) => updateMoney(key, "costPrice", e.target.value)} />
                        </Field>
                        <Field label="Selling *">
                          <Input type="number" min="0.01" step="0.01" value={row.sellingPrice} onChange={(e) => updateMoney(key, "sellingPrice", e.target.value)} />
                        </Field>
                        <Field label="MRP">
                          <Input type="number" min="0" step="0.01" value={row.mrp} onChange={(e) => updateMoney(key, "mrp", e.target.value)} />
                        </Field>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </CardContent>
        </Card>

      {/* Section 3: Images */}
      <Card id="section-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="size-5" />
            Product images
          </CardTitle>
          <CardDescription>Upload multiple images now. The first image becomes the catalog image.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/30">
            <ImagePlus className="size-8 text-muted-foreground" />
            <span className="font-medium">Drop images here or choose files</span>
            <span className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · maximum 10 MB each</span>
            <Input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFiles((current) => [...current, ...Array.from(e.target.files ?? [])])} />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-lg border">
                <img src={URL.createObjectURL(file)} alt="" className="aspect-square w-full object-cover" />
                <Button variant="destructive" size="icon" className="absolute right-2 top-2" onClick={() => setFiles((rows) => rows.filter((_, i) => i !== index))}>
                  <Trash2 />
                </Button>
                <div className="truncate p-2 text-xs">
                  {index === 0 && <Badge className="mr-1">Primary</Badge>}
                  {file.name}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Review and Create */}
      <Card id="section-4">
        <CardHeader>
          <CardTitle>Review and create</CardTitle>
          <CardDescription>The backend saves the product, sellable variants, prices and permanent CODE128 barcodes atomically.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Product" value={form.name || "Not named"} />
          <Summary label="Product Type" value={productKind === "VARIANT" ? "Variant Product" : "Simple Product"} />
          <Summary label="Sellable Items" value={String(form.hasVariants ? combinations.filter((c) => c.enabled).length : 1)} />
          <Summary label="Images" value={String(files.length)} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Make available immediately" note="Turn this off if catalog preparation is incomplete." />
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur lg:left-80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {form.hasVariants ? `${combinations.filter((c) => c.enabled).length} sellable SKU(s)` : "1 sellable SKU"}
          </span>
          <Button size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            Create complete product
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-medium ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (value: boolean) => void; label: string; note: string }) {
  return (
    <label className="flex min-h-20 cursor-pointer gap-3 rounded-lg border p-3">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </span>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
