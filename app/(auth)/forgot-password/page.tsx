"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Step = "email" | "otp" | "password" | "done";
function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const path = step === "email" ? "forgot-password" : step === "otp" ? "verify-otp" : "reset-password";
    const body = step === "email" ? { email } : step === "otp" ? { email, otp, purpose: "PASSWORD_RESET" } : { email, otp, newPassword: password };
    try {
      if (step === "password" && password !== confirm) throw new Error("Passwords do not match");
      const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result?.error?.message ?? "Request failed");
      setStep(step === "email" ? "otp" : step === "otp" ? "password" : "done");
    } catch (e) { const message = e instanceof Error ? e.message : "Request failed"; setError(message); toast.error(message); } finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>{step === "done" ? "Password updated" : "Reset your password"}</CardTitle><CardDescription>{step === "email" ? "Enter your registered work email. We’ll send a one-time code." : step === "otp" ? `Enter the code sent to ${email}.` : step === "password" ? "Choose a strong new password." : "You can now sign in with your new password."}</CardDescription></CardHeader><CardContent>
    {step === "done" ? <Button nativeButton={false} render={<Link href="/login" />}>Return to sign in</Button> : <form onSubmit={submit} className="space-y-4">
      {step === "email" && <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>}
      {step === "otp" && <div className="space-y-2"><Label htmlFor="otp">Verification code</Label><Input id="otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value)} required /></div>}
      {step === "password" && <><div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required /></div></>}
      {error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : step === "email" ? "Send code" : step === "otp" ? "Verify code" : "Set password"}</Button>
      <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">Back to sign in</Link>
    </form>}
  </CardContent></Card>;
}

export default function ForgotPasswordPage() {
  return <Suspense fallback={<Card><CardContent className="p-6">Loading…</CardContent></Card>}><ForgotPasswordForm /></Suspense>;
}
