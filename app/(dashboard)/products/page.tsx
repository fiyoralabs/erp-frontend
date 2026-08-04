import { verifySession } from "@/lib/dal";
import { ProductsListClient } from "@/components/products/products-list-client";

// CreateProductRequest requires a client-supplied companyId (confirmed
// live, matches the production-readiness audit's finding) -- fetched here
// server-side from the verified session rather than trusted from the
// client at all, and passed down as a prop.
export default async function ProductsPage() {
  const session = await verifySession();
  return <ProductsListClient companyId={session.companyId} />;
}
