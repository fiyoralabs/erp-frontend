"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Opportunity } from "@/lib/types/crm";

interface WonForm {
  wonDate: string;
  finalAmount: number | undefined;
  notes: string;
  createCustomer: boolean;
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function OpportunityWonDialog({ open, onOpenChange, opportunity }: { open: boolean; onOpenChange: (open: boolean) => void; opportunity: Opportunity }) {
  const qc = useQueryClient();
  const form = useForm<WonForm>({ defaultValues: { wonDate: new Date().toISOString().slice(0, 10), finalAmount: opportunity.amount, notes: "", createCustomer: true } });

  const mutation = useMutation({
    mutationFn: (values: WonForm) => apiClient.post<Opportunity>(`crm/opportunities/${opportunity.id}/won`, {
      wonDate: values.wonDate || null, finalAmount: values.finalAmount ?? null, notes: values.notes || null, createCustomer: values.createCustomer,
    }),
    onSuccess: () => {
      toast.success("Opportunity marked as Won.");
      qc.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Opportunity Won</DialogTitle>
          <DialogDescription>Confirm the final deal amount and won date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Won Date</label>
              <Input type="date" {...form.register("wonDate")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Final Amount</label>
              <Input type="number" {...form.register("finalAmount", { valueAsNumber: true })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Textarea {...form.register("notes")} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={form.watch("createCustomer")} onCheckedChange={(v) => form.setValue("createCustomer", !!v)} />
            Create/link ERP Customer if not already linked
          </label>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Mark Won
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
