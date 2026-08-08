"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Lead, LeadConvertResult, Pipeline } from "@/lib/types/crm";

interface ConvertForm {
  createAccount: boolean;
  createContact: boolean;
  createOpportunity: boolean;
  existingAccountId: number | undefined;
  existingContactId: number | undefined;
  opportunityName: string;
  pipelineId: number | undefined;
  stageId: number | undefined;
  expectedValue: number | undefined;
  probability: number | undefined;
  expectedCloseDate: string;
  assignedUserId: number | undefined;
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function LeadConvertDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (open: boolean) => void; lead: Lead }) {
  const router = useRouter();
  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines"),
    enabled: open,
  });

  const form = useForm<ConvertForm>({
    defaultValues: {
      createAccount: true, createContact: true, createOpportunity: true,
      existingAccountId: undefined, existingContactId: undefined,
      opportunityName: `${lead.companyName ?? lead.fullName} Opportunity`,
      pipelineId: undefined, stageId: undefined,
      expectedValue: lead.estimatedDealValue ?? undefined, probability: undefined,
      expectedCloseDate: lead.expectedClosingDate ?? "", assignedUserId: lead.assignedUserId ?? undefined,
    },
  });

  const pipelineId = form.watch("pipelineId");
  const createOpportunity = form.watch("createOpportunity");
  const stages = pipelinesQuery.data?.find((p) => p.id === pipelineId)?.stages ?? [];

  const mutation = useMutation({
    mutationFn: (values: ConvertForm) => apiClient.post<LeadConvertResult>(`crm/leads/${lead.id}/convert`, {
      createAccount: values.createAccount,
      createContact: values.createContact,
      createOpportunity: values.createOpportunity,
      existingAccountId: values.existingAccountId ?? null,
      existingContactId: values.existingContactId ?? null,
      opportunity: values.createOpportunity ? {
        name: values.opportunityName,
        pipelineId: values.pipelineId ?? null,
        stageId: values.stageId ?? null,
        expectedValue: values.expectedValue ?? null,
        probability: values.probability ?? null,
        expectedCloseDate: values.expectedCloseDate || null,
        assignedUserId: values.assignedUserId ?? null,
        products: null,
      } : null,
    }),
    onSuccess: (result) => {
      toast.success("Lead converted successfully.");
      onOpenChange(false);
      if (result.opportunityId) router.push(`/crm/opportunities/${result.opportunityId}`);
      else router.push(`/crm/leads/${lead.id}`);
      router.refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert Lead</DialogTitle>
          <DialogDescription>Create an Account, Contact and Opportunity from this lead.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={form.watch("createAccount")} onCheckedChange={(v) => form.setValue("createAccount", !!v)} />
            Create Account
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={form.watch("createContact")} onCheckedChange={(v) => form.setValue("createContact", !!v)} />
            Create Contact
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={createOpportunity} onCheckedChange={(v) => form.setValue("createOpportunity", !!v)} />
            Create Opportunity
          </label>

          {createOpportunity && (
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <div>
                <label className="text-xs text-muted-foreground">Opportunity Name</label>
                <Input {...form.register("opportunityName")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Pipeline</label>
                  <Select
                    items={Object.fromEntries((pipelinesQuery.data ?? []).map((p) => [String(p.id), p.name]))}
                    value={pipelineId ? String(pipelineId) : ""}
                    onValueChange={(v) => { form.setValue("pipelineId", v ? Number(v) : undefined); form.setValue("stageId", undefined); }}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Default pipeline" /></SelectTrigger>
                    <SelectContent>
                      {(pipelinesQuery.data ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Stage</label>
                  <Select
                    items={Object.fromEntries(stages.map((s) => [String(s.id), s.name]))}
                    value={form.watch("stageId") ? String(form.watch("stageId")) : ""}
                    onValueChange={(v) => form.setValue("stageId", v ? Number(v) : undefined)}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="First stage" /></SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Expected Value</label>
                  <Input type="number" {...form.register("expectedValue", { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Probability %</label>
                  <Input type="number" {...form.register("probability", { valueAsNumber: true })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Expected Close Date</label>
                  <Input type="date" {...form.register("expectedCloseDate")} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Assigned User ID</label>
                  <Input type="number" {...form.register("assignedUserId", { valueAsNumber: true })} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Convert Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
