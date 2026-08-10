"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { pipelineStageSchema, type PipelineStageFormValues } from "@/lib/validation/crm";
import type { PipelineStage } from "@/lib/types/crm";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function PipelineStageDialog({
  open, onOpenChange, pipelineId, stage, nextSequence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: number;
  stage?: PipelineStage;
  nextSequence: number;
}) {
  const qc = useQueryClient();
  const isEdit = !!stage;
  const form = useForm<PipelineStageFormValues>({
    resolver: zodResolver(pipelineStageSchema),
    defaultValues: stage
      ? { name: stage.name, sequence: stage.sequence, probability: stage.probability, color: stage.color ?? "", isWon: stage.isWon, isLost: stage.isLost, active: stage.active }
      : { name: "", sequence: nextSequence, probability: 10, color: "", isWon: false, isLost: false, active: true },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(stage
      ? { name: stage.name, sequence: stage.sequence, probability: stage.probability, color: stage.color ?? "", isWon: stage.isWon, isLost: stage.isLost, active: stage.active }
      : { name: "", sequence: nextSequence, probability: 10, color: "", isWon: false, isLost: false, active: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage]);

  const mutation = useMutation({
    mutationFn: (values: PipelineStageFormValues) => isEdit
      ? apiClient.put(`crm/pipelines/${pipelineId}/stages/${stage!.id}`, values)
      : apiClient.post(`crm/pipelines/${pipelineId}/stages`, values),
    onSuccess: () => {
      toast.success("Stage saved.");
      qc.invalidateQueries({ queryKey: ["crm", "pipelines"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Stage" : "Add Stage"}</DialogTitle>
          <DialogDescription>Stages define an opportunity&apos;s progress and default probability.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="sequence" render={({ field }) => (
                <FormItem><FormLabel>Sequence</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="probability" render={({ field }) => (
                <FormItem><FormLabel>Probability %</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="color" render={({ field }) => (
              <FormItem><FormLabel>Color</FormLabel><FormControl>
                <div className="flex items-center gap-2">
                  <span
                    className="size-9 shrink-0 rounded-md border"
                    style={{ backgroundColor: field.value || "transparent" }}
                    aria-hidden
                  />
                  <Input {...field} placeholder="#3730A3" />
                </div>
              </FormControl><FormMessage /></FormItem>
            )} />
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={form.watch("isWon")} onCheckedChange={(v) => form.setValue("isWon", !!v)} />
              This is the Won stage
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={form.watch("isLost")} onCheckedChange={(v) => form.setValue("isLost", !!v)} />
              This is the Lost stage
            </label>
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
