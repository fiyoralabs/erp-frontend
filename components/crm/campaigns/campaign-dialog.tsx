"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { campaignSchema, type CampaignFormValues } from "@/lib/validation/crm";
import type { Campaign } from "@/lib/types/crm";
import { UserSelect, useCurrentUser } from "@/components/crm/shared/user-select";

const TYPE_LABELS = { EMAIL: "Email", SOCIAL_MEDIA: "Social Media", ADVERTISEMENT: "Advertisement", EVENT: "Event", REFERRAL: "Referral", WHATSAPP: "WhatsApp", DIGITAL: "Digital", OTHER: "Other" };
const STATUS_LABELS = { PLANNED: "Planned", ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled" };

const EMPTY: CampaignFormValues = {
  name: "", type: "EMAIL", status: "PLANNED", startDate: "", endDate: "", budget: undefined,
  actualCost: undefined, expectedRevenue: undefined, description: "", ownerUserId: undefined,
};

function toFormValues(c: Campaign): CampaignFormValues {
  return {
    name: c.name, type: c.type, status: c.status, startDate: c.startDate ?? "", endDate: c.endDate ?? "",
    budget: c.budget ?? undefined, actualCost: c.actualCost ?? undefined, expectedRevenue: c.expectedRevenue ?? undefined,
    description: c.description ?? "", ownerUserId: c.ownerUserId ?? undefined,
  };
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function CampaignDialog({ open, onOpenChange, campaign }: { open: boolean; onOpenChange: (open: boolean) => void; campaign?: Campaign }) {
  const qc = useQueryClient();
  const isEdit = !!campaign;
  const form = useForm<CampaignFormValues>({ resolver: zodResolver(campaignSchema), defaultValues: campaign ? toFormValues(campaign) : EMPTY });

  React.useEffect(() => { if (open) form.reset(campaign ? toFormValues(campaign) : EMPTY); }, [open, campaign]); // eslint-disable-line react-hooks/exhaustive-deps

  // New campaigns default to "owned by me" -- editing an existing one never
  // overrides whatever it's already owned by.
  const currentUserQuery = useCurrentUser();
  React.useEffect(() => {
    if (open && !isEdit && currentUserQuery.data && form.getValues("ownerUserId") === undefined) {
      form.setValue("ownerUserId", currentUserQuery.data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, currentUserQuery.data]);

  const mutation = useMutation({
    mutationFn: (values: CampaignFormValues) => isEdit
      ? apiClient.put<Campaign>(`crm/campaigns/${campaign!.id}`, values)
      : apiClient.post<Campaign>("crm/campaigns", values),
    onSuccess: () => {
      toast.success(isEdit ? "Campaign updated." : "Campaign created.");
      qc.invalidateQueries({ queryKey: ["crm", "campaigns"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          <DialogDescription>Track marketing spend and results.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select items={TYPE_LABELS} value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select items={STATUS_LABELS} value={field.value ?? "PLANNED"} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="budget" render={({ field }) => (
                <FormItem><FormLabel>Budget</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="actualCost" render={({ field }) => (
                <FormItem><FormLabel>Actual Cost</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="expectedRevenue" render={({ field }) => (
                <FormItem><FormLabel>Expected Revenue</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="ownerUserId" render={({ field }) => (
              <FormItem><FormLabel>Owner</FormLabel><FormControl>
                <UserSelect value={field.value} onChange={field.onChange} />
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
