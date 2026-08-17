"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

type Step = "email" | "otp" | "password" | "done";

const STEP_COPY: Record<Step, { title: string; description: (email: string) => string }> = {
  email: {
    title: "Reset your password",
    description: () => "Enter your registered work email. We’ll send a one-time code.",
  },
  otp: {
    title: "Check your email",
    description: (email) => `Enter the code sent to ${email}.`,
  },
  password: {
    title: "Choose a new password",
    description: () => "Pick a strong password you haven’t used before.",
  },
  done: {
    title: "Password updated",
    description: () => "You can now sign in with your new password.",
  },
};

function FieldShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-center rounded-xl border border-[#c0c8c8]/80 bg-white transition-all duration-200 focus-within:border-[#0F3D3E] focus-within:ring-2 focus-within:ring-[#0F3D3E]/15 hover:border-[#717978]">
      {children}
    </div>
  );
}

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const path = step === "email" ? "forgot-password" : step === "otp" ? "verify-otp" : "reset-password";
    const body =
      step === "email"
        ? { email }
        : step === "otp"
          ? { email, otp, purpose: "PASSWORD_RESET" }
          : { email, otp, newPassword: password };
    try {
      if (step === "password" && password !== confirm) throw new Error("Passwords do not match");
      const response = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result?.error?.message ?? "Request failed");
      setStep(step === "email" ? "otp" : step === "otp" ? "password" : "done");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const copy = STEP_COPY[step];

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-[#eeeeed] bg-white p-6 sm:p-8 shadow-sm">
      {step === "done" ? (
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#1a1c1c]">{copy.title}</h1>
          <p className="mt-1.5 text-sm text-[#545f73]">{copy.description(email)}</p>
          <Link
            href="/login"
            className="mt-6 flex h-11 sm:h-12 w-full items-center justify-center rounded-xl bg-[#0F3D3E] text-sm sm:text-base font-semibold text-white transition-all duration-150 hover:bg-[#002627] active:scale-[0.99]"
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="text-center sm:text-left mb-6 sm:mb-8">
            <h1 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#1a1c1c]">{copy.title}</h1>
            <p className="mt-1.5 text-sm sm:text-base text-[#545f73]">{copy.description(email)}</p>
          </div>

          <form method="POST" onSubmit={submit} className="space-y-4 sm:space-y-5">
            {step === "email" && (
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs sm:text-sm font-medium text-[#1a1c1c]">
                  Email address
                </label>
                <FieldShell>
                  <span className="absolute left-3.5 flex items-center pointer-events-none text-[#545f73]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={busy}
                    className="w-full h-11 sm:h-12 pl-10 pr-4 text-sm text-[#1a1c1c] placeholder:text-[#717978] bg-transparent border-0 outline-none rounded-xl"
                  />
                </FieldShell>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-1.5">
                <label htmlFor="otp" className="text-xs sm:text-sm font-medium text-[#1a1c1c]">
                  Verification code
                </label>
                <FieldShell>
                  <span className="absolute left-3.5 flex items-center pointer-events-none text-[#545f73]">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    disabled={busy}
                    className="w-full h-11 sm:h-12 pl-10 pr-4 text-sm text-[#1a1c1c] placeholder:text-[#717978] bg-transparent border-0 outline-none rounded-xl"
                  />
                </FieldShell>
              </div>
            )}

            {step === "password" && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs sm:text-sm font-medium text-[#1a1c1c]">
                    New password
                  </label>
                  <FieldShell>
                    <span className="absolute left-3.5 flex items-center pointer-events-none text-[#545f73]">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={busy}
                      className="w-full h-11 sm:h-12 pl-10 pr-11 text-sm text-[#1a1c1c] placeholder:text-[#717978] bg-transparent border-0 outline-none rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 flex items-center text-[#545f73] hover:text-[#1a1c1c] transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </FieldShell>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirm" className="text-xs sm:text-sm font-medium text-[#1a1c1c]">
                    Confirm password
                  </label>
                  <FieldShell>
                    <span className="absolute left-3.5 flex items-center pointer-events-none text-[#545f73]">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      disabled={busy}
                      className="w-full h-11 sm:h-12 pl-10 pr-4 text-sm text-[#1a1c1c] placeholder:text-[#717978] bg-transparent border-0 outline-none rounded-xl"
                    />
                  </FieldShell>
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold text-white bg-[#0F3D3E] hover:bg-[#002627] active:scale-[0.99] transition-all duration-150 rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Please wait…</span>
                </>
              ) : (
                <span>{step === "email" ? "Send code" : step === "otp" ? "Verify code" : "Set password"}</span>
              )}
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0F3D3E] hover:text-[#002627] hover:underline transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </form>
        </>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f9f9f9] px-4 py-8">
      <Link href="/login" className="mb-6 relative h-9 w-9">
        <Image src="/logo-light.png" alt="Fiyora ERP" fill priority className="object-contain" />
      </Link>

      <Suspense
        fallback={
          <div className="w-full max-w-[420px] rounded-2xl border border-[#eeeeed] bg-white p-8 shadow-sm text-sm text-[#545f73]">
            Loading…
          </div>
        }
      >
        <ForgotPasswordForm />
      </Suspense>

      <p className="mt-6 text-xs text-[#717978]">© {new Date().getFullYear()} Fiyora ERP</p>
    </div>
  );
}
