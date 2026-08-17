"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveBadge } from "@/components/shared/active-badge";
import { apiClient } from "@/lib/api-client";
import type { Product } from "@/lib/types/product";
import { ProductOverviewTab } from "@/components/products/product-overview-tab";
import { ProductVariantsTab } from "@/components/products/product-variants-tab";
import { ProductPricingTab } from "@/components/products/product-pricing-tab";
import { ProductImagesTab } from "@/components/products/product-images-tab";
import { ProductBarcodesTab } from "@/components/products/product-barcodes-tab";
import { ProductPurchaseHistoryTab } from "@/components/products/product-purchase-history-tab";
import { ProductSetTab } from "@/components/products/product-set-tab";

export function ProductDetailClient({
  productId,
  companyId,
}: {
  productId: number;
  companyId: number;
}) {
  const productQuery = useQuery({
    queryKey: ["products", productId],
    queryFn: () => apiClient.get<Product>(`products/${productId}`),
  });

  if (productQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading product...</p>;
  }
  if (!productQuery.data) {
    return <p className="text-sm text-destructive">Product not found.</p>;
  }

  const product = productQuery.data;
  const isSetProduct = product.productType === "SET";

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
      <Button
        variant="ghost"
        className="w-fit gap-1.5 px-2 text-xs sm:text-sm"
        nativeButton={false}
        render={<Link href="/products" />}
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Button>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl break-words min-w-0 leading-snug">
            {product.name}
          </h1>
          <ActiveBadge isActive={product.isActive} className="shrink-0" />
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full min-w-0">
        <div className="overflow-x-auto pb-1 border-b scrollbar-none max-w-full">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full sm:w-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-3">Overview</TabsTrigger>
            {product.hasVariants && <TabsTrigger value="variants" className="text-xs sm:text-sm px-3">Variants</TabsTrigger>}
            <TabsTrigger value="sets" className="text-xs sm:text-sm px-3">Custom Sets</TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs sm:text-sm px-3">Pricing</TabsTrigger>
            <TabsTrigger value="images" className="text-xs sm:text-sm px-3">Images</TabsTrigger>
            <TabsTrigger value="barcodes" className="text-xs sm:text-sm px-3">Barcodes</TabsTrigger>
            <TabsTrigger value="purchase-history" className="text-xs sm:text-sm px-3 whitespace-nowrap">Purchase History & Suppliers</TabsTrigger>
          </TabsList>
        </div>

        <div className="pt-3">
          <TabsContent value="overview">
            <ProductOverviewTab product={product} />
          </TabsContent>

          {product.hasVariants && (
            <TabsContent value="variants">
              <ProductVariantsTab productId={product.id} categoryId={product.categoryId} productCode={product.code} />
            </TabsContent>
          )}

          <TabsContent value="sets">
            <ProductSetTab product={product} />
          </TabsContent>

          <TabsContent value="pricing">
            <ProductPricingTab productId={product.id} companyId={companyId} hasVariants={product.hasVariants} />
          </TabsContent>
          <TabsContent value="images">
            <ProductImagesTab productId={product.id} />
          </TabsContent>
          <TabsContent value="barcodes">
            <ProductBarcodesTab productId={product.id} />
          </TabsContent>
          <TabsContent value="purchase-history">
            <ProductPurchaseHistoryTab productId={product.id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
