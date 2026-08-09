"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import type { Product, Variant } from "@/lib/types/product";

export type CustomSetItem = {
  id?: number;
  productId: number;
  productVariantId?: number | null;
  quantity: number;
};

export type CustomSet = {
  id?: number;
  productId: number;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  items: CustomSetItem[];
};

export function ProductSetTab({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);
  const [editingSet, setEditingSet] = React.useState<CustomSet | null>(null);
  const [setName, setSetName] = React.useState("");
  const [setCode, setSetCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [variantQtys, setVariantQtys] = React.useState<Record<number, number>>({});

  const customSetsQuery = useQuery({
    queryKey: ["product-sets", "product", product.id],
    queryFn: () => apiClient.get<CustomSet[]>(`product-sets?productId=${product.id}`),
  });

  const variantsQuery = useQuery({
    queryKey: ["products", product.id, "variants"],
    queryFn: () => apiClient.get<Variant[]>(`products/${product.id}/variants`),
  });

  const variants = variantsQuery.data ?? [];
  const customSets = customSetsQuery.data ?? [];

  const handleOpenNew = () => {
    setEditingSet(null);
    setSetName("");
    setSetCode(`${product.code}-SET-${customSets.length + 1}`);
    setDescription("");
    const initialMap: Record<number, number> = {};
    for (const v of variants) {
      initialMap[v.id] = 1;
    }
    setVariantQtys(initialMap);
    setIsOpen(true);
  };

  const handleEdit = (set: CustomSet) => {
    setEditingSet(set);
    setSetName(set.name);
    setSetCode(set.code);
    setDescription(set.description ?? "");
    const map: Record<number, number> = {};
    for (const v of variants) {
      const match = set.items.find((i) => i.productVariantId === v.id);
      map[v.id] = match ? match.quantity : 0;
    }
    setVariantQtys(map);
    setIsOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!setName.trim() || !setCode.trim()) {
        throw new Error("Set name and code are required");
      }
      const setItems = Object.entries(variantQtys)
        .map(([vIdStr, qty]) => ({
          productId: product.id,
          productVariantId: Number(vIdStr),
          quantity: qty,
        }))
        .filter((i) => i.quantity > 0);

      if (setItems.length === 0) {
        throw new Error("Set must include at least 1 unit in quantity breakdown");
      }

      const body = {
        productId: product.id,
        name: setName.trim(),
        code: setCode.trim(),
        description: description.trim() || null,
        isActive: true,
        items: setItems,
      };

      if (editingSet?.id) {
        return apiClient.put<CustomSet>(`product-sets/${editingSet.id}`, body);
      }
      return apiClient.post<CustomSet>("product-sets", body);
    },
    onSuccess: () => {
      toast.success(editingSet ? "Custom Set updated" : "Custom Set created");
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["product-sets", "product", product.id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save Custom Set"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`product-sets/${id}`),
    onSuccess: () => {
      toast.success("Custom Set deleted");
      queryClient.invalidateQueries({ queryKey: ["product-sets", "product", product.id] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-primary">
              <Layers className="h-5 w-5" /> Configured Custom Sets
            </CardTitle>
            <CardDescription>
              Define custom variant quantity packs for <strong>{product.name}</strong> to use in POS sales and purchasing.
            </CardDescription>
          </div>
          <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> + Add Custom Set
          </Button>
        </CardHeader>
        <CardContent>
          {customSetsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading custom sets...
            </div>
          ) : customSets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No Custom Sets created for this product yet. Click <strong>+ Add Custom Set</strong> above to create one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set Code</TableHead>
                  <TableHead>Set Name</TableHead>
                  <TableHead>Total Pcs/Set</TableHead>
                  <TableHead>Variant Composition Breakdown</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customSets.map((set) => {
                  const totalPcs = set.items.reduce((sum, item) => sum + item.quantity, 0);
                  const breakdown = set.items
                    .map((item) => {
                      const variant = variants.find((v) => v.id === item.productVariantId);
                      return `${variant?.variantName || variant?.sku || `Variant #${item.productVariantId}`}: ${item.quantity} pcs`;
                    })
                    .join(" • ");

                  return (
                    <TableRow key={set.id}>
                      <TableCell className="font-mono font-bold text-xs">{set.code}</TableCell>
                      <TableCell className="font-semibold">{set.name}</TableCell>
                      <TableCell className="font-bold text-primary">{totalPcs} pcs</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{breakdown}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(set)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => set.id && deleteMutation.mutate(set.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSet ? "Edit Custom Set" : "Create Custom Set"}</DialogTitle>
            <DialogDescription>
              Configure variant quantities for <strong>{product.name}</strong> in this Set.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Set Code *</Label>
                <Input value={setCode} onChange={(e) => setSetCode(e.target.value)} placeholder="SET-FULL" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Set Name *</Label>
                <Input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Full Size Pack" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Variant Quantities Per Set</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                {variants.length === 0 ? (
                  <div className="text-xs text-muted-foreground">This product has no variants. Set will use 1 base unit.</div>
                ) : (
                  variants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between border-b pb-2 text-xs">
                      <div>
                        <span className="font-bold">{v.variantName || v.sku}</span>
                        <span className="block text-[10px] text-muted-foreground font-mono">{v.sku}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={variantQtys[v.id] ?? 0}
                          onChange={(e) => {
                            const qty = Math.max(0, Number(e.target.value) || 0);
                            setVariantQtys((prev) => ({ ...prev, [v.id]: qty }));
                          }}
                          className="w-20 h-8 text-xs text-right"
                        />
                        <span className="text-muted-foreground text-[11px]">pcs</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />}
              Save Custom Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
