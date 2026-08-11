"use client";

import { useForm } from "react-hook-form";
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
import type { LossReason, Opportunity } from "@/lib/types/crm";

const LOSS_REASONS: LossReason[] = ["PRICE", "COMPETITOR", "NO_BUDGET", "NO_RESPONSE", "REQUIREMENT_CHANGED", "TIMING", "NOT_INTERESTED", "OTHER"];

interface LostForm {
  lossReason: LossReason | "";
  competitor: string;
  notes: string;
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function OpportunityLostDialog({ open, onOpenChange, opportunity }: { open: boolean; onOpenChange: (open: boolean) => void; opportunity: Opportunity }) {
  const qc = useQueryClient();
  const form = useForm<LostForm>({ defaultValues: { lossReason: "", competitor: "", notes: "" } });

  const mutation = useMutation({
    mutationFn: (values: LostForm) => apiClient.post<Opportunity>(`crm/opportunities/${opportunity.id}/lost`, {
      lossReason: values.lossReason, competitor: values.competitor || null, notes: values.notes || null,
    }),
    onSuccess: () => {
      toast.success("Opportunity marked as Lost.");
      qc.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Opportunity Lost</DialogTitle>
          <DialogDescription>A loss reason is required to help improve future deals.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v as { lossReason: LossReason; competitor: string; notes: string }))} className="flex flex-col gap-4">
            <FormField control={form.control} name="lossReason" rules={{ required: true }} render={({ field }) => (
              <FormItem>
                <FormLabel>Loss Reason</FormLabel>
                <Select items={Object.fromEntries(LOSS_REASONS.map((r) => [r, r.replaceAll("_", " ")]))} value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select a reason" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {LOSS_REASONS.map((r) => <SelectItem key={r} value={r}>{r.replaceAll("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="competitor" render={({ field }) => (
              <FormItem><FormLabel>Competitor (optional)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" />}
                Mark Lost
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
