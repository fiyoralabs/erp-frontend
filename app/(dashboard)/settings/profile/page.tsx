"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { profileSchema, type ProfileFormValues } from "@/lib/validation/user";
import type { CurrentUser } from "@/lib/types/user";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const [permissionDenied, setPermissionDenied] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const userQuery = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiClient.get<CurrentUser>("users/me"),
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: userQuery.data
      ? { fullName: userQuery.data.fullName, phone: userQuery.data.phone ?? "" }
      : undefined,
    defaultValues: { fullName: "", phone: "" },
  });

  // erp has no dedicated PUT /users/me -- this reuses the general employee-
  // management PUT /users/{id}, gated behind USER_UPDATE. Only sending
  // fullName + phone (never roleIds/isActive) is safe: UserServiceImpl only
  // touches those when explicitly provided (verified in source), so this
  // can't accidentally change the caller's own roles or active status.
  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      apiClient.put<CurrentUser>(`users/${userQuery.data!.id}`, values),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["users", "me"] });
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.status === 403) {
        setPermissionDenied(true);
        return;
      }
      toast.error(errorMessage(err));
    },
  });
  const passwordMutation = useMutation({
    mutationFn: () => apiClient.post("auth/change-password", { oldPassword, newPassword }),
    onSuccess: () => {
      toast.success("Password changed. Other refresh sessions have been invalidated.");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (userQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }
  if (!userQuery.data) {
    return <p className="text-sm text-destructive">Could not load your profile.</p>;
  }

  const user = userQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details as they appear across Fiyora ERP.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center sm:flex-row sm:text-left">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="text-lg font-semibold">{user.fullName}</span>
              <Badge variant={user.isActive ? "default" : "secondary"}>{user.status}</Badge>
            </div>
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {user.roles.map((role) => (
                <Badge key={role} variant="outline">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>
            Update your name and phone number. Email and roles are managed by your
            administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissionDenied && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                You don&apos;t have permission to update your profile. Contact your
                administrator to change these details.
              </span>
            </div>
          )}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={permissionDenied} />
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} disabled={permissionDenied} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Not a real form field (no FormField/Controller behind
                    it), so this uses the plain Label directly -- FormLabel
                    calls useFormField() internally and throws without a
                    FormField ancestor ("useFormField should be used within
                    <FormField>", confirmed live via the dev server log). */}
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={user.email} disabled readOnly />
                  <p className="text-xs text-muted-foreground">
                    Email can&apos;t be changed here.
                  </p>
                </div>
              </div>
              <Button
                type="submit"
                className="w-fit"
                disabled={updateMutation.isPending || permissionDenied}
              >
                {updateMutation.isPending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Change password</CardTitle><CardDescription>Use at least 8 characters with upper and lower case letters, a number, and a special character.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Current password</Label><Input className="mt-2" type="password" autoComplete="current-password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/></div>
          <div><Label>New password</Label><Input className="mt-2" type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></div>
          <div><Label>Confirm new password</Label><Input className="mt-2" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></div>
          {confirmPassword && newPassword !== confirmPassword && <p className="text-sm text-destructive sm:col-span-2">The new passwords do not match.</p>}
          <Button className="w-fit sm:col-span-2" disabled={!oldPassword||!newPassword||newPassword!==confirmPassword||passwordMutation.isPending} onClick={()=>passwordMutation.mutate()}>{passwordMutation.isPending&&<Loader2 className="animate-spin"/>}Change password</Button>
        </CardContent>
      </Card>
    </div>
  );
}
