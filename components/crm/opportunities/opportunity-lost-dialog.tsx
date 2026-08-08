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
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { LossReason, Opportunity } from "@/lib/types/crm";

const LOSS_REASONS: LossReason[] = ["PRICE", "COMPETITOR", "NO_BUDGET", "NO_RESPONSE", "REQUIREMENT_CHANGED", "TIMING", "NOT_INTERESTED", "OTHER"];

interface LostForm {
  lossReason: LossReason;
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
  const form = useForm<LostForm>({ defaultValues: { lossReason: "PRICE", competitor: "", notes: "" } });

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
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Loss Reason</label>
            <Select items={Object.fromEntries(LOSS_REASONS.map((r) => [r, r.replaceAll("_", " ")]))} value={form.watch("lossReason")} onValueChange={(v) => form.setValue("lossReason", v as LossReason)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((r) => <SelectItem key={r} value={r}>{r.replaceAll("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Competitor (optional)</label>
            <Input {...form.register("competitor")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Textarea {...form.register("notes")} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Mark Lost
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
