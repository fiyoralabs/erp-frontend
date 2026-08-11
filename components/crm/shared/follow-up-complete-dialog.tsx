"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";

interface CompleteValues {
  outcome: string;
  notes: string;
  nextFollowUpDate: string;
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function FollowUpCompleteDialog({
  open, onOpenChange, followUpId, invalidateKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUpId: number | null;
  invalidateKey: readonly unknown[];
}) {
  const qc = useQueryClient();
  const form = useForm<CompleteValues>({ defaultValues: { outcome: "", notes: "", nextFollowUpDate: "" } });

  const mutation = useMutation({
    mutationFn: (values: CompleteValues) => apiClient.post(`crm/follow-ups/${followUpId}/complete`, {
      outcome: values.outcome || null,
      notes: values.notes || null,
      nextFollowUp: values.nextFollowUpDate ? { followUpDate: values.nextFollowUpDate } : null,
    }),
    onSuccess: () => {
      toast.success("Follow-up completed.");
      qc.invalidateQueries({ queryKey: invalidateKey });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Follow-up</DialogTitle>
          <DialogDescription>Record the outcome and optionally schedule the next follow-up.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <FormField control={form.control} name="outcome" render={({ field }) => (
              <FormItem><FormLabel>Outcome</FormLabel><FormControl><Input {...field} placeholder="e.g. Interested, will decide next week" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="nextFollowUpDate" render={({ field }) => (
              <FormItem><FormLabel>Next Follow-up Date (optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" />}
                Complete
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
