"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { leadSchema, type LeadFormValues } from "@/lib/validation/crm";
import type { Lead, LeadDuplicate, LeadSource } from "@/lib/types/crm";

const EMPTY_VALUES: LeadFormValues = {
  firstName: "", lastName: "", companyName: "", jobTitle: "", email: "", alternateEmail: "",
  phone: "", alternatePhone: "", whatsappNumber: "", website: "", industry: "", businessType: "",
  numberOfEmployees: undefined, estimatedRevenue: undefined, address: "", city: "", state: "",
  country: "", postalCode: "", leadSourceId: undefined, rating: undefined, estimatedDealValue: undefined,
  expectedClosingDate: "", assignedUserId: undefined, locationId: undefined, campaignId: undefined,
  description: "", notes: "",
};

function toFormValues(lead: Lead): LeadFormValues {
  return {
    firstName: lead.firstName, lastName: lead.lastName ?? "", companyName: lead.companyName ?? "",
    jobTitle: lead.jobTitle ?? "", email: lead.email ?? "", alternateEmail: lead.alternateEmail ?? "",
    phone: lead.phone ?? "", alternatePhone: lead.alternatePhone ?? "", whatsappNumber: lead.whatsappNumber ?? "",
    website: lead.website ?? "", industry: lead.industry ?? "", businessType: lead.businessType ?? "",
    numberOfEmployees: lead.numberOfEmployees ?? undefined, estimatedRevenue: lead.estimatedRevenue ?? undefined,
    address: lead.address ?? "", city: lead.city ?? "", state: lead.state ?? "", country: lead.country ?? "",
    postalCode: lead.postalCode ?? "", leadSourceId: lead.leadSourceId ?? undefined, rating: lead.rating ?? undefined,
    estimatedDealValue: lead.estimatedDealValue ?? undefined, expectedClosingDate: lead.expectedClosingDate ?? "",
    assignedUserId: lead.assignedUserId ?? undefined, locationId: lead.locationId ?? undefined,
    campaignId: lead.campaignId ?? undefined, description: lead.description ?? "", notes: lead.notes ?? "",
  };
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function LeadForm({ lead }: { lead?: Lead }) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!lead;
  const [duplicates, setDuplicates] = React.useState<LeadDuplicate[] | null>(null);
  const [pendingValues, setPendingValues] = React.useState<LeadFormValues | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ["crm", "lead-sources"],
    queryFn: () => apiClient.get<LeadSource[]>("crm/settings/lead-sources"),
  });

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead ? toFormValues(lead) : EMPTY_VALUES,
  });

  function toPayload(values: LeadFormValues) {
    return {
      ...values,
      lastName: values.lastName || null,
      companyName: values.companyName || null,
      email: values.email || null,
      alternateEmail: values.alternateEmail || null,
      expectedClosingDate: values.expectedClosingDate || null,
      description: values.description || null,
      notes: values.notes || null,
    };
  }

  const saveMutation = useMutation({
    mutationFn: (values: LeadFormValues) =>
      isEdit
        ? apiClient.put<Lead>(`crm/leads/${lead!.id}`, toPayload(values))
        : apiClient.post<Lead>(`crm/leads?force=${duplicates ? "true" : "false"}`, toPayload(values)),
    onSuccess: (saved) => {
      toast.success(isEdit ? "Lead updated successfully." : "Lead created successfully.");
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      router.push(`/crm/leads/${saved.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const duplicateCheckMutation = useMutation({
    mutationFn: (values: LeadFormValues) => {
      const params = new URLSearchParams();
      if (values.email) params.set("email", values.email);
      if (values.phone) params.set("phone", values.phone);
      if (values.whatsappNumber) params.set("whatsapp", values.whatsappNumber);
      return apiClient.get<LeadDuplicate[]>(`crm/leads/duplicates?${params.toString()}`);
    },
    onSuccess: (found, values) => {
      if (found.length > 0) {
        setDuplicates(found);
        setPendingValues(values);
      } else {
        saveMutation.mutate(values);
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function onSubmit(values: LeadFormValues) {
    if (isEdit) {
      saveMutation.mutate(values);
    } else {
      duplicateCheckMutation.mutate(values);
    }
  }

  const saving = saveMutation.isPending || duplicateCheckMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{isEdit ? "Edit Lead" : "New Lead"}</h1>
        <p className="text-sm text-muted-foreground">
          {isEdit ? `Editing ${lead!.leadNumber}` : "Capture a new prospect's details."}
        </p>
      </div>

      {duplicates && duplicates.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Possible duplicate lead found</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      {d.fullName} ({d.leadNumber}) — {d.email ?? d.phone} — {d.status}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setDuplicates(null); setPendingValues(null); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => pendingValues && saveMutation.mutate(pendingValues)}
              >
                {saveMutation.isPending && <Loader2 className="animate-spin" />}
                Continue Anyway
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                <FormItem><FormLabel>WhatsApp Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="jobTitle" render={({ field }) => (
                <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem><FormLabel>Industry</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="businessType" render={({ field }) => (
                <FormItem><FormLabel>Business Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="numberOfEmployees" render={({ field }) => (
                <FormItem><FormLabel>Number of Employees</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="estimatedRevenue" render={({ field }) => (
                <FormItem><FormLabel>Estimated Revenue</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Address</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="postalCode" render={({ field }) => (
                <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Qualification &amp; Ownership</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="leadSourceId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Source</FormLabel>
                  <Select
                    items={Object.fromEntries((sourcesQuery.data ?? []).map((s) => [String(s.id), s.name]))}
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                  >
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {(sourcesQuery.data ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rating" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating</FormLabel>
                  <Select items={{ HOT: "Hot", WARM: "Warm", COLD: "Cold" }} value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select rating" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="HOT">Hot</SelectItem>
                      <SelectItem value="WARM">Warm</SelectItem>
                      <SelectItem value="COLD">Cold</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estimatedDealValue" render={({ field }) => (
                <FormItem><FormLabel>Estimated Deal Value</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="expectedClosingDate" render={({ field }) => (
                <FormItem><FormLabel>Expected Closing Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="assignedUserId" render={({ field }) => (
                <FormItem><FormLabel>Assigned Salesperson (User ID)</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? "Save Changes" : "Create Lead"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
