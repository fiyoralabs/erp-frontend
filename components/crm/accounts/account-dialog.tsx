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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { accountSchema, type AccountFormValues } from "@/lib/validation/crm";
import type { Account } from "@/lib/types/crm";

const TYPE_LABELS = { PROSPECT: "Prospect", CUSTOMER: "Customer", PARTNER: "Partner", VENDOR: "Vendor", OTHER: "Other" };

const EMPTY: AccountFormValues = {
  name: "", accountType: "PROSPECT", locationId: undefined, industry: "", website: "", phone: "", email: "", taxId: "",
  billingAddress: "", billingCity: "", billingState: "", billingCountry: "", billingPostalCode: "",
  shippingAddress: "", shippingCity: "", shippingState: "", shippingCountry: "", shippingPostalCode: "",
  annualRevenue: undefined, employeeCount: undefined, assignedUserId: undefined, parentAccountId: undefined, description: "",
};

function toFormValues(a: Account): AccountFormValues {
  return {
    name: a.name, accountType: a.accountType, locationId: a.locationId ?? undefined, industry: a.industry ?? "",
    website: a.website ?? "", phone: a.phone ?? "", email: a.email ?? "", taxId: a.taxId ?? "",
    billingAddress: a.billingAddress ?? "", billingCity: a.billingCity ?? "", billingState: a.billingState ?? "",
    billingCountry: a.billingCountry ?? "", billingPostalCode: a.billingPostalCode ?? "",
    shippingAddress: a.shippingAddress ?? "", shippingCity: a.shippingCity ?? "", shippingState: a.shippingState ?? "",
    shippingCountry: a.shippingCountry ?? "", shippingPostalCode: a.shippingPostalCode ?? "",
    annualRevenue: a.annualRevenue ?? undefined, employeeCount: a.employeeCount ?? undefined,
    assignedUserId: a.assignedUserId ?? undefined, parentAccountId: a.parentAccountId ?? undefined, description: a.description ?? "",
  };
}

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (open: boolean) => void; account?: Account }) {
  const qc = useQueryClient();
  const isEdit = !!account;
  const form = useForm<AccountFormValues>({ resolver: zodResolver(accountSchema), defaultValues: account ? toFormValues(account) : EMPTY });

  React.useEffect(() => { if (open) form.reset(account ? toFormValues(account) : EMPTY); }, [open, account]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (values: AccountFormValues) => isEdit
      ? apiClient.put<Account>(`crm/accounts/${account!.id}`, values)
      : apiClient.post<Account>("crm/accounts", values),
    onSuccess: () => {
      toast.success(isEdit ? "Account updated." : "Account created.");
      qc.invalidateQueries({ queryKey: ["crm", "accounts"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Account" : "New Account"}</DialogTitle>
          <DialogDescription>Company / business customer record.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Account Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="accountType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select items={TYPE_LABELS} value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem><FormLabel>Industry</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="taxId" render={({ field }) => (
                <FormItem><FormLabel>Tax ID / GSTIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="annualRevenue" render={({ field }) => (
                <FormItem><FormLabel>Annual Revenue</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="employeeCount" render={({ field }) => (
                <FormItem><FormLabel>Employees</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="assignedUserId" render={({ field }) => (
                <FormItem><FormLabel>Assigned Salesperson (User ID)</FormLabel><FormControl>
                  <Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                </FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <p className="text-sm font-medium">Billing Address</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="billingAddress" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="billingCity" render={({ field }) => (
                <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="billingState" render={({ field }) => (
                <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="billingCountry" render={({ field }) => (
                <FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="billingPostalCode" render={({ field }) => (
                <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

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
