import { verifySession } from "@/lib/dal";
import { ProductEditWorkspace } from "@/components/products/product-edit-workspace";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const session = await verifySession(); return <ProductEditWorkspace productId={Number(id)} companyId={session.companyId} />; }
