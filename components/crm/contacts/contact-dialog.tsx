"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, UserCheck, MessageSquare, Building2, User, Mail, Phone, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { contactSchema, type ContactFormValues } from "@/lib/validation/crm";
import type { Contact } from "@/lib/types/crm";
import { UserSelect, useCurrentUser } from "@/components/crm/shared/user-select";
import { AccountSelect } from "@/components/crm/shared/account-select";

const EMPTY: ContactFormValues = {
  firstName: "",
  lastName: "",
  accountId: undefined,
  locationId: undefined,
  jobTitle: "",
  department: "",
  email: "",
  secondaryEmail: "",
  mobile: "",
  phone: "",
  whatsappNumber: "",
  dateOfBirth: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  assignedUserId: undefined,
  description: "",
};

function toFormValues(c: Contact): ContactFormValues {
  return {
    firstName: c.firstName,
    lastName: c.lastName ?? "",
    accountId: c.accountId ?? undefined,
    locationId: c.locationId ?? undefined,
    jobTitle: c.jobTitle ?? "",
    department: c.department ?? "",
    email: c.email ?? "",
    secondaryEmail: c.secondaryEmail ?? "",
    mobile: c.mobile ?? "",
    phone: c.phone ?? "",
    whatsappNumber: c.whatsappNumber ?? "",
    dateOfBirth: c.dateOfBirth ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    country: c.country ?? "",
    postalCode: c.postalCode ?? "",
    assignedUserId: c.assignedUserId ?? undefined,
    description: c.description ?? "",
  };
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  defaultAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  defaultAccountId?: number;
}) {
  const qc = useQueryClient();
  const isEdit = !!contact;
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: contact ? toFormValues(contact) : { ...EMPTY, accountId: defaultAccountId },
  });

  React.useEffect(() => {
    if (open) form.reset(contact ? toFormValues(contact) : { ...EMPTY, accountId: defaultAccountId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact]);

  const currentUserQuery = useCurrentUser();
  React.useEffect(() => {
    if (open && !isEdit && currentUserQuery.data && form.getValues("assignedUserId") === undefined) {
      form.setValue("assignedUserId", currentUserQuery.data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, currentUserQuery.data]);

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      isEdit
        ? apiClient.put<Contact>(`crm/contacts/${contact!.id}`, values)
        : apiClient.post<Contact>("crm/contacts", values),
    onSuccess: () => {
      toast.success(isEdit ? "Contact updated successfully." : "Contact created successfully.");
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card text-foreground rounded-2xl border border-border shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d5e0f8] dark:bg-[#223049] flex items-center justify-center text-[#111c2d] dark:text-[#d8e3fb]">
              {isEdit ? <UserCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {isEdit ? "Edit Contact" : "New Contact"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Individual personal record and account link
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <Form {...form}>
            <form id="contact-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. John" className="h-10 rounded-xl bg-background" {...field} />
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
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Operations Manager" className="h-10 rounded-xl bg-background" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">Department</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Procurement" className="h-10 rounded-xl bg-background" {...field} />
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
                        <Input type="email" placeholder="john.doe@example.com" className="h-10 rounded-xl bg-background" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">Mobile Phone</FormLabel>
                      <FormControl>
                        <PhoneInput value={field.value} onChange={field.onChange} />
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
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-foreground">Associated Company / Account</FormLabel>
                      <FormControl>
                        <AccountSelect value={field.value} onChange={field.onChange} placeholder="Select account..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="assignedUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Assigned Salesperson / Owner</FormLabel>
                    <FormControl>
                      <UserSelect value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-foreground">Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Office or mailing address..." className="rounded-xl bg-background resize-none h-18" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 h-10 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="contact-form"
            disabled={mutation.isPending}
            className="rounded-xl px-7 h-10 text-xs font-bold bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90 shadow-sm"
          >
            {mutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Contact"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
