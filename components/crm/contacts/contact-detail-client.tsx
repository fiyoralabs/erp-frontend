"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Phone, Mail, MessageSquare, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";
import type { Contact } from "@/lib/types/crm";
import { ActiveBadge } from "@/components/shared/active-badge";
import { ContactDialog } from "@/components/crm/contacts/contact-dialog";
import { ActivitiesTab } from "@/components/crm/activities/activities-tab";
import { TasksTab } from "@/components/crm/tasks/tasks-tab";
import { FollowUpsTab } from "@/components/crm/shared/follow-ups-tab";
import { CrmTimeline } from "@/components/crm/shared/crm-timeline";
import { ScrollableTabsList } from "@/components/crm/shared/scrollable-tabs";
import { useAccountNameLookup } from "@/components/crm/shared/account-select";

export function ContactDetailClient({ contactId }: { contactId: number }) {
  const [editOpen, setEditOpen] = React.useState(false);

  const contactQuery = useQuery({
    queryKey: ["crm", "contacts", contactId],
    queryFn: () => apiClient.get<Contact>(`crm/contacts/${contactId}`),
  });

  const accountNameById = useAccountNameLookup();

  if (contactQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading contact...</p>;
  const contact = contactQuery.data;
  if (!contact) return <p className="text-sm text-destructive">Contact not found.</p>;

  return (
    <div className="flex flex-col gap-4">
      <Button nativeButton={false} variant="ghost" size="sm" className="w-fit gap-1.5" render={<Link href="/crm/contacts" />}>
        <ArrowLeft className="size-4" /> Back to Contacts
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold sm:text-2xl">{contact.firstName} {contact.lastName}</h1>
                <ActiveBadge isActive={contact.active} />
              </div>
              <p className="text-sm text-muted-foreground">
                {contact.jobTitle ?? ""} {contact.accountId ? <>· <Link className="text-primary hover:underline" href={`/crm/accounts/${contact.accountId}`}>{accountNameById.get(contact.accountId) ?? `Account #${contact.accountId}`}</Link></> : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                {(contact.mobile ?? contact.phone) && (
                  <Button nativeButton={false} variant="ghost" size="sm" className="gap-1.5" render={<a href={`tel:${contact.mobile ?? contact.phone}`} />}>
                    <Phone className="size-4" /> Call
                  </Button>
                )}
                {contact.email && (
                  <Button nativeButton={false} variant="ghost" size="sm" className="gap-1.5" render={<a href={`mailto:${contact.email}`} />}>
                    <Mail className="size-4" /> Email
                  </Button>
                )}
                {contact.whatsappNumber && (
                  <Button nativeButton={false} variant="ghost" size="sm" className="gap-1.5" render={<a href={`https://wa.me/${contact.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" />}>
                    <MessageSquare className="size-4" /> WhatsApp
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="sm:hidden" aria-label="More actions" />}>
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(contact.mobile ?? contact.phone) && (
                    <DropdownMenuItem render={<a href={`tel:${contact.mobile ?? contact.phone}`} className="flex items-center gap-2" />}>
                      <Phone className="size-3.5" /> Call
                    </DropdownMenuItem>
                  )}
                  {contact.email && (
                    <DropdownMenuItem render={<a href={`mailto:${contact.email}`} className="flex items-center gap-2" />}>
                      <Mail className="size-3.5" /> Email
                    </DropdownMenuItem>
                  )}
                  {contact.whatsappNumber && (
                    <DropdownMenuItem render={<a href={`https://wa.me/${contact.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2" />}>
                      <MessageSquare className="size-3.5" /> WhatsApp
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setEditOpen(true)} className="flex items-center gap-2">
                    <Pencil className="size-3.5" /> Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activities" className="w-full">
        <ScrollableTabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full">
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </ScrollableTabsList>
        <TabsContent value="activities"><ActivitiesTab relatedType="CONTACT" relatedId={contact.id} /></TabsContent>
        <TabsContent value="tasks"><TasksTab relatedType="CONTACT" relatedId={contact.id} /></TabsContent>
        <TabsContent value="follow-ups"><FollowUpsTab relatedType="CONTACT" relatedId={contact.id} /></TabsContent>
        <TabsContent value="timeline"><Card><CardContent className="pt-6"><CrmTimeline relatedType="CONTACT" relatedId={contact.id} /></CardContent></Card></TabsContent>
      </Tabs>

      <ContactDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} />
    </div>
  );
}
