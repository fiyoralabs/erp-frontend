"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { opportunitySchema, type OpportunityFormValues } from "@/lib/validation/crm";
import type { Opportunity, Pipeline } from "@/lib/types/crm";
import { UserSelect, useCurrentUser } from "@/components/crm/shared/user-select";

const EMPTY: OpportunityFormValues = {
  name: "", accountId: undefined as unknown as number, primaryContactId: undefined,
  pipelineId: undefined as unknown as number, stageId: undefined as unknown as number,
  amount: undefined as unknown as number, probability: undefined, expectedCloseDate: "",
  leadSourceId: undefined, assignedUserId: undefined, locationId: undefined, competitor: "", description: "",
};

function toFormValues(o: Opportunity): OpportunityFormValues {
  return {
    name: o.name, accountId: o.accountId, primaryContactId: o.primaryContactId ?? undefined,
    pipelineId: o.pipelineId, stageId: o.stageId, amount: o.amount, probability: o.probability,
    expectedCloseDate: o.expectedCloseDate ?? "", leadSourceId: o.leadSourceId ?? undefined,
    assignedUserId: o.assignedUserId ?? undefined, locationId: o.locationId ?? undefined,
    competitor: o.competitor ?? "", description: o.description ?? "",
  };
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function OpportunityDialog({
  open, onOpenChange, opportunity, defaultAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity;
  defaultAccountId?: number;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!opportunity;

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines"),
    enabled: open,
  });

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: opportunity ? toFormValues(opportunity) : { ...EMPTY, accountId: defaultAccountId ?? (undefined as unknown as number) },
  });

  React.useEffect(() => {
    if (open) form.reset(opportunity ? toFormValues(opportunity) : { ...EMPTY, accountId: defaultAccountId ?? (undefined as unknown as number) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opportunity]);

  // New opportunities default to "assigned to me" -- editing an existing
  // one never overrides whatever it's already assigned to.
  const currentUserQuery = useCurrentUser();
  React.useEffect(() => {
    if (open && !isEdit && currentUserQuery.data && form.getValues("assignedUserId") === undefined) {
      form.setValue("assignedUserId", currentUserQuery.data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, currentUserQuery.data]);

  const pipelineId = form.watch("pipelineId");
  const stages = pipelinesQuery.data?.find((p) => p.id === pipelineId)?.stages ?? [];

  const mutation = useMutation({
    mutationFn: (values: OpportunityFormValues) => isEdit
      ? apiClient.put<Opportunity>(`crm/opportunities/${opportunity!.id}`, values)
      : apiClient.post<Opportunity>("crm/opportunities", values),
    onSuccess: (saved) => {
      toast.success(isEdit ? "Opportunity updated." : "Opportunity created.");
      qc.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      onOpenChange(false);
      if (!isEdit) router.push(`/crm/opportunities/${saved.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Opportunity" : "New Opportunity"}</DialogTitle>
          <DialogDescription>Deal details, pipeline and stage.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Opportunity Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="accountId" render={({ field }) => (
                <FormItem><FormLabel>Account ID</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="primaryContactId" render={({ field }) => (
                <FormItem><FormLabel>Primary Contact ID</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="pipelineId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pipeline</FormLabel>
                  <Select
                    items={Object.fromEntries((pipelinesQuery.data ?? []).map((p) => [String(p.id), p.name]))}
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => { field.onChange(v ? Number(v) : undefined); form.setValue("stageId", undefined as unknown as number); }}
                  >
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select pipeline" /></SelectTrigger></FormControl>
                    <SelectContent>{(pipelinesQuery.data ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stageId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select items={Object.fromEntries(stages.map((s) => [String(s.id), s.name]))} value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select stage" /></SelectTrigger></FormControl>
                    <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem><FormLabel>Amount</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="expectedCloseDate" render={({ field }) => (
                <FormItem><FormLabel>Expected Close Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="assignedUserId" render={({ field }) => (
              <FormItem><FormLabel>Assigned Salesperson</FormLabel><FormControl>
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
