"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MessageSquare,
  MoreVertical,
  Building2,
  MapPin,
  User,
  Calendar,
  Briefcase,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { resolveReturnTo } from "@/lib/return-to";
import type { Contact, ContactLinks } from "@/lib/types/crm";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

import { ActiveBadge } from "@/components/shared/active-badge";
import { ContactDialog } from "@/components/crm/contacts/contact-dialog";
import { ContactLinkedLeadsDialog } from "@/components/crm/contacts/contact-linked-leads-dialog";
import { ActivitiesTab } from "@/components/crm/activities/activities-tab";
import { TasksTab } from "@/components/crm/tasks/tasks-tab";
import { FollowUpsTab } from "@/components/crm/shared/follow-ups-tab";
import { CrmTimeline } from "@/components/crm/shared/crm-timeline";
import { ScrollableTabsList } from "@/components/crm/shared/scrollable-tabs";
import { useAccountNameLookup } from "@/components/crm/shared/account-select";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

export function ContactDetailClient({ contactId }: { contactId: number }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = React.useState(false);
  const [linkedRecords, setLinkedRecords] = React.useState<ContactLinks | null>(null);

  const contactQuery = useQuery({
    queryKey: ["crm", "contacts", contactId],
    queryFn: () => apiClient.get<Contact>(`crm/contacts/${contactId}`),
  });

  const accountNameById = useAccountNameLookup();
  const userNameById = useUserNameLookup();

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`crm/contacts/${contactId}`),
    onSuccess: () => {
      toast.success("Contact deleted");
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] });
      router.push("/crm/contacts");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const checkAndDeleteMutation = useMutation({
    mutationFn: () => apiClient.get<ContactLinks>(`crm/contacts/${contactId}/linked-records`),
    onSuccess: (links) => {
      if (links.leads.length > 0 || links.opportunities.length > 0) setLinkedRecords(links);
      else deleteMutation.mutate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (contactQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading contact...</p>;
  const contact = contactQuery.data;
  if (!contact) return <p className="text-sm text-destructive">Contact not found.</p>;

  const initials = `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-20">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1.5 text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
        onClick={() => router.push(resolveReturnTo(searchParams, "/crm/contacts"))}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Contacts
      </Button>

      {/* Hero Contact Card */}
      <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <CardContent className="p-6 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Contact Title & Avatar */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0f3d3e]/10 dark:bg-[#beebeb]/20 text-[#0f3d3e] dark:text-[#beebeb] flex items-center justify-center font-bold text-xl tracking-tight border border-primary/20 shrink-0">
                {initials || "C"}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-heading truncate">
                    {contact.firstName} {contact.lastName}
                  </h1>
                  <ActiveBadge isActive={contact.active} />
                </div>
                <p className="text-xs md:text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                  {contact.jobTitle && <span className="font-medium text-foreground">{contact.jobTitle}</span>}
                  {contact.department && <span>• {contact.department}</span>}
                  {contact.accountId && (
                    <span>
                      • at{" "}
                      <Link
                        className="font-semibold text-primary hover:underline"
                        href={`/crm/accounts/${contact.accountId}`}
                      >
                        {accountNameById.get(contact.accountId) ?? `Account #${contact.accountId}`}
                      </Link>
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Actions Bar: Call, WhatsApp & Edit stay one tap away,
                Email/Delete live behind the overflow menu. flex-wrap keeps
                this from overflowing on narrow phones instead of clipping
                off-screen. */}
            <div className="flex flex-wrap items-center gap-2">
              {(contact.mobile ?? contact.phone) && (
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 gap-1.5 text-xs font-semibold"
                  render={<a href={`tel:${contact.mobile ?? contact.phone}`} />}
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Call
                </Button>
              )}
              {contact.whatsappNumber && (
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 gap-1.5 text-xs font-semibold"
                  render={
                    <a
                      href={`https://wa.me/${contact.whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> WhatsApp
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9 gap-1.5 text-xs font-semibold"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl h-9 w-9 shrink-0"
                      aria-label="More actions"
                    />
                  }
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {contact.email && (
                    <DropdownMenuItem render={<a href={`mailto:${contact.email}`} />}>
                      <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Email
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={checkAndDeleteMutation.isPending || deleteMutation.isPending}
                    onClick={() => checkAndDeleteMutation.mutate()}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                Primary Phone
              </span>
              <span className="text-xs font-semibold text-foreground truncate block font-mono">
                {contact.mobile ?? contact.phone ?? "—"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                Primary Email
              </span>
              <span className="text-xs font-semibold text-foreground truncate block" title={contact.email ?? ""}>
                {contact.email ?? "—"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                City / Location
              </span>
              <span className="text-xs font-semibold text-foreground truncate block">
                {contact.city ? `${contact.city}${contact.country ? `, ${contact.country}` : ""}` : "—"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                Assigned Owner
              </span>
              <span className="text-xs font-semibold text-foreground truncate block">
                {contact.assignedUserId ? userNameById.get(contact.assignedUserId) ?? `User #${contact.assignedUserId}` : "Unassigned"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="activities" className="w-full space-y-4">
        <ScrollableTabsList className="inline-flex h-11 items-center justify-start rounded-2xl bg-muted/60 p-1 text-muted-foreground w-max min-w-full border border-border">
          <TabsTrigger value="activities" className="rounded-xl px-4 py-2 text-xs font-semibold">
            Activities
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-xl px-4 py-2 text-xs font-semibold">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="follow-ups" className="rounded-xl px-4 py-2 text-xs font-semibold">
            Follow-ups
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-xl px-4 py-2 text-xs font-semibold">
            Timeline
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="activities">
          <ActivitiesTab relatedType="CONTACT" relatedId={contact.id} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab relatedType="CONTACT" relatedId={contact.id} />
        </TabsContent>
        <TabsContent value="follow-ups">
          <FollowUpsTab relatedType="CONTACT" relatedId={contact.id} />
        </TabsContent>
        <TabsContent value="timeline">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardContent className="p-6">
              <CrmTimeline relatedType="CONTACT" relatedId={contact.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ContactDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} />

      <ContactLinkedLeadsDialog
        open={!!linkedRecords}
        onOpenChange={(open) => !open && setLinkedRecords(null)}
        contactName={`${contact.firstName} ${contact.lastName ?? ""}`.trim()}
        links={linkedRecords ?? { leads: [], opportunities: [] }}
      />
    </div>
  );
}
