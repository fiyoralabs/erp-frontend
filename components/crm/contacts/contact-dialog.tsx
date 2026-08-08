"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { contactSchema, type ContactFormValues } from "@/lib/validation/crm";
import type { Contact } from "@/lib/types/crm";

const EMPTY: ContactFormValues = {
  firstName: "", lastName: "", accountId: undefined, locationId: undefined, jobTitle: "", department: "",
  email: "", secondaryEmail: "", mobile: "", phone: "", whatsappNumber: "", dateOfBirth: "",
  address: "", city: "", state: "", country: "", postalCode: "", assignedUserId: undefined, description: "",
};

function toFormValues(c: Contact): ContactFormValues {
  return {
    firstName: c.firstName, lastName: c.lastName ?? "", accountId: c.accountId ?? undefined, locationId: c.locationId ?? undefined,
    jobTitle: c.jobTitle ?? "", department: c.department ?? "", email: c.email ?? "", secondaryEmail: c.secondaryEmail ?? "",
    mobile: c.mobile ?? "", phone: c.phone ?? "", whatsappNumber: c.whatsappNumber ?? "", dateOfBirth: c.dateOfBirth ?? "",
    address: c.address ?? "", city: c.city ?? "", state: c.state ?? "", country: c.country ?? "", postalCode: c.postalCode ?? "",
    assignedUserId: c.assignedUserId ?? undefined, description: c.description ?? "",
  };
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function ContactDialog({
  open, onOpenChange, contact, defaultAccountId,
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

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) => isEdit
      ? apiClient.put<Contact>(`crm/contacts/${contact!.id}`, values)
      : apiClient.post<Contact>("crm/contacts", values),
    onSuccess: () => {
      toast.success(isEdit ? "Contact updated." : "Contact created.");
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contact" : "New Contact"}</DialogTitle>
          <DialogDescription>Individual person record.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="jobTitle" render={({ field }) => (
                <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem><FormLabel>Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="accountId" render={({ field }) => (
                <FormItem><FormLabel>Account ID</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
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
