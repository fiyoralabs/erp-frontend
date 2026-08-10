import { OpportunityDetailClient } from "@/components/crm/opportunities/opportunity-detail-client";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpportunityDetailClient opportunityId={Number(id)} />;
}
