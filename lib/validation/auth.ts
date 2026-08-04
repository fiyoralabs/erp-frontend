import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// erp's forgot-password/verify-otp/reset-password flow (curl-verified in the
// production readiness audit, re-confirm live before relying on exact
// shapes since backend code keeps changing):
//   POST /auth/forgot-password {"email"} -> always 200 (anti-enumeration)
//   POST /auth/verify-otp {"email","otp","purpose"} -> "purpose" is an
//     undocumented-but-required field the audit found live; erp's forgot-
//     password email itself doesn't state the exact literal value it
//     expects -- confirm via a real curl call before shipping this screen,
//     do not guess a value.
//   POST /auth/reset-password {"email","otp","newPassword","confirmPassword"}
export const forgotPasswordRequestSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "Enter the 6-digit code"),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(8, "Must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
