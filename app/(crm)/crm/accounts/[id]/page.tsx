import { AccountDetailClient } from "@/components/crm/accounts/account-detail-client";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountDetailClient accountId={Number(id)} />;
}
