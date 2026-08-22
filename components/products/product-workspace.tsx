"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Boxes, Check, Copy, ImagePlus, Loader2, PackagePlus, Plus, Sparkles, Trash2, Layers } from "lucide-react";
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
type Money = { sellingPrice: string; mrp: string };
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
      const base: Money = current[key] ?? { sellingPrice: "", mrp: "" };
      return { ...current, [key]: { ...base, [field]: value } };
    });
  }

  // Applies one price list's cost/selling/MRP to every sellable item at once
  // -- most products sell every size/color at the same price, so this avoids
  // re-typing it per variant row.
  function applyPriceToAllVariants(priceListId: number, money: Money, allKeys: string[]) {
    setPrices((current) => {
      const next = { ...current };
      allKeys.forEach((key) => { next[moneyKey(key, priceListId)] = { ...money }; });
      return next;
    });
    toast.success(`Applied to all ${allKeys.length} variants`);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.categoryId || !form.unitId) {
        throw new Error("Name, category and unit are required");
      }

      if (productKind === "VARIANT") {
        const enabled = combinations.filter((c) => c.enabled);
        if (!enabled.length) throw new Error("Generate and select at least one variant combination");
      }

      // Prepare Price setup
      const makePrices = (comboKey: string) =>
        activePriceLists
          .map((list) => ({ list, value: prices[moneyKey(comboKey, list.id)] }))
          .filter((row) => row.value?.sellingPrice)
          .map((row) => ({
            companyId,
            productId: 0,
            priceListId: row.list.id,
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
          code: form.code.trim() || undefined,
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

  type StepId = "basics" | "variants" | "pricing" | "review";

  const steps: { id: StepId; label: string; description: string }[] = React.useMemo(() => {
    if (productKind === "VARIANT") {
      return [
        { id: "basics", label: "Basics", description: "Identity & category" },
        { id: "variants", label: "Variants", description: "Attributes & SKUs" },
        { id: "pricing", label: "Pricing", description: "Price list rates" },
        { id: "review", label: "Media & Review", description: "Photos & launch" },
      ];
    }
    return [
      { id: "basics", label: "Basics", description: "Identity & category" },
      { id: "pricing", label: "Pricing", description: "Price list rates" },
      { id: "review", label: "Media & Review", description: "Photos & launch" },
    ];
  }, [productKind]);

  const [activeStep, setActiveStep] = React.useState<StepId>("basics");

  // Keep active step in valid range when productKind changes
  React.useEffect(() => {
    if (productKind === "SIMPLE" && activeStep === "variants") {
      setActiveStep("pricing");
    }
  }, [productKind, activeStep]);

  const currentStepIndex = steps.findIndex((s) => s.id === activeStep);
  const nextStep = steps[currentStepIndex + 1];
  const prevStep = steps[currentStepIndex - 1];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/products")} className="gap-1 px-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to Products
          </Button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create complete product</h1>
          <p className="text-sm text-muted-foreground">Configure catalog item—Simple or Variant product with prices, barcodes, and images.</p>
        </div>
        <Button disabled={save.isPending} onClick={() => save.mutate()} className="gap-2">
          {save.isPending ? <Loader2 className="animate-spin size-4" /> : <PackagePlus className="size-4" />}
          Create complete product
        </Button>
      </div>

      {/* Step Navigation Bar -- compact horizontal stepper: numbered circles
          connected by a line, step labels hidden below sm: to keep this to
          one short row on phones instead of wrapping into a card grid. */}
      <div className="flex items-center overflow-x-auto pb-0.5">
        {steps.map((step, idx) => {
          const isActive = activeStep === step.id;
          const isPassed = currentStepIndex > idx;
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => setActiveStep(step.id)}
                className="flex shrink-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-muted/60"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isPassed
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPassed ? <Check className="size-3.5" /> : idx + 1}
                </span>
                <span className={`whitespace-nowrap text-xs font-semibold sm:text-sm ${isActive ? "text-foreground" : isPassed ? "text-foreground/80" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </button>
              {idx < steps.length - 1 && <div className={`mx-1 h-px w-4 shrink-0 sm:w-8 ${isPassed ? "bg-primary/40" : "bg-border"}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Basics */}
      {activeStep === "basics" && (
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
            <CardDescription>Identity and shared rules inherited by every sellable catalog item.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* Product Type Selection */}
            <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
              <Label className="text-sm font-semibold">Product Type *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 cursor-pointer transition-all ${
                    productKind === "SIMPLE" ? "border-primary bg-primary/5 shadow-xs font-semibold ring-1 ring-primary/20" : "hover:border-slate-300"
                  }`}
                >
                  <input type="radio" name="productKind" value="SIMPLE" checked={productKind === "SIMPLE"} onChange={() => setProductKind("SIMPLE")} className="sr-only" />
                  <span className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                    <PackagePlus className="size-4 text-primary" /> Simple Product
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Single standalone sellable item without size or color variations (e.g. Accessories, Books)</span>
                </label>

                <label
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 cursor-pointer transition-all ${
                    productKind === "VARIANT" ? "border-primary bg-primary/5 shadow-xs font-semibold ring-1 ring-primary/20" : "hover:border-slate-300"
                  }`}
                >
                  <input type="radio" name="productKind" value="VARIANT" checked={productKind === "VARIANT"} onChange={() => setProductKind("VARIANT")} className="sr-only" />
                  <span className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                    <Boxes className="size-4 text-primary" /> Product with Variants
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Multiple sellable variants generated from category attributes (e.g. Size, Color combinations)</span>
                </label>
              </div>
            </div>

            {/* No manual code entry -- erp auto-generates one from the name (e.g. "Jeans
                Pant" -> "JEANS-PANT-001"). Only shown when a barcode scan already
                pre-filled it (see the query-param effect below), so that value stays
                visible/editable instead of being silently overridden. */}
            {form.code && (
              <Field label="Product code (from scanned barcode)">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
            )}
            <Field label="Product name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Men's Cotton T-Shirt" />
            </Field>

            <Field label="Category *">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Select category</option>
                {categoryOptions.map(({ category, label }) => (
                  <option key={category.id} value={category.id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Unit *">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
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
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
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
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}>
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
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed item description, fabric details, care instructions..." rows={3} />
            </Field>

            <Toggle checked={form.trackInventory} onChange={(v) => setForm({ ...form, trackInventory: v })} label="Track inventory" note="Maintain real-time stock balances by SKU and location." />
            <Toggle checked={form.allowNegativeStock} onChange={(v) => setForm({ ...form, allowNegativeStock: v })} label="Allow negative stock" note="Allow selling items even if stock balance is zero." />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Variants (Only shown for VARIANT products) */}
      {activeStep === "variants" && productKind === "VARIANT" && (
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="size-5 text-primary" />
              Variant combinations
            </CardTitle>
            <CardDescription>Select attribute options, generate combinations, and customize SKUs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-dashed p-4 bg-muted/20">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Product-specific attributes (optional)</span>
                <Button variant="outline" size="sm" onClick={() => setProductAttributeDrafts((rows) => [...rows, { clientKey: `pa-${Date.now()}-${rows.length}`, name: "", optionText: "" }])}>
                  <Plus className="size-4 mr-1" />Add attribute
                </Button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Attributes unique to this product (e.g. Fit, Material). For shared category options, configure them in Master Data → Categories.</p>
              {productAttributeDrafts.map((draft, index) => (
                <div key={draft.clientKey} className="mb-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <Input placeholder="Attribute name (e.g. Material)" value={draft.name} onChange={(e) => setProductAttributeDrafts((rows) => rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))} />
                  <Input placeholder="Options, comma-separated (e.g. Leather, Canvas)" value={draft.optionText} onChange={(e) => setProductAttributeDrafts((rows) => rows.map((r, i) => (i === index ? { ...r, optionText: e.target.value } : r)))} />
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setProductAttributeDrafts((rows) => rows.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>

            {attributeGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <Boxes className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                No variant attributes found. Choose a category with variant attributes or add a product-specific attribute above.
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {attributeGroups.map((a) => (
                    <div key={a.groupKey} className="rounded-lg border p-4 bg-background">
                      <div className="mb-2.5 flex items-center gap-2 font-medium text-sm">
                        {a.name}
                        {a.productLevel && <Badge variant="secondary" className="text-[10px]">Product-specific</Badge>}
                        {a.required && <Badge className="text-[10px]">Required</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {a.options
                          .filter((o) => o.isActive)
                          .map((o) => {
                            const checked = selected[a.groupKey]?.has(o.value) ?? false;
                            return (
                              <label key={o.id} className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs transition-colors ${checked ? "border-primary bg-primary/5 font-semibold text-primary" : "hover:bg-muted/40"}`}>
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
                </div>

                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={generate} className="gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Generate combinations
                  </Button>
                  {combinations.length > 0 && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {combinations.filter((c) => c.enabled).length} of {combinations.length} variants enabled
                    </span>
                  )}
                </div>

                {combinations.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Variants & SKUs</Label>
                    <div className="grid gap-2 max-h-96 overflow-y-auto pr-1">
                      {combinations.map((combo, index) => (
                        <div key={combo.key} className="flex items-center gap-3 rounded-lg border p-3 bg-background">
                          <Checkbox checked={combo.enabled} onCheckedChange={(v) => setCombinations((rows) => rows.map((r, i) => (i === index ? { ...r, enabled: !!v } : r)))} />
                          <div className="flex flex-wrap gap-1 flex-1">
                            {combo.values.map((v) => (
                              <Badge variant="outline" key={v.groupKey} className="text-xs">
                                {v.value}
                              </Badge>
                            ))}
                          </div>
                          <div className="w-64">
                            <Input value={combo.sku} onChange={(e) => setCombinations((rows) => rows.map((r, i) => (i === index ? { ...r, sku: e.target.value } : r)))} placeholder="SKU" className="h-8 text-xs font-mono" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Pricing */}
      {activeStep === "pricing" && (() => {
        const pricingItems = form.hasVariants
          ? combinations.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.values.map((v) => v.value).join(" / "), sku: c.sku }))
          : [{ key: "simple", label: form.name || "Simple product", sku: form.code || "SKU" }];
        const allKeys = pricingItems.map((item) => item.key);
        return (
          <div className="flex flex-col gap-5">
            {activePriceLists.length > 0 && pricingItems.length > 1 && (
              <QuickFillPricing priceLists={activePriceLists} onApply={(listId, money) => applyPriceToAllVariants(listId, money, allKeys)} />
            )}

            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>Pricing & Rates</CardTitle>
                <CardDescription>Selling price and optional MRP per price list.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {activePriceLists.length === 0 ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
                    No active price list exists. Please configure one in Master Data before creating products.
                  </div>
                ) : (
                  pricingItems.map((item) => (
                    <div key={item.key} className="rounded-xl border bg-background overflow-hidden">
                      <div className="border-b bg-muted/40 px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{item.label}</span>
                        <span className="text-xs font-mono text-muted-foreground truncate">{item.sku}</span>
                      </div>
                      <div className="divide-y">
                        {activePriceLists.map((list) => {
                          const key = moneyKey(item.key, list.id);
                          const row = prices[key] ?? { sellingPrice: "", mrp: "" };
                          return (
                            <div key={list.id} className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-[1.5fr_repeat(2,minmax(120px,1fr))] items-end">
                              <div className="sm:col-span-2 md:col-span-1">
                                <div className="text-sm font-medium">
                                  {list.name} <span className="text-destructive">*</span>
                                </div>
                                {list.isDefault && <span className="text-[11px] text-muted-foreground">Default Price List</span>}
                              </div>
                              <Field label="Selling Price *">
                                <Input type="number" min="0.01" step="0.01" placeholder="0.00" value={row.sellingPrice} onChange={(e) => updateMoney(key, "sellingPrice", e.target.value)} />
                              </Field>
                              <Field label="MRP (Optional)">
                                <Input type="number" min="0" step="0.01" placeholder="0.00" value={row.mrp} onChange={(e) => updateMoney(key, "mrp", e.target.value)} />
                              </Field>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Step 4: Media & Review */}
      {activeStep === "review" && (
        <div className="flex flex-col gap-6">
          {/* Images Card */}
          <Card className="shadow-xs border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="size-5 text-primary" />
                Product Images
              </CardTitle>
              <CardDescription>Upload media files. The first uploaded image will be marked as primary catalog image.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/30 transition-colors">
                <ImagePlus className="size-8 text-muted-foreground" />
                <span className="font-medium text-sm">Drop images here or click to browse</span>
                <span className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · maximum 10 MB per file</span>
                <Input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFiles((current) => [...current, ...Array.from(e.target.files ?? [])])} />
              </label>

              {files.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border group">
                      <img src={URL.createObjectURL(file)} alt="" className="aspect-square w-full object-cover" />
                      <Button variant="destructive" size="icon" className="absolute right-2 top-2 h-7 w-7 opacity-80 group-hover:opacity-100" onClick={() => setFiles((rows) => rows.filter((_, i) => i !== index))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                      <div className="truncate p-2 text-xs bg-background/90 border-t">
                        {index === 0 && <Badge className="mr-1 text-[10px] py-0 px-1">Primary</Badge>}
                        {file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review & Launch Card */}
          <Card className="shadow-xs border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle>Catalog Review & Launch</CardTitle>
              <CardDescription>Review key configurations before final creation. All variants, prices, and CODE128 barcodes are generated atomically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Summary label="Product Name" value={form.name || "—"} />
                <Summary label="Product Code" value={form.code || "Auto-generated"} />
                <Summary label="Product Type" value={productKind === "VARIANT" ? "Variant Product" : "Simple Product"} />
                <Summary label="Sellable SKUs" value={String(form.hasVariants ? combinations.filter((c) => c.enabled).length : 1)} />
              </div>

              <div className="pt-2">
                <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Make available immediately" note="When active, the product is published to the catalog and ready for stock & sales." />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Step Actions -- stacked full-width on mobile with the primary
          action (Continue/Create) on top since it's reached first by thumb;
          side-by-side with Back on the left once there's room for it. */}
      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        {prevStep ? (
          <Button variant="outline" onClick={() => setActiveStep(prevStep.id)} className="w-full gap-1.5 sm:w-auto">
            <ArrowLeft className="size-4" />
            Back to {prevStep.label}
          </Button>
        ) : (
          <div className="hidden sm:block" />
        )}

        <div className="flex items-center gap-3">
          {nextStep ? (
            <Button onClick={() => setActiveStep(nextStep.id)} className="w-full gap-1.5 sm:w-auto">
              Continue to {nextStep.label}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button size="lg" disabled={save.isPending} onClick={() => save.mutate()} className="w-full gap-2 sm:w-auto">
              {save.isPending ? <Loader2 className="animate-spin size-4" /> : <Check className="size-4" />}
              Create complete product
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Set a price once per price list and apply it to every variant in one tap,
// instead of retyping the same cost/selling/MRP into every variant's row
// below. Kept visually separate (tinted, dashed border) so it reads as a
// helper tool, not another data-entry card.
function QuickFillPricing({ priceLists, onApply }: {
  priceLists: { id: number; name: string; isDefault: boolean }[];
  onApply: (priceListId: number, money: Money) => void;
}) {
  const [draft, setDraft] = React.useState<Record<number, Money>>({});
  const update = (listId: number, field: keyof Money, value: string) => {
    setDraft((current) => ({
      ...current,
      [listId]: { ...(current[listId] ?? { sellingPrice: "", mrp: "" }), [field]: value },
    }));
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Quick fill</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Set a price once and apply it to every variant below -- fine-tune individual rows afterward if needed.</p>
      <div className="flex flex-col gap-2.5">
        {priceLists.map((list) => {
          const money = draft[list.id] ?? { sellingPrice: "", mrp: "" };
          const canApply = !!money.sellingPrice;
          return (
            <div key={list.id} className="flex flex-col gap-2 rounded-lg bg-background/70 p-3 sm:flex-row sm:items-end">
              <div className="text-xs font-medium text-muted-foreground sm:w-28 sm:shrink-0">
                {list.name}
                {list.isDefault && <span className="ml-1 text-primary/70">· Default</span>}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Input type="number" min="0.01" step="0.01" placeholder="Selling" value={money.sellingPrice} onChange={(e) => update(list.id, "sellingPrice", e.target.value)} className="h-9 text-sm" />
                <Input type="number" min="0" step="0.01" placeholder="MRP" value={money.mrp} onChange={(e) => update(list.id, "mrp", e.target.value)} className="h-9 text-sm" />
              </div>
              <Button type="button" size="sm" variant="secondary" disabled={!canApply} onClick={() => onApply(list.id, money)} className="h-9 shrink-0 gap-1.5">
                <Copy className="size-3.5" />
                Apply to all
              </Button>
            </div>
          );
        })}
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
