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
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        className="w-fit gap-1.5 px-2"
        nativeButton={false}
        render={<Link href="/products" />}
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">{product.name}</h1>
        <ActiveBadge isActive={product.isActive} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {product.hasVariants && <TabsTrigger value="variants">Variants</TabsTrigger>}
          <TabsTrigger value="sets">Custom Sets</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="barcodes">Barcodes</TabsTrigger>
          <TabsTrigger value="purchase-history">Purchase History & Suppliers</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
