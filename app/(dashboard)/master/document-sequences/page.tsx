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
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#1a1c1c] dark:text-white sm:text-3xl">
          Document Sequences
        </h1>
        <p className="mt-1 text-xs text-[#545f73] dark:text-[#a3cfcf] sm:text-sm">
          Numbering series for invoices, purchase orders, and other documents. Changing these
          affects real document numbers going forward.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DOCUMENT_TYPES.map((type) => {
          const configured = configuredByType.get(type);
          return (
            <div
              key={type}
              className="flex flex-col gap-3 rounded-2xl border border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c] p-5 shadow-xs hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[#1a1c1c] dark:text-white">
                    {DOCUMENT_TYPE_LABELS[type] ?? type}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#545f73] dark:text-[#a3cfcf]">
                    {configured ? (
                      <span className="font-mono">{configured.nextFormattedNumber}</span>
                    ) : (
                      "Not configured -- using backend defaults"
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl text-[#545f73] hover:bg-[#f3f4f3] hover:text-[#1a1c1c] dark:text-[#a3cfcf] dark:hover:bg-[#2f3131] sm:size-8"
                  aria-label="Edit sequence"
                  onClick={() => setEditingType(type)}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
              {configured && (
                <span className="inline-flex w-fit items-center rounded-full border border-[#e2e2e2] dark:border-[#404848] px-2.5 py-0.5 text-[11px] font-semibold text-[#545f73] dark:text-[#a3cfcf]">
                  Padding {configured.padding}
                </span>
              )}
            </div>
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
