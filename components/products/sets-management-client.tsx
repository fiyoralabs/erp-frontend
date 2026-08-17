"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Layers, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";

export type ProductSetItemDto = {
  id?: number;
  productId: number;
  productVariantId?: number | null;
  quantity: number;
};

export type ProductSetDto = {
  id?: number;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  items: ProductSetItemDto[];
};

export function SetsManagementClient() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [items, setItems] = React.useState<{ productId: string; variantId: string; quantity: string }[]>([
    { productId: "", variantId: "", quantity: "10" }
  ]);

  const setsQuery = useQuery({
    queryKey: ["product-sets"],
    queryFn: () => apiClient.get<ProductSetDto[]>("product-sets"),
  });

  const productsQuery = useQuery({
    queryKey: ["products-minimal"],
    queryFn: () => apiClient.get<any>("products?page=0&size=1000"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !code.trim()) throw new Error("Set name and code are required");
      const formattedItems = items
        .filter(i => i.productId.trim())
        .map(i => ({
          productId: Number(i.productId),
          productVariantId: i.variantId ? Number(i.variantId) : null,
          quantity: Number(i.quantity) || 1,
        }));
      if (formattedItems.length === 0) throw new Error("At least one product item is required in the set");

      return apiClient.post<ProductSetDto>("product-sets", {
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || null,
        isActive: true,
        items: formattedItems,
      });
    },
    onSuccess: () => {
      toast.success("Product set created successfully");
      setIsOpen(false);
      setName("");
      setCode("");
      setDescription("");
      setItems([{ productId: "", variantId: "", quantity: "10" }]);
      queryClient.invalidateQueries({ queryKey: ["product-sets"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to create product set"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`product-sets/${id}`),
    onSuccess: () => {
      toast.success("Product set removed");
      queryClient.invalidateQueries({ queryKey: ["product-sets"] });
    },
  });

  const allProducts = productsQuery.data?.content ?? [];

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary shrink-0" /> Product Sets & Bulk Quantity Packs
          </CardTitle>
          <CardDescription>Configure preset item bundles and bulk quantities for fast wholesale ordering.</CardDescription>
        </div>
        <Button onClick={() => setIsOpen(true)} className="gap-1.5 shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Create Product Set
        </Button>
      </CardHeader>
      <CardContent>
        {setsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Product Sets...
          </div>
        ) : (setsQuery.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No Product Sets configured. Create your first preset set or bulk pack!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set Code</TableHead>
                  <TableHead>Set Name</TableHead>
                  <TableHead>Included Items</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(setsQuery.data ?? []).map((set) => (
                  <TableRow key={set.id}>
                    <TableCell className="font-mono font-bold text-xs">{set.code}</TableCell>
                    <TableCell className="font-semibold">{set.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {set.items.map((i, idx) => `Product #${i.productId} (${i.quantity} pcs)`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => set.id && deleteMutation.mutate(set.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Configure New Product Set</DialogTitle>
              <DialogDescription>Add products/variants and default pack quantities to create a reusable Set.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Set Code *</Label>
                  <Input placeholder="SET-BOX-10" value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Set Name *</Label>
                  <Input placeholder="Bulk Pack (10 pcs)" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Included Items & Quantities</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setItems([...items, { productId: "", variantId: "", quantity: "10" }])}
                  >
                    + Add Item
                  </Button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      className="h-9 flex-1 rounded-md border bg-background px-2 text-xs"
                      value={item.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems(items.map((r, i) => (i === idx ? { ...r, productId: val } : r)));
                      }}
                    >
                      <option value="">Select Product...</option>
                      {allProducts.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      className="w-20 h-9 text-xs"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems(items.map((r, i) => (i === idx ? { ...r, quantity: val } : r)));
                      }}
                    />
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />}
                Save Product Set
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
