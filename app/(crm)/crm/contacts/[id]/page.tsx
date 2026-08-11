import { ContactDetailClient } from "@/components/crm/contacts/contact-detail-client";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetailClient contactId={Number(id)} />;
}
