"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  TrendingUp,
  Truck,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  ShieldCheck,
  Headphones,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { landingPath } from "@/lib/permissions";

export function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Security: Clean up any sensitive query params (password, email) from URL bar if present
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("password") || url.searchParams.has("email")) {
        url.searchParams.delete("password");
        url.searchParams.delete("email");
        window.history.replaceState(
          {},
          "",
          url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "")
        );
      }
    }
  }, []);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        toast.error(body?.error?.message ?? "Invalid email or password");
        return;
      }

      toast.success("Welcome back!");
      const target = landingPath(Array.isArray(body.permissions) ? body.permissions : []);
      window.location.href = target;
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-[#f9f9f9] text-[#1a1c1c] overflow-x-hidden font-sans">
      {/* ============================================================ */}
      {/* LEFT PANEL: Responsive Authentication Form (Mobile, Tab, Desk) */}
      {/* ============================================================ */}
      <div className="w-full lg:w-[54%] xl:w-[52%] flex flex-col justify-between min-h-screen bg-white relative px-4 sm:px-8 md:px-12 lg:px-10 xl:px-16 py-6 sm:py-8 lg:py-10">
        {/* Top Header / Logo */}
        <div className="flex items-center justify-center sm:justify-between w-full max-w-[420px] mx-auto">
          <div className="relative h-9 w-9 sm:h-10 sm:w-10 shrink-0">
            <Image
              src="/logo-light.png"
              alt="Fiyora ERP"
              fill
              priority
              className="object-contain"
            />
          </div>

          {/* Desktop/Tablet status indicator badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3f4f3] border border-[#e2e2e2] text-xs font-medium text-[#545f73]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Secure System</span>
          </div>
        </div>

        {/* Center: Main Login Form Card */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-6 sm:py-8">
          {/* Header Typography */}
          <div className="text-center sm:text-left mb-6 sm:mb-8">
            <h1 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#1a1c1c]">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-[#545f73]">
              Log in to manage your shipments, inventory, and operations.
            </p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs sm:text-sm font-medium text-[#1a1c1c]">
                      Email address
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex items-center rounded-xl border border-[#c0c8c8]/80 bg-white transition-all duration-200 focus-within:border-[#0F3D3E] focus-within:ring-2 focus-within:ring-[#0F3D3E]/15 hover:border-[#717978]">
                        <span className="absolute left-3.5 flex items-center pointer-events-none text-[#545f73]">
                          <Mail className="h-4 w-4" />
                        </span>
                        <input
                          type="email"
                          autoComplete="username"
                          placeholder="name@company.com"
                          className="w-full h-11 sm:h-12 pl-10 pr-4 text-sm text-[#1a1c1c] placeholder:text-[#717978] bg-transparent border-0 outline-none rounded-xl"
                          {...field}
                          disabled={submitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs sm:text-sm font-medium text-[#1a1c1c]">
                        Password
                      </FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-semibold text-[#0F3D3E] hover:text-[#002627] hover:underline transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative flex items-center rounded-xl border border-[#c0c8c8]/80 bg-white transition-all duration-200 focus-within:border-[#0F3D3E] focus-within:ring-2 focus-within:ring-[#0F3D3E]/15 hover:border-[#717978]">
                        <span className="absolute left-3.5 flex items-center pointer-events-none text-[#545f73]">
                          <Lock className="h-4 w-4" />
                        </span>
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="w-full h-11 sm:h-12 pl-10 pr-11 text-sm text-[#1a1c1c] placeholder:text-[#717978] bg-transparent border-0 outline-none rounded-xl"
                          {...field}
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 flex items-center text-[#545f73] hover:text-[#1a1c1c] transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold text-white bg-[#0F3D3E] hover:bg-[#002627] active:scale-[0.99] transition-all duration-150 rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </Button>
            </form>
          </Form>

          {/* Tablet & Mobile Friendly Footer Note */}
          <div className="mt-8 text-center">
            <p className="text-xs text-[#545f73]">
              Need access or encountering issues?{" "}
              <a
                href="https://www.fiyoralabs.in/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#0F3D3E] hover:underline"
              >
                Contact Administrator
              </a>
            </p>
          </div>
        </div>

        {/* Bottom Footer (Security & Copyright) */}
        <div className="w-full max-w-lg mx-auto lg:mx-0 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#717978] border-t border-[#eeeeed]/80 gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#3b6566]" />
            <span>256-bit SSL Encrypted • ISO 27001 Certified</span>
          </div>
          <span>© {new Date().getFullYear()} Fiyora ERP</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT PANEL: Supply Chain Showcase & Visuals (Desktop & Wide Tab) */}
      {/* ============================================================ */}
      <div className="hidden lg:flex w-[46%] xl:w-[48%] bg-[#0F3D3E] text-white relative flex-col justify-between px-10 xl:px-14 py-10 overflow-hidden select-none">
        {/* Background Visual Patterns & Ambient Blur Orbs */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#a3cfcf]/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -left-20 w-80 h-80 bg-[#3b6566]/30 rounded-full blur-[100px]" />
          <div className="absolute -bottom-20 right-10 w-96 h-96 bg-[#002627] rounded-full blur-[90px]" />
          {/* Subtle Grid / Dot Matrix overlay */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Right Header Status */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#a3cfcf] bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
            Logistics & Operations Suite
          </span>
          <div className="flex items-center gap-2 text-xs text-[#a3cfcf]">
            <Headphones className="h-3.5 w-3.5" />
            <span>24/7 Enterprise SLA</span>
          </div>
        </div>

        {/* Center: High-Fidelity Floating Mockup Cards */}
        <div className="relative z-10 my-auto py-6 w-full max-w-md mx-auto">
          <div className="relative h-[320px] xl:h-[350px] w-full">
            {/* 1. Main Floating Card: Total Orders */}
            <div className="absolute right-0 top-2 w-[240px] xl:w-[260px] bg-white text-[#1a1c1c] rounded-2xl p-5 shadow-[0_12px_36px_rgba(0,0,0,0.25)] border border-[#e2e2e2] transform rotate-1 transition-transform duration-300 hover:rotate-0 hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#545f73] uppercase tracking-wider">
                  Total Orders
                </span>
                <MoreHorizontal className="h-4 w-4 text-[#717978]" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-[#1a1c1c] mb-2">
                1,495
              </div>
              <div className="flex items-center text-xs font-semibold text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                <span>+6.4%</span>
                <span className="text-[#545f73] ml-1.5 font-normal">vs last week</span>
              </div>
            </div>

            {/* 2. Secondary Floating Card: Active Shipments */}
            <div className="absolute left-0 bottom-4 w-[280px] xl:w-[310px] bg-white text-[#1a1c1c] rounded-2xl p-5 shadow-[0_12px_36px_rgba(0,0,0,0.25)] border border-[#e2e2e2] transform -rotate-2 transition-transform duration-300 hover:rotate-0 hover:scale-105">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-bold text-[#1a1c1c] uppercase tracking-wider">
                  Active Shipments
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <div className="space-y-3 text-xs">
                {/* Shipment 1 */}
                <div className="flex items-center justify-between pb-2.5 border-b border-[#eeeeed]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#d5e0f8] flex items-center justify-center text-[#0F3D3E]">
                      <Truck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#1a1c1c]">SHP-8492</div>
                      <div className="text-[11px] text-[#545f73]">To: Chicago, IL</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-semibold border border-emerald-200">
                    In Transit
                  </span>
                </div>

                {/* Shipment 2 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a]">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#1a1c1c]">SHP-9104</div>
                      <div className="text-[11px] text-[#545f73]">To: Miami, FL</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md text-[11px] font-semibold border border-amber-200">
                    Delayed
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Small Floating Pill: Fleet Optimal */}
            <div className="absolute right-4 bottom-24 bg-white text-[#1a1c1c] rounded-full px-3.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)] border border-[#e2e2e2] flex items-center gap-2 transform rotate-6 hover:rotate-0 transition-transform">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-[#1a1c1c]">Fleet Optimal</span>
            </div>
          </div>
        </div>

        {/* Right Footer: Hero Marketing Copy */}
        <div className="relative z-10">
          <h2 className="font-heading text-2xl xl:text-3xl font-bold text-white mb-2.5 leading-snug tracking-tight">
            Manage your entire supply chain in one place.
          </h2>
          <p className="text-sm xl:text-base text-[#a3cfcf] leading-relaxed max-w-md">
            Fiyora ERP provides real-time visibility, automated dispatching, and comprehensive analytics to keep your logistics moving forward.
          </p>
        </div>
      </div>
    </div>
  );
}
