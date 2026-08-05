"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Check, ImagePlus, Loader2, PackagePlus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Brand, Category, CategoryAttribute, PriceList, Tax, Unit } from "@/lib/types/master";
import type { Product, Variant, Price, Barcode, ProductImage } from "@/lib/types/product";
import { categoryHierarchy } from "@/lib/category-hierarchy";

type Combination = { key: string; values: { attributeId: number; value: string }[]; sku: string; enabled: boolean };
type Money = { costPrice: string; sellingPrice: string; mrp: string };
type SetupResponse = { product: Product; variants: Variant[]; prices: Price[]; barcodes: Barcode[] };

function skuPart(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function cartesian(groups: { attributeId: number; values: string[] }[]) {
  if (!groups.length || groups.some((g) => !g.values.length)) return [];
  return groups.reduce<{ attributeId: number; value: string }[][]>((rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, { attributeId: group.attributeId, value }])), [[]]);
}

export function ProductWorkspace({ companyId }: { companyId: number }) {
  const router = useRouter();
  const [form, setForm] = React.useState({ code: "", name: "", description: "", categoryId: "", unitId: "", brandId: "", taxId: "", hasVariants: true, trackInventory: true, allowNegativeStock: false, isActive: true });
  const [selected, setSelected] = React.useState<Record<number, Set<string>>>({});
  const [combinations, setCombinations] = React.useState<Combination[]>([]);
  const [prices, setPrices] = React.useState<Record<string, Money>>({});
  const [files, setFiles] = React.useState<File[]>([]);

  const categories = useQuery({ queryKey: ["master","categories","product-workspace"], queryFn: () => apiClient.get<PagedResult<Category>>("master/categories?page=0&size=100") });
  const units = useQuery({ queryKey: ["master","units","product-workspace"], queryFn: () => apiClient.get<PagedResult<Unit>>("master/units?page=0&size=100") });
  const brands = useQuery({ queryKey: ["master","brands","product-workspace"], queryFn: () => apiClient.get<PagedResult<Brand>>("master/brands?page=0&size=100") });
  const taxes = useQuery({ queryKey: ["master","taxes","product-workspace"], queryFn: () => apiClient.get<PagedResult<Tax>>("master/taxes?page=0&size=100") });
  const priceLists = useQuery({ queryKey: ["master","price-lists","product-workspace"], queryFn: () => apiClient.get<PagedResult<PriceList>>("master/price-lists?page=0&size=100") });
  const attributes = useQuery({ queryKey: ["master","categories",form.categoryId,"attributes"], enabled: !!form.categoryId && form.hasVariants, queryFn: () => apiClient.get<CategoryAttribute[]>(`master/categories/${form.categoryId}/attributes`) });
  const variantAttributes = (attributes.data ?? []).filter((a) => a.variant);
  const activePriceLists = (priceLists.data?.content ?? []).filter((p) => p.isActive);
  const categoryOptions = categoryHierarchy(categories.data?.content ?? []);

  React.useEffect(() => { setSelected({}); setCombinations([]); }, [form.categoryId]);
  function generate() {
    const missing = variantAttributes.filter((a) => a.required && (selected[a.id]?.size ?? 0) === 0);
    if (missing.length) { toast.error(`Select a value for required attribute: ${missing[0].name}`); return; }
    const groups = variantAttributes.map((a) => ({ attributeId: a.id, values: Array.from(selected[a.id] ?? []) })).filter((g) => g.values.length > 0);
    const rows = cartesian(groups);
    const next = rows.map((values) => { const key = values.map((v) => `${v.attributeId}:${v.value}`).join("|"); return { key, values, sku: [form.code || "SKU", ...values.map((v) => skuPart(v.value))].join("-"), enabled: combinations.find((c) => c.key === key)?.enabled ?? true }; });
    setCombinations(next); toast.success(`${next.length} combinations prepared`);
  }
  function moneyKey(comboKey: string, priceListId: number) { return `${comboKey}::${priceListId}`; }
  function updateMoney(key: string, field: keyof Money, value: string) { setPrices((current) => { const base: Money = current[key] ?? { costPrice: "", sellingPrice: "", mrp: "" }; return { ...current, [key]: { ...base, [field]: value } }; }); }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.name.trim() || !form.categoryId || !form.unitId) throw new Error("Code, name, category and unit are required");
      const enabled = form.hasVariants ? combinations.filter((c) => c.enabled) : [];
      if (form.hasVariants && !enabled.length) throw new Error("Generate and select at least one variant combination");
      const makePrices = (comboKey: string) => activePriceLists.map((list) => ({ list, value: prices[moneyKey(comboKey, list.id)] })).filter((row) => row.value?.costPrice && row.value?.sellingPrice).map((row) => ({ companyId, productId: 0, priceListId: row.list.id, costPrice: Number(row.value!.costPrice), sellingPrice: Number(row.value!.sellingPrice), mrp: row.value!.mrp ? Number(row.value!.mrp) : null, effectiveFrom: new Date().toISOString(), isActive: true }));
      
      // Compulsory price check for all active price lists across all sellable SKUs
      const items = form.hasVariants ? enabled.map((c) => c.key) : ["simple"];
      for (const itemKey of items) {
        for (const list of activePriceLists) {
          const val = prices[moneyKey(itemKey, list.id)];
          if (!val || !val.costPrice || !val.sellingPrice || Number(val.costPrice) <= 0 || Number(val.sellingPrice) <= 0) {
            const itemLabel = itemKey === "simple" ? (form.name || "Product") : enabled.find((c) => c.key === itemKey)?.sku || itemKey;
            throw new Error(`Cost price and selling price are compulsory for price list '${list.name}' on '${itemLabel}'`);
          }
        }
      }
      const response = await apiClient.post<SetupResponse>("products/setup", { product: { companyId, categoryId: Number(form.categoryId), brandId: form.brandId ? Number(form.brandId) : null, unitId: Number(form.unitId), taxId: form.taxId ? Number(form.taxId) : null, code: form.code.trim(), name: form.name.trim(), description: form.description || null, productType: form.hasVariants ? "VARIANT" : "SIMPLE", hasVariants: form.hasVariants, trackInventory: form.trackInventory, allowNegativeStock: form.allowNegativeStock, isActive: form.isActive }, variants: enabled.map((combo) => ({ clientKey: combo.key, sku: combo.sku, attributeValues: combo.values, prices: makePrices(combo.key), isActive: true })), prices: form.hasVariants ? [] : makePrices("simple"), generateBarcodes: true });
      const uploads: Promise<ProductImage>[] = files.map((file, index) => { const data = new FormData(); data.append("file", file); data.append("isPrimary", String(index === 0)); data.append("displayOrder", String(index)); return apiClient.post<ProductImage>(`products/${response.product.id}/images/upload`, data); });
      const results = await Promise.allSettled(uploads);
      const failed = results.filter((r) => r.status === "rejected").length;
      return { response, failed };
    },
    onSuccess: ({ response, failed }) => { toast.success("Product, prices and barcodes created"); if (failed) toast.error(`${failed} image upload${failed === 1 ? "" : "s"} failed; retry from the product page`); router.push(`/products/${response.product.id}`); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to create product"),
  });

  const sectionNav = ["Basics", "Variants", "Pricing", "Images", "Review"];
  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-24">
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between"><div><Button variant="ghost" size="sm" onClick={() => router.push("/products")}><ArrowLeft />Products</Button><h1 className="mt-2 text-2xl font-semibold">Create complete product</h1><p className="text-sm text-muted-foreground">Configure the sellable catalog item once—variants, prices, images and permanent barcodes are saved together.</p></div><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="animate-spin" /> : <PackagePlus />}Create product</Button></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{sectionNav.map((name, i) => <a key={name} href={`#section-${i}`} className="whitespace-nowrap rounded-full border px-3 py-2 text-sm hover:bg-muted">{i + 1}. {name}</a>)}</div>

    <Card id="section-0"><CardHeader><CardTitle>Basic information</CardTitle><CardDescription>Identity and shared rules inherited by every sellable variant.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Field label="Product code *"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="PHONE-001" /></Field><Field label="Product name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fiyora Phone Pro" /></Field>
      <Field label="Category *"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Select category</option>{categoryOptions.map(({ category, label }) => <option key={category.id} value={category.id}>{label}</option>)}</select></Field>
      <Field label="Unit *"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}><option value="">Select unit</option>{(units.data?.content ?? []).filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.symbol})</option>)}</select></Field>
      <Field label="Brand"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}><option value="">No brand</option>{(brands.data?.content ?? []).filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Tax"><select className="h-10 w-full rounded-md border bg-background px-3" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}><option value="">No tax</option>{(taxes.data?.content ?? []).filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.name} ({x.taxPercentage}%)</option>)}</select></Field>
      <Field label="Description" className="md:col-span-2 lg:col-span-3"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></Field>
      <Toggle checked={form.hasVariants} onChange={(v) => setForm({ ...form, hasVariants: v })} label="This product has variants" note="Each selected combination receives its own SKU, stock, price and barcode." /><Toggle checked={form.trackInventory} onChange={(v) => setForm({ ...form, trackInventory: v })} label="Track inventory" note="Maintain stock by exact SKU and location." /><Toggle checked={form.allowNegativeStock} onChange={(v) => setForm({ ...form, allowNegativeStock: v })} label="Allow negative stock" note="Use only for pre-orders or controlled exceptions." />
    </CardContent></Card>

    <Card id="section-1"><CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="size-5" />Variant combinations</CardTitle><CardDescription>Select category options, generate combinations, then disable combinations you do not sell.</CardDescription></CardHeader><CardContent className="space-y-5">{!form.hasVariants ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Simple product—one sellable SKU and one automatic barcode.</p> : variantAttributes.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Choose a category with variant attributes, or configure them in Master Data → Categories.</p> : <>{variantAttributes.map((a) => <div key={a.id}><div className="mb-2 flex items-center gap-2 font-medium">{a.name}{a.required && <Badge>Required</Badge>}</div><div className="flex flex-wrap gap-2">{a.options.filter((o) => o.isActive).map((o) => { const checked = selected[a.id]?.has(o.value) ?? false; return <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3"><Checkbox checked={checked} onCheckedChange={(v) => setSelected((current) => { const next = { ...current, [a.id]: new Set(current[a.id] ?? []) }; if (v) next[a.id].add(o.value); else next[a.id].delete(o.value); return next; })} />{o.value}</label>; })}</div></div>)}<Button variant="secondary" onClick={generate}><Sparkles />Generate combinations</Button><div className="grid gap-2">{combinations.map((combo, index) => <div key={combo.key} className="grid items-center gap-3 rounded-lg border p-3 md:grid-cols-[auto_1fr_1fr]"><Checkbox checked={combo.enabled} onCheckedChange={(v) => setCombinations((rows) => rows.map((r, i) => i === index ? { ...r, enabled: !!v } : r))} /><div className="flex flex-wrap gap-1">{combo.values.map((v) => <Badge variant="outline" key={`${v.attributeId}-${v.value}`}>{v.value}</Badge>)}</div><Input value={combo.sku} onChange={(e) => setCombinations((rows) => rows.map((r, i) => i === index ? { ...r, sku: e.target.value } : r))} /></div>)}</div></>}</CardContent></Card>

    <Card id="section-2"><CardHeader><CardTitle>Variant pricing</CardTitle><CardDescription>Cost price and selling price are compulsory for all active price lists on every sellable variant.</CardDescription></CardHeader><CardContent className="space-y-4">{activePriceLists.length === 0 ? <p className="text-sm text-destructive">No active price list exists. Configure one before creating a sellable product.</p> : (form.hasVariants ? combinations.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.values.map((v) => v.value).join(" / ") })) : [{ key: "simple", label: form.name || "Simple product" }]).map((item) => <div key={item.key} className="rounded-lg border"><div className="border-b bg-muted/30 px-4 py-3 font-medium">{item.label}</div>{activePriceLists.map((list) => { const key = moneyKey(item.key, list.id); const row = prices[key] ?? { costPrice: "", sellingPrice: "", mrp: "" }; return <div key={list.id} className="grid gap-3 border-b p-4 last:border-0 md:grid-cols-[1fr_repeat(3,minmax(120px,1fr))]"><div><div className="font-medium">{list.name} <span className="text-destructive">*</span></div>{list.isDefault && <span className="text-xs text-muted-foreground">Default price list</span>}</div><Field label="Cost *"><Input type="number" min="0.01" step="0.01" value={row.costPrice} onChange={(e) => updateMoney(key,"costPrice",e.target.value)} /></Field><Field label="Selling *"><Input type="number" min="0.01" step="0.01" value={row.sellingPrice} onChange={(e) => updateMoney(key,"sellingPrice",e.target.value)} /></Field><Field label="MRP"><Input type="number" min="0" step="0.01" value={row.mrp} onChange={(e) => updateMoney(key,"mrp",e.target.value)} /></Field></div>; })}</div>)}</CardContent></Card>

    <Card id="section-3"><CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="size-5" />Product images</CardTitle><CardDescription>Upload multiple images now. The first image becomes the catalog image; files are stored in configured object storage.</CardDescription></CardHeader><CardContent><label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/30"><ImagePlus className="size-8 text-muted-foreground" /><span className="font-medium">Drop images here or choose files</span><span className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · maximum 10 MB each</span><Input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFiles((current) => [...current, ...Array.from(e.target.files ?? [])])} /></label><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map((file, index) => <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-lg border"><img src={URL.createObjectURL(file)} alt="" className="aspect-square w-full object-cover" /><Button variant="destructive" size="icon" className="absolute right-2 top-2" onClick={() => setFiles((rows) => rows.filter((_, i) => i !== index))}><Trash2 /></Button><div className="truncate p-2 text-xs">{index === 0 && <Badge className="mr-1">Primary</Badge>}{file.name}</div></div>)}</div></CardContent></Card>

    <Card id="section-4"><CardHeader><CardTitle>Review and create</CardTitle><CardDescription>The backend saves the product, selected variants, prices and permanent CODE128 barcodes atomically. Images upload immediately afterward with individual failure reporting.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Product" value={form.name || "Not named"} /><Summary label="Sellable SKUs" value={String(form.hasVariants ? combinations.filter((c) => c.enabled).length : 1)} /><Summary label="Images" value={String(files.length)} /><Summary label="Barcodes" value="Automatic per SKU" /><div className="sm:col-span-2 lg:col-span-4"><Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Make available immediately" note="Turn this off if catalog preparation is incomplete." /></div></CardContent></Card>
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur lg:left-80"><div className="mx-auto flex max-w-7xl items-center justify-between"><span className="text-sm text-muted-foreground">{form.hasVariants ? combinations.filter((c) => c.enabled).length : 1} sellable SKU(s)</span><Button size="lg" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="animate-spin" /> : <Check />}Create complete product</Button></div></div>
  </div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <label className={`flex flex-col gap-1.5 text-sm font-medium ${className}`}><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (value: boolean) => void; label: string; note: string }) { return <label className="flex min-h-20 cursor-pointer gap-3 rounded-lg border p-3"><Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} /><span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{note}</span></span></label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
