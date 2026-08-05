import { verifySession } from "@/lib/dal";
import { ProductWorkspace } from "@/components/products/product-workspace";
export default async function NewProductPage() { const session = await verifySession(); return <ProductWorkspace companyId={session.companyId} />; }
