"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  AlertTriangle,
  Link as LinkIcon,
  User,
  Building2,
  MapPin,
  Tag,
  FileText,
  Save,
  ArrowLeft,
  Sparkles,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { leadSchema, type LeadFormValues } from "@/lib/validation/crm";
import type { Lead, LeadDuplicate, LeadSource } from "@/lib/types/crm";
import { UserSelect, useCurrentUser } from "@/components/crm/shared/user-select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const EMPTY_VALUES: LeadFormValues = {
  firstName: "",
  lastName: "",
  companyName: "",
  jobTitle: "",
  email: "",
  alternateEmail: "",
  phone: "",
  alternatePhone: "",
  whatsappNumber: "",
  website: "",
  industry: "",
  businessType: "",
  numberOfEmployees: undefined,
  estimatedRevenue: undefined,
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  leadSourceId: undefined,
  rating: undefined,
  estimatedDealValue: undefined,
  expectedClosingDate: "",
  assignedUserId: undefined,
  locationId: undefined,
  campaignId: undefined,
  description: "",
  notes: "",
  customFields: "",
};

function toFormValues(lead: Lead): LeadFormValues {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName ?? "",
    companyName: lead.companyName ?? "",
    jobTitle: lead.jobTitle ?? "",
    email: lead.email ?? "",
    alternateEmail: lead.alternateEmail ?? "",
    phone: lead.phone ?? "",
    alternatePhone: lead.alternatePhone ?? "",
    whatsappNumber: lead.whatsappNumber ?? "",
    website: lead.website ?? "",
    industry: lead.industry ?? "",
    businessType: lead.businessType ?? "",
    numberOfEmployees: lead.numberOfEmployees ?? undefined,
    estimatedRevenue: lead.estimatedRevenue ?? undefined,
    address: lead.address ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    country: lead.country ?? "",
    postalCode: lead.postalCode ?? "",
    leadSourceId: lead.leadSourceId ?? undefined,
    rating: lead.rating ?? undefined,
    estimatedDealValue: lead.estimatedDealValue ?? undefined,
    expectedClosingDate: lead.expectedClosingDate ?? "",
    assignedUserId: lead.assignedUserId ?? undefined,
    locationId: lead.locationId ?? undefined,
    campaignId: lead.campaignId ?? undefined,
    description: lead.description ?? "",
    notes: lead.notes ?? "",
    customFields: lead.customFields ?? "",
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

  const currentUserQuery = useCurrentUser();
  React.useEffect(() => {
    if (!isEdit && currentUserQuery.data && form.getValues("assignedUserId") === undefined) {
      form.setValue("assignedUserId", currentUserQuery.data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, currentUserQuery.data]);

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
      customFields: values.customFields || null,
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

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "dropdown"],
    queryFn: () =>
      apiClient.get<{
        content: Array<{
          id: number;
          firstName: string;
          lastName?: string;
          email?: string;
          mobile?: string;
          jobTitle?: string;
        }>;
      }>("crm/contacts?page=0&size=100"),
  });

  const checkLiveDuplicate = React.useCallback(async (email?: string, phone?: string) => {
    // In edit mode, only check a field against the rest of the company once
    // its value actually differs from what's already saved on this lead --
    // otherwise retyping (or just leaving) the lead's own unchanged phone
    // still bundles in its unchanged email on every keystroke, and if that
    // email happens to collide with some other lead, editing the phone box
    // alone was enough to resurface an unrelated warning every time.
    if (lead && email === (lead.email ?? "")) email = undefined;
    if (lead && phone === (lead.phone ?? "")) phone = undefined;
    if (!email && !phone) return;
    try {
      const params = new URLSearchParams();
      if (email) params.set("email", email);
      if (phone) params.set("phone", phone);
      // Exclude this lead itself, otherwise editing a lead and leaving its
      // own (unchanged) phone/email flags it as a "duplicate" of itself.
      if (lead) params.set("excludeLeadId", String(lead.id));
      const found = await apiClient.get<LeadDuplicate[]>(`crm/leads/duplicates?${params.toString()}`);
      if (found && found.length > 0) {
        setDuplicates(found);
      }
    } catch {
      // Ignore background check errors
    }
  }, [lead]);

  function onSubmit(values: LeadFormValues) {
    if (isEdit) {
      saveMutation.mutate(values);
    } else {
      duplicateCheckMutation.mutate(values);
    }
  }

  const saving = saveMutation.isPending || duplicateCheckMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="w-fit p-1.5 h-8 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground font-heading">
            {isEdit ? "Edit Lead" : "New Lead"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground pl-10">
          {isEdit
            ? `Update details and requirements for ${lead!.leadNumber}`
            : "Capture a new prospect's details or select an existing contact to auto-fill."}
        </p>
      </div>

      {/* Section 1: Link with Existing Contact (Optional) */}
      {!isEdit && contactsQuery.data?.content && contactsQuery.data.content.length > 0 && (
        <div className="rounded-2xl border border-[#d8e3fb] dark:border-[#223049] bg-[#d8e3fb]/30 dark:bg-[#223049]/30 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d5e0f8] dark:bg-[#223049] flex items-center justify-center text-[#111c2d] dark:text-[#d8e3fb] shrink-0">
              <LinkIcon className="h-5 w-5 text-[#3c475a] dark:text-[#d8e3fb]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Link with Existing Contact (Optional)</h3>
              <p className="text-xs text-muted-foreground">Select an existing contact to auto-fill contact details.</p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <Select
              onValueChange={(val) => {
                const c = contactsQuery.data?.content.find((x) => x.id.toString() === val);
                if (c) {
                  form.setValue("firstName", c.firstName);
                  if (c.lastName) form.setValue("lastName", c.lastName);
                  if (c.email) form.setValue("email", c.email);
                  if (c.mobile) form.setValue("phone", c.mobile);
                  if (c.jobTitle) form.setValue("jobTitle", c.jobTitle);
                  toast.info(`Autofilled lead from contact: ${c.firstName} ${c.lastName ?? ""}`);
                }
              }}
            >
              <SelectTrigger className="h-10 text-xs bg-background rounded-xl border-input">
                <SelectValue placeholder="Select existing contact..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {contactsQuery.data.content.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.firstName} {c.lastName ?? ""} {c.email ? `(${c.email})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Duplicate Warning Box */}
      {duplicates && duplicates.length > 0 && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                Possible duplicate lead already exists!
              </p>
              <ul className="mt-1.5 list-disc pl-4 text-xs text-muted-foreground space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <span className="font-semibold text-foreground">{d.fullName}</span> ({d.leadNumber}) —{" "}
                    {d.email ?? d.phone} — Status: <span className="font-semibold text-foreground">{d.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => {
                setDuplicates(null);
                setPendingValues(null);
              }}
            >
              Review / Cancel
            </Button>
            <Button
              size="sm"
              disabled={saveMutation.isPending}
              className="rounded-xl text-xs bg-amber-600 hover:bg-amber-500 text-white"
              onClick={() =>
                pendingValues
                  ? saveMutation.mutate(pendingValues)
                  : form.handleSubmit((v) => saveMutation.mutate(v))()
              }
            >
              {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Proceed & Force Create
            </Button>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Section 2: Contact Information */}
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm md:text-base font-bold text-foreground">Contact Information</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Primary personal contact details for this lead
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-5">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Jane" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Doe" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jane.doe@example.com"
                        className="h-10 rounded-xl bg-background"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          checkLiveDuplicate(e.target.value, form.getValues("phone"));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Phone Number</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={(val) => {
                          field.onChange(val);
                          checkLiveDuplicate(form.getValues("email"), val);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      WhatsApp Number
                    </FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. VP of Sales" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 3: Company Information */}
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm md:text-base font-bold text-foreground">Company Information</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Organization background and size metrics
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-5">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Acme Corp" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Technology, Retail" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Business Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. B2B, B2C, Enterprise" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numberOfEmployees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Number of Employees</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 50"
                        className="h-10 rounded-xl bg-background"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimatedRevenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Estimated Annual Revenue</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 1000000"
                        className="h-10 rounded-xl bg-background"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 4: Qualification & Ownership */}
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm md:text-base font-bold text-foreground">Qualification & Ownership</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Lead source, rating, deal potential, and assigned sales rep
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-5">
              <FormField
                control={form.control}
                name="leadSourceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Lead Source</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full h-10 rounded-xl bg-background">
                          <SelectValue placeholder="Select lead source..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(sourcesQuery.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Rating</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full h-10 rounded-xl bg-background">
                          <SelectValue placeholder="Select lead temperature..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HOT" className="text-red-600 font-semibold">
                          🔥 Hot
                        </SelectItem>
                        <SelectItem value="WARM" className="text-amber-600 font-semibold">
                          ⚡ Warm
                        </SelectItem>
                        <SelectItem value="COLD" className="text-blue-600 font-semibold">
                          ❄️ Cold
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimatedDealValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Estimated Deal Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 50000"
                        className="h-10 rounded-xl bg-background"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectedClosingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Expected Closing Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedUserId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-xs font-semibold text-foreground">Assigned Salesperson</FormLabel>
                    <FormControl>
                      <UserSelect value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 5: Address Information */}
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm md:text-base font-bold text-foreground">Address Information</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">Location and mailing details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-5">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-xs font-semibold text-foreground">Street Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. 123 Innovation Boulevard, Suite 400"
                        className="rounded-xl bg-background resize-none h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">City</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. San Francisco" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">State / Province</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. California" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Country</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. United States" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Postal / Zip Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 94105" className="h-10 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 6: Notes & Custom Fields */}
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm md:text-base font-bold text-foreground">Description & Notes</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Rich requirement summary, internal remarks, and custom properties
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-5">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Requirement Summary</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Enter detailed lead requirements, background, and specific requests..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Private notes for team and sales reps..."
                        className="rounded-xl bg-background resize-none h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customFields"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Custom Properties (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='e.g. {"interested_course": "Full Stack", "preferred_schedule": "Evening"}'
                        className="rounded-xl bg-background font-mono text-xs resize-none h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="rounded-xl px-6 h-11 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl px-8 h-11 text-xs font-bold bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90 shadow-sm flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Save Changes" : "Create Lead"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
