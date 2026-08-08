"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { tagSchema, type TagFormValues } from "@/lib/validation/crm";
import type { CrmTag } from "@/lib/types/crm";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function TagsSettings() {
  const qc = useQueryClient();
  const listQuery = useQuery({ queryKey: ["crm", "tags"], queryFn: () => apiClient.get<CrmTag[]>("crm/tags") });
  const form = useForm<TagFormValues>({ resolver: zodResolver(tagSchema), defaultValues: { name: "", color: "" } });

  const createMutation = useMutation({
    mutationFn: (values: TagFormValues) => apiClient.post<CrmTag>("crm/tags", values),
    onSuccess: () => {
      toast.success("Tag created.");
      qc.invalidateQueries({ queryKey: ["crm", "tags"] });
      form.reset({ name: "", color: "" });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`crm/tags/${id}`),
    onSuccess: () => {
      toast.success("Tag deleted.");
      qc.invalidateQueries({ queryKey: ["crm", "tags"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-end gap-3 pt-6">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Tag name</label>
            <Input {...form.register("name")} placeholder="e.g. VIP, Enterprise, Hot Lead" />
          </div>
          <div className="w-40">
            <label className="text-xs text-muted-foreground">Color (optional)</label>
            <Input {...form.register("color")} placeholder="#3730A3" />
          </div>
          <Button disabled={createMutation.isPending} onClick={form.handleSubmit((v) => createMutation.mutate(v))} className="gap-1.5">
            {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(listQuery.data ?? []).map((tag) => (
          <Badge key={tag.id} variant="outline" className="gap-1.5 py-1.5 pr-1">
            {tag.name}
            <button type="button" onClick={() => deleteMutation.mutate(tag.id)} aria-label={`Delete ${tag.name}`} className="rounded-full p-0.5 hover:bg-muted">
              <Trash2 className="size-3" />
            </button>
          </Badge>
        ))}
        {listQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
      </div>
    </div>
  );
}
