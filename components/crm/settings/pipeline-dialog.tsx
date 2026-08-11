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
import { pipelineSchema, type PipelineFormValues } from "@/lib/validation/crm";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function PipelineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const form = useForm<PipelineFormValues>({ resolver: zodResolver(pipelineSchema), defaultValues: { name: "", isDefault: false, active: true } });

  const mutation = useMutation({
    mutationFn: (values: PipelineFormValues) => apiClient.post("crm/pipelines", values),
    onSuccess: () => {
      toast.success("Pipeline created. Add stages next.");
      qc.invalidateQueries({ queryKey: ["crm", "pipelines"] });
      onOpenChange(false);
      form.reset({ name: "", isDefault: false, active: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Pipeline</DialogTitle>
          <DialogDescription>e.g. Retail Sales, Enterprise Sales, Partnership.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={form.watch("isDefault")} onCheckedChange={(v) => form.setValue("isDefault", !!v)} />
              Set as default pipeline
            </label>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
