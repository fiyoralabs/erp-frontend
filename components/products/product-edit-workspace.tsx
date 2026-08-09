"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveBadge } from "@/components/shared/active-badge";
import { apiClient } from "@/lib/api-client";
import type { Product } from "@/lib/types/product";
import { ProductOverviewTab } from "./product-overview-tab";
import { ProductVariantsTab } from "./product-variants-tab";
import { ProductPricingTab } from "./product-pricing-tab";
import { ProductImagesTab } from "./product-images-tab";
import { ProductBarcodesTab } from "./product-barcodes-tab";
import { ProductSetTab } from "./product-set-tab";

export function ProductEditWorkspace({ productId, companyId }: { productId: number; companyId: number }) {
  const query = useQuery({ queryKey: ["products", productId], queryFn: () => apiClient.get<Product>(`products/${productId}`) });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading complete product workspace…</p>;
  if (!query.data) return <p className="text-sm text-destructive">Product not found.</p>;
  const p = query.data;
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-16">
      <div>
        <Button variant="ghost" nativeButton={false} render={<Link href={`/products/${productId}`} />}>
          <ArrowLeft />Product
        </Button>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Edit {p.name}</h1>
          <ActiveBadge isActive={p.isActive} />
        </div>
        <p className="text-sm text-muted-foreground">All catalog configuration and custom sets are available on one page.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic information and status</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductOverviewTab product={p} />
        </CardContent>
      </Card>

      {p.hasVariants && (
        <Card>
          <CardHeader>
            <CardTitle>Variant combinations</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductVariantsTab productId={p.id} categoryId={p.categoryId} productCode={p.code} />
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="text-primary font-bold">Custom Product Sets (Quantity Packs & Bundles)</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductSetTab product={p} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price-list pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductPricingTab productId={p.id} companyId={companyId} hasVariants={p.hasVariants} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product images</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImagesTab productId={p.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Barcodes and labels</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductBarcodesTab productId={p.id} />
        </CardContent>
      </Card>
    </div>
  );
}
