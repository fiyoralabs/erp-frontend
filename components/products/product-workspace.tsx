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
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Brand, Category, CategoryAttribute, PriceList, Tax, Unit } from "@/lib/types/master";
import type { Product, Variant, Price, Barcode, ProductImage, ProductType } from "@/lib/types/product";
import { categoryHierarchy } from "@/lib/category-hierarchy";

type Combination = { key: string; values: { attributeId: number; value: string }[]; sku: string; enabled: boolean };
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

function cartesian(groups: { attributeId: number; values: string[] }[]) {
  if (!groups.length || groups.some((g) => !g.values.length)) return [];
  return groups.reduce<{ attributeId: number; value: string }[][]>(
    (rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, { attributeId: group.attributeId, value }])),
    [[]]
  );
}

export function ProductWorkspace({ companyId }: { companyId: number }) {
  const router = useRouter();

  // Product Selection Type
  const [productKind, setProductKind] = React.useState<ProductType>("SIMPLE");

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

  const [selected, setSelected] = React.useState<Record<number, Set<string>>>({});
  const [combinations, setCombinations] = React.useState<Combination[]>([]);
  const [prices, setPrices] = React.useState<Record<string, Money>>({});
  const [files, setFiles] = React.useState<File[]>([]);

  // Set Product Configuration State
  const [colorSets, setColorSets] = React.useState<SetColorEntry[]>([
    {
      id: crypto.randomUUID(),
      colour: "Black",
      setName: "Black Set",
      sku: "",
      barcode: "",
      costPrice: "",
      sellingPrice: "",
      mrp: "",
      openingSets: "10",
      sizes: JSON.parse(JSON.stringify(DEFAULT_SIZES)),
    },
  ]);

  const categories = useQuery({ queryKey: ["master", "categories", "product-workspace"], queryFn: () => apiClient.get<PagedResult<Category>>("master/categories?page=0&size=100") });
  const units = useQuery({ queryKey: ["master", "units", "product-workspace"], queryFn: () => apiClient.get<PagedResult<Unit>>("master/units?page=0&size=100") });
  const brands = useQuery({ queryKey: ["master", "brands", "product-workspace"], queryFn: () => apiClient.get<PagedResult<Brand>>("master/brands?page=0&size=100") });
  const taxes = useQuery({ queryKey: ["master", "taxes", "product-workspace"], queryFn: () => apiClient.get<PagedResult<Tax>>("master/taxes?page=0&size=100") });
  const priceLists = useQuery({ queryKey: ["master", "price-lists", "product-workspace"], queryFn: () => apiClient.get<PagedResult<PriceList>>("master/price-lists?page=0&size=100") });
  const attributes = useQuery({
    queryKey: ["master", "categories", form.categoryId, "attributes"],
    enabled: !!form.categoryId && productKind === "VARIANT",
    queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${form.categoryId}/attributes`),
  });

  const variantAttributes = (attributes.data ?? []).filter((a) => a.variant);
  const activePriceLists = (priceLists.data?.content ?? []).filter((p) => p.isActive);
  const categoryOptions = categoryHierarchy(categories.data?.content ?? []);

  // Update hasVariants flag based on productKind
  React.useEffect(() => {
    setForm((f) => ({ ...f, hasVariants: productKind !== "SIMPLE" }));
  }, [productKind]);

  // Update SKUs for Colour Sets when product code changes
  React.useEffect(() => {
    if (productKind === "SET" && form.code.trim()) {
      setColorSets((sets) =>
        sets.map((s) => ({
          ...s,
          sku: s.sku || `${form.code.trim()}-${skuPart(s.colour || "SET")}-SET`,
        }))
      );
    }
  }, [form.code, productKind]);

  React.useEffect(() => {
    setSelected({});
    setCombinations([]);
  }, [form.categoryId]);

  function generate() {
    const missing = variantAttributes.filter((a) => a.required && (selected[a.id]?.size ?? 0) === 0);
    if (missing.length) {
      toast.error(`Select a value for required attribute: ${missing[0].name}`);
      return;
    }
    const groups = variantAttributes.map((a) => ({ attributeId: a.id, values: Array.from(selected[a.id] ?? []) })).filter((g) => g.values.length > 0);
    const rows = cartesian(groups);
    const next = rows.map((values) => {
      const key = values.map((v) => `${v.attributeId}:${v.value}`).join("|");
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

  // Set Product Helpers
  const addColourSet = () => {
    const nextColour = colorSets.length === 1 ? "Blue" : colorSets.length === 2 ? "White" : `Color ${colorSets.length + 1}`;
    const codePrefix = form.code.trim() || "SKU";
    setColorSets((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        colour: nextColour,
        setName: `${nextColour} Set`,
        sku: `${codePrefix}-${skuPart(nextColour)}-SET`,
        barcode: "",
        costPrice: prev[0]?.costPrice ?? "",
        sellingPrice: prev[0]?.sellingPrice ?? "",
        mrp: prev[0]?.mrp ?? "",
        openingSets: "10",
        sizes: JSON.parse(JSON.stringify(DEFAULT_SIZES)),
      },
    ]);
  };

  const removeColourSet = (index: number) => {
    if (colorSets.length <= 1) {
      toast.error("At least one Colour Set is required for Set Product");
      return;
    }
    setColorSets((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSetSizeQty = (setIndex: number, sizeName: string, delta: number) => {
    setColorSets((prev) => {
      const next = [...prev];
      const targetSet = { ...next[setIndex] };
      targetSet.sizes = targetSet.sizes.map((s) => (s.size === sizeName ? { ...s, qty: Math.max(0, s.qty + delta) } : s));
      next[setIndex] = targetSet;
      return next;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.name.trim() || !form.categoryId || !form.unitId) {
        throw new Error("Code, name, category and unit are required");
      }

      if (productKind === "SET") {
        if (colorSets.length === 0) throw new Error("At least one Colour Set is required for Set Product");
        for (const cs of colorSets) {
          if (!cs.colour.trim()) throw new Error("Colour is required for every Colour Set");
          if (!cs.setName.trim()) throw new Error("Set Name is required for every Colour Set");
          const totalPcs = cs.sizes.reduce((a, b) => a + b.qty, 0);
          if (totalPcs <= 0) throw new Error(`Set '${cs.setName}' must contain at least 1 piece in size composition`);
          if (!cs.costPrice || Number(cs.costPrice) <= 0) throw new Error(`Cost price is required for Set '${cs.setName}'`);
          if (!cs.sellingPrice || Number(cs.sellingPrice) <= 0) throw new Error(`Selling price is required for Set '${cs.setName}'`);
        }
      } else if (productKind === "VARIANT") {
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

      if (productKind === "SET") {
        // Construct Variant objects for each Colour Set
        const setVariants = colorSets.map((cs) => {
          const totalPcs = cs.sizes.reduce((a, b) => a + b.qty, 0);
          const activeComposition = cs.sizes.filter((s) => s.qty > 0);
          const setSku = cs.sku.trim() || `${form.code.trim()}-${skuPart(cs.colour)}-SET`;

          const setPrices = activePriceLists.map((list) => ({
            companyId,
            productId: 0,
            priceListId: list.id,
            costPrice: Number(cs.costPrice),
            sellingPrice: Number(cs.sellingPrice),
            mrp: cs.mrp ? Number(cs.mrp) : null,
            effectiveFrom: new Date().toISOString(),
            isActive: true,
          }));

          return {
            clientKey: cs.id,
            sku: setSku,
            variantName: `${cs.setName} (${cs.colour} - ${totalPcs} pcs/set)`,
            attributeValues: [
              { attributeId: 0, attributeName: "Type", value: "SET" },
              { attributeId: 0, attributeName: "Colour", value: cs.colour },
              { attributeId: 0, attributeName: "Set Name", value: cs.setName },
              { attributeId: 0, attributeName: "Pieces Per Set", value: String(totalPcs) },
              { attributeId: 0, attributeName: "Set Composition", value: JSON.stringify(activeComposition) },
            ],
            prices: setPrices,
            isActive: true,
          };
        });

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
            productType: "SET",
            hasVariants: true,
            trackInventory: form.trackInventory,
            allowNegativeStock: form.allowNegativeStock,
            isActive: form.isActive,
          },
          variants: setVariants as any,
          prices: [],
          generateBarcodes: false,
        });

        // Save Set Barcodes if entered
        for (let i = 0; i < colorSets.length; i++) {
          const cs = colorSets[i];
          const createdVariant = response.variants?.[i];
          if (cs.barcode.trim() && createdVariant?.id) {
            try {
              await apiClient.post(`products/barcodes`, {
                productId: response.product.id,
                variantId: createdVariant.id,
                barcode: cs.barcode.trim(),
                barcodeType: "EAN13",
                isPrimary: true,
              });
            } catch (e) {
              // ignore duplicate barcode errors gracefully
            }
          }
        }
      } else {
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
          variants: enabled.map((combo) => ({ clientKey: combo.key, sku: combo.sku, attributeValues: combo.values, prices: makePrices(combo.key), isActive: true })),
          prices: form.hasVariants ? [] : makePrices("simple"),
          generateBarcodes: true,
        });
      }

      // Upload Images
      const uploads: Promise<ProductImage>[] = files.map((file, index) => {
        const data = new FormData();
        data.append("file", file);
        data.append("isPrimary", String(index === 0));
        data.append("displayOrder", String(index));
        return apiClient.post<ProductImage>(`products/${response.product.id}/images/upload`, data);
      });
      const results = await Promise.allSettled(uploads);
      const failed = results.filter((r) => r.status === "rejected").length;
      return { response, failed };
    },
    onSuccess: ({ response, failed }) => {
      toast.success("Product setup completed successfully!");
      if (failed) toast.error(`${failed} image upload(s) failed; retry from product workspace`);
      router.push(`/products/${response.product.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to create product"),
  });

  const sectionNav = ["Basics", productKind === "SET" ? "Set Configuration" : "Variants", "Pricing", "Images", "Review"];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-24">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/products")}>
            <ArrowLeft />
            Products
          </Button>
          <h1 className="mt-2 text-2xl font-semibold">Create complete product</h1>
          <p className="text-sm text-muted-foreground">Configure catalog items—Simple, Variant, or Set products with prices, composition, and barcodes.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              <label
                className={`flex flex-col items-center justify-between gap-2 rounded-xl border p-4 cursor-pointer text-center transition-all ${
                  productKind === "SET" ? "border-primary bg-primary/5 shadow-sm font-semibold" : "hover:border-muted-foreground/40"
                }`}
              >
                <input type="radio" name="productKind" value="SET" checked={productKind === "SET"} onChange={() => setProductKind("SET")} className="sr-only" />
                <span className="text-sm font-bold flex items-center gap-1 text-primary">
                  <Layers className="h-4 w-4" /> Set Product
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">Group of different sizes of the SAME color (e.g., S:1, M:2, L:2, XL:1 = 6 Pcs/Set)</span>
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

      {/* Section 1: Set Configuration / Variant Combinations */}
      {productKind === "SET" ? (
        <Card id="section-1" className="border-primary/40 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-primary">
                <Layers className="h-5 w-5" /> Set Configuration
              </span>
              <Button size="sm" variant="outline" onClick={addColourSet} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Another Colour Set
              </Button>
            </CardTitle>
            <CardDescription>Configure Colour Sets (same colour, multiple sizes per set). Define how many pieces of each size make 1 Set.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {colorSets.map((cs, setIdx) => {
              const pcsPerSet = cs.sizes.reduce((a, b) => a + b.qty, 0);
              const opSets = Number(cs.openingSets) || 0;
              const totalOpeningPcs = opSets * pcsPerSet;

              return (
                <Card key={cs.id} className="border bg-card shadow-none relative">
                  <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <span className="h-3 w-3 rounded-full bg-primary inline-block" />
                      Colour Set #{setIdx + 1}: {cs.setName || cs.colour} ({pcsPerSet} Pieces/Set)
                    </div>
                    {colorSets.length > 1 && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeColourSet(setIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    {/* Header Info */}
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                      <Field label="Colour *">
                        <Input
                          value={cs.colour}
                          onChange={(e) => {
                            const newCol = e.target.value;
                            setColorSets((prev) => {
                              const next = [...prev];
                              next[setIdx] = {
                                ...next[setIdx],
                                colour: newCol,
                                setName: `${newCol} Set`,
                                sku: `${form.code.trim() || "SKU"}-${skuPart(newCol)}-SET`,
                              };
                              return next;
                            });
                          }}
                          placeholder="Black"
                        />
                      </Field>

                      <Field label="Set Name *">
                        <Input
                          value={cs.setName}
                          onChange={(e) => {
                            const nameVal = e.target.value;
                            setColorSets((prev) => {
                              const next = [...prev];
                              next[setIdx] = { ...next[setIdx], setName: nameVal };
                              return next;
                            });
                          }}
                          placeholder="Black Set"
                        />
                      </Field>

                      <Field label="Set SKU *">
                        <Input
                          value={cs.sku}
                          onChange={(e) => {
                            const skuVal = e.target.value;
                            setColorSets((prev) => {
                              const next = [...prev];
                              next[setIdx] = { ...next[setIdx], sku: skuVal };
                              return next;
                            });
                          }}
                          placeholder="TSHIRT-001-BLK-SET"
                        />
                      </Field>

                      <Field label="Set Barcode (Optional)">
                        <Input
                          value={cs.barcode}
                          onChange={(e) => {
                            const bc = e.target.value;
                            setColorSets((prev) => {
                              const next = [...prev];
                              next[setIdx] = { ...next[setIdx], barcode: bc };
                              return next;
                            });
                          }}
                          placeholder="8901234500012"
                          className="font-mono"
                        />
                      </Field>
                    </div>

                    {/* Size Composition Interactive Table */}
                    <div className="border rounded-lg p-3 bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Size Composition (Quantity Per Set)</span>
                        <span className="font-bold text-foreground bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">Total: {pcsPerSet} Pieces / Set</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        {cs.sizes.map((sObj) => (
                          <div key={sObj.size} className="flex items-center justify-between p-2 rounded border bg-card text-xs">
                            <span className="font-bold">{sObj.size}</span>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="outline" className="h-5 w-5 shrink-0" onClick={() => updateSetSizeQty(setIdx, sObj.size, -1)}>
                                -
                              </Button>
                              <span className="w-6 text-center font-bold">{sObj.qty}</span>
                              <Button size="icon" variant="outline" className="h-5 w-5 shrink-0" onClick={() => updateSetSizeQty(setIdx, sObj.size, 1)}>
                                +
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pricing & Opening Stock for Set */}
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 pt-1">
                      <Field label="Cost Price / Set (₹) *">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cs.costPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            setColorSets((prev) => {
                              const next = [...prev];
                              next[setIdx] = { ...next[setIdx], costPrice: val };
                              return next;
                            });
                          }}
                          placeholder="2400"
                        />
                      </Field>

                      <Field label="Selling Price / Set (₹) *">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cs.sellingPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            setColorSets((prev) => {
                              const next = [...prev];
                              next[setIdx] = { ...next[setIdx], sellingPrice: val };
                              return next;
                            });
                          }}
                          placeholder="2999"
                        />
                      </Field>

                      <Field label="Opening Sets">
                        <Input
                          type="number"
                          min="0"
                          value={cs.openingSets}
                          onChange={(e) => {
                            const val = e.target.value;
                            setColorSets((prev) => {
                              const next = [...prev];
                              next[setIdx] = { ...next[setIdx], openingSets: val };
                              return next;
                            });
                          }}
                          placeholder="10"
                        />
                      </Field>

                      <div className="flex flex-col justify-center rounded-md border bg-muted/20 p-2.5 text-xs">
                        <span className="text-muted-foreground block">Opening Pieces:</span>
                        <strong className="text-base font-bold text-primary">{totalOpeningPcs} Pieces</strong>
                        <span className="text-[10px] text-muted-foreground">
                          {cs.sizes.filter((s) => s.qty > 0).map((s) => `${s.size}:${s.qty * opSets}`).join(" • ")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Button variant="outline" onClick={addColourSet} className="w-full gap-2 border-dashed py-5">
              <Plus className="h-4 w-4" /> Add Another Colour Set
            </Button>
          </CardContent>
        </Card>
      ) : (
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
            ) : variantAttributes.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Choose a category with variant attributes, or configure them in Master Data → Categories.</p>
            ) : (
              <>
                {variantAttributes.map((a) => (
                  <div key={a.id}>
                    <div className="mb-2 flex items-center gap-2 font-medium">
                      {a.name}
                      {a.required && <Badge>Required</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.options
                        .filter((o) => o.isActive)
                        .map((o) => {
                          const checked = selected[a.id]?.has(o.value) ?? false;
                          return (
                            <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  setSelected((current) => {
                                    const next = { ...current, [a.id]: new Set(current[a.id] ?? []) };
                                    if (v) next[a.id].add(o.value);
                                    else next[a.id].delete(o.value);
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
                          <Badge variant="outline" key={`${v.attributeId}-${v.value}`}>
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
          </CardContent>
        </Card>
      )}

      {/* Section 2: Pricing */}
      {productKind !== "SET" && (
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
      )}

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
          <CardDescription>The backend saves the product, sellable variants/sets, prices and permanent CODE128 barcodes atomically.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Product" value={form.name || "Not named"} />
          <Summary label="Product Type" value={productKind === "SET" ? "Set Product" : productKind === "VARIANT" ? "Variant Product" : "Simple Product"} />
          <Summary label="Sellable Items" value={String(productKind === "SET" ? colorSets.length : form.hasVariants ? combinations.filter((c) => c.enabled).length : 1)} />
          <Summary label="Images" value={String(files.length)} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Make available immediately" note="Turn this off if catalog preparation is incomplete." />
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur lg:left-80">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {productKind === "SET" ? `${colorSets.length} Colour Set(s)` : form.hasVariants ? `${combinations.filter((c) => c.enabled).length} sellable SKU(s)` : "1 sellable SKU"}
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
