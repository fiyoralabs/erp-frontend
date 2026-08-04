import { verifySession } from "@/lib/dal";
import { ProductDetailClient } from "@/components/products/product-detail-client";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();
  return <ProductDetailClient productId={Number(id)} companyId={session.companyId} />;
}
