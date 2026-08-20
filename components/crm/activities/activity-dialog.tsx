"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { activitySchema, type ActivityFormValues } from "@/lib/validation/crm";
import type { ActivityType, RelatedEntityType } from "@/lib/types/crm";
import { UserSelect, useCurrentUser } from "@/components/crm/shared/user-select";
import { AccountSelect } from "@/components/crm/shared/account-select";
import { ContactSelect } from "@/components/crm/shared/contact-select";

const TYPE_LABELS: Record<ActivityType, string> = {
  CALL: "Call", MEETING: "Meeting", EMAIL: "Email", WHATSAPP: "WhatsApp", SMS: "SMS",
  NOTE: "Note", VISIT: "Visit", DEMO: "Demo", PROPOSAL: "Proposal", OTHER: "Other",
};

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function ActivityDialog({
  open, onOpenChange, relatedType: propRelatedType, relatedId: propRelatedId, defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedType?: RelatedEntityType;
  relatedId?: number;
  defaultType?: ActivityType;
}) {
  const qc = useQueryClient();
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      relatedType: propRelatedType ?? "LEAD",
      relatedId: propRelatedId ?? undefined,
      type: defaultType ?? "NOTE",
      subject: "",
      description: "",
      assignedUserId: undefined,
      startAt: "",
      endAt: "",
      outcome: "",
      direction: undefined,
      phoneNumber: "",
      durationSeconds: undefined,
      meetingUrl: "",
      location: "",
      pinned: false,
    },
  });

  const currentUserQuery = useCurrentUser();
  
  React.useEffect(() => {
    if (open) {
      form.reset({
        relatedType: propRelatedType ?? "LEAD",
        relatedId: propRelatedId ?? undefined,
        type: defaultType ?? "NOTE",
        subject: "",
        description: "",
        assignedUserId: currentUserQuery.data?.id,
        startAt: "",
        endAt: "",
        outcome: "",
        direction: undefined,
        phoneNumber: "",
        durationSeconds: undefined,
        meetingUrl: "",
        location: "",
        pinned: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propRelatedType, propRelatedId, defaultType, currentUserQuery.data]);

  const leadsQuery = useQuery({
    queryKey: ["crm", "leads", "all-select"],
    queryFn: () => apiClient.get<PagedResult<any>>("crm/leads?page=0&size=200"),
    enabled: open && !propRelatedId,
  });

  const oppsQuery = useQuery({
    queryKey: ["crm", "opportunities", "all-select"],
    queryFn: () => apiClient.get<PagedResult<any>>("crm/opportunities?page=0&size=200"),
    enabled: open && !propRelatedId,
  });

  const leads = leadsQuery.data?.content ?? [];
  const leadsItems = React.useMemo(() => {
    const map: Record<string, string> = {};
    leads.forEach((l) => { map[String(l.id)] = l.fullName; });
    return map;
  }, [leads]);

  const opps = oppsQuery.data?.content ?? [];
  const oppsItems = React.useMemo(() => {
    const map: Record<string, string> = {};
    opps.forEach((o) => { map[String(o.id)] = o.name; });
    return map;
  }, [opps]);

  const mutation = useMutation({
    mutationFn: (values: ActivityFormValues) => apiClient.post("crm/activities", {
      ...values,
      startAt: values.startAt ? new Date(values.startAt).toISOString() : null,
      endAt: values.endAt ? new Date(values.endAt).toISOString() : null,
    }),
    onSuccess: () => {
      toast.success("Activity logged.");
      if (propRelatedType && propRelatedId) {
        qc.invalidateQueries({ queryKey: ["crm", "activities", propRelatedType, propRelatedId] });
        qc.invalidateQueries({ queryKey: ["crm", "timeline", propRelatedType, propRelatedId] });
      }
      qc.invalidateQueries({ queryKey: ["crm", "activities", "all"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const type = form.watch("type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
          <DialogDescription>Record a call, meeting, note or other interaction.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            
            {!propRelatedId && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-b pb-4 mb-2">
                <FormField control={form.control} name="relatedType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related To Type</FormLabel>
                    <Select
                      items={{ LEAD: "Lead", CONTACT: "Contact", ACCOUNT: "Account", OPPORTUNITY: "Opportunity" }}
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("relatedId", undefined as any);
                      }}
                    >
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="LEAD">Lead</SelectItem>
                        <SelectItem value="CONTACT">Contact</SelectItem>
                        <SelectItem value="ACCOUNT">Account</SelectItem>
                        <SelectItem value="OPPORTUNITY">Opportunity</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="relatedId" render={({ field }) => {
                  const currentRelatedType = form.watch("relatedType");
                  return (
                    <FormItem>
                      <FormLabel>Related Entity</FormLabel>
                      <FormControl>
                        {currentRelatedType === "ACCOUNT" ? (
                          <AccountSelect
                            value={field.value}
                            onChange={(id) => field.onChange(id)}
                            allowNone={false}
                          />
                        ) : currentRelatedType === "CONTACT" ? (
                          <ContactSelect
                            value={field.value}
                            onChange={(id) => field.onChange(id)}
                            allowNone={false}
                          />
                        ) : currentRelatedType === "LEAD" ? (
                          <Select
                            items={leadsItems}
                            value={field.value ? String(field.value) : ""}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={leadsQuery.isLoading ? "Loading leads..." : "Select lead"} />
                            </SelectTrigger>
                            <SelectContent>
                              {leads.map((l) => (
                                <SelectItem key={l.id} value={String(l.id)}>{l.fullName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : currentRelatedType === "OPPORTUNITY" ? (
                          <Select
                            items={oppsItems}
                            value={field.value ? String(field.value) : ""}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={oppsQuery.isLoading ? "Loading deals..." : "Select deal"} />
                            </SelectTrigger>
                            <SelectContent>
                              {opps.map((o) => (
                                <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-muted-foreground pt-2">Please select type first</div>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }} />
              </div>
            )}

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select items={TYPE_LABELS} value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {type === "CALL" && (
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {type === "MEETING" && (
              <FormField control={form.control} name="meetingUrl" render={({ field }) => (
                <FormItem><FormLabel>Meeting URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="startAt" render={({ field }) => (
                <FormItem><FormLabel>Start</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endAt" render={({ field }) => (
                <FormItem><FormLabel>End</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="assignedUserId" render={({ field }) => (
              <FormItem><FormLabel>Attended By</FormLabel><FormControl>
                <UserSelect value={field.value} onChange={field.onChange} allowUnassigned={false} />
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
