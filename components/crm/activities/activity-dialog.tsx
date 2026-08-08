"use client";

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
import { activitySchema, type ActivityFormValues } from "@/lib/validation/crm";
import type { ActivityType, RelatedEntityType } from "@/lib/types/crm";

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
  open, onOpenChange, relatedType, relatedId, defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedType: RelatedEntityType;
  relatedId: number;
  defaultType?: ActivityType;
}) {
  const qc = useQueryClient();
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      relatedType, relatedId, type: defaultType ?? "NOTE", subject: "", description: "",
      assignedUserId: undefined, startAt: "", endAt: "", outcome: "", direction: undefined,
      phoneNumber: "", durationSeconds: undefined, meetingUrl: "", location: "", pinned: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ActivityFormValues) => apiClient.post("crm/activities", {
      ...values,
      startAt: values.startAt ? new Date(values.startAt).toISOString() : null,
      endAt: values.endAt ? new Date(values.endAt).toISOString() : null,
    }),
    onSuccess: () => {
      toast.success("Activity logged.");
      qc.invalidateQueries({ queryKey: ["crm", "activities", relatedType, relatedId] });
      qc.invalidateQueries({ queryKey: ["crm", "timeline", relatedType, relatedId] });
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startAt" render={({ field }) => (
                <FormItem><FormLabel>Start</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endAt" render={({ field }) => (
                <FormItem><FormLabel>End</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
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
