import { notFound } from "next/navigation";
import { serverApiGet } from "@/lib/server-api";
import type { Lead } from "@/lib/types/crm";
import { LeadForm } from "@/components/crm/leads/lead-form";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await serverApiGet<Lead>(`crm/leads/${id}`);
  if (!lead) notFound();
  return <LeadForm lead={lead} />;
}
