"use client";

// erp has no "list valid document types" endpoint -- GET /document-sequences
// only returns types that already have a configured row, which is empty for
// a freshly onboarded company (confirmed live). DOCUMENT_TYPES below is the
// authoritative list, grepped from every real
// masterModule.generateNextDocumentNumber(companyId, "...") call site across
// Sales/Purchase/Expense/Finance. PUT is an upsert (confirmed live: PUT on a
// type with no existing row creates one and returns 200, not 404/409).

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import {
  documentSequenceSchema,
  type DocumentSequenceFormValues,
} from "@/lib/validation/master";
import { DOCUMENT_TYPES, type DocumentSequence } from "@/lib/types/master";

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  SALES_INVOICE: "Sales Invoice",
  SALES_RETURN: "Sales Return",
  PURCHASE_ORDER: "Purchase Order",
  PURCHASE_RETURN: "Purchase Return",
  GOODS_RECEIPT: "Goods Receipt (GRN)",
  EXPENSE: "Expense",
  JOURNAL_ENTRY: "Journal Entry",
};

export default function DocumentSequencesPage() {
  const qc = useQueryClient();
  const [editingType, setEditingType] = React.useState<string | null>(null);

  const configuredQuery = useQuery({
    queryKey: ["master", "document-sequences"],
    queryFn: () => apiClient.get<DocumentSequence[]>("master/document-sequences"),
  });

  const configuredByType = new Map(
    (configuredQuery.data ?? []).map((seq) => [seq.documentType, seq])
  );

  const form = useForm<DocumentSequenceFormValues>({
    resolver: zodResolver(documentSequenceSchema),
    defaultValues: { prefix: "", suffix: "", padding: 6, currentValue: 0, resetFrequency: "NEVER" },
  });

  React.useEffect(() => {
    if (!editingType) return;
    const existing = configuredByType.get(editingType);
    form.reset(
      existing
        ? {
            prefix: existing.prefix,
            suffix: existing.suffix,
            padding: existing.padding,
            currentValue: existing.currentValue,
            resetFrequency: existing.resetFrequency,
          }
        : { prefix: "", suffix: "", padding: 6, currentValue: 0, resetFrequency: "NEVER" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingType]);

  const saveMutation = useMutation({
    mutationFn: ({ type, values }: { type: string; values: DocumentSequenceFormValues }) =>
      apiClient.put<DocumentSequence>(`master/document-sequences/${type}`, values),
    onSuccess: () => {
      toast.success("Document sequence saved");
      qc.invalidateQueries({ queryKey: ["master", "document-sequences"] });
      setEditingType(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Document Sequences</h1>
        <p className="text-sm text-muted-foreground">
          Numbering series for invoices, purchase orders, and other documents. Changing these
          affects real document numbers going forward.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DOCUMENT_TYPES.map((type) => {
          const configured = configuredByType.get(type);
          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="text-base">{DOCUMENT_TYPE_LABELS[type] ?? type}</CardTitle>
                <CardDescription>
                  {configured ? (
                    <span className="font-mono">{configured.nextFormattedNumber}</span>
                  ) : (
                    "Not configured -- using backend defaults"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                {configured ? (
                  <Badge variant="outline">Padding {configured.padding}</Badge>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:size-8"
                  aria-label="Edit sequence"
                  onClick={() => setEditingType(type)}
                >
                  <Pencil className="size-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={editingType !== null} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? DOCUMENT_TYPE_LABELS[editingType] ?? editingType : ""} sequence
            </DialogTitle>
            <DialogDescription>Prefix, suffix, padding, and current counter.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => {
                if (editingType) saveMutation.mutate({ type: editingType, values });
              })}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="INV-" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="suffix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Suffix</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="padding"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Padding</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
