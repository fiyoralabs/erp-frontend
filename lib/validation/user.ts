import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().optional().or(z.literal("")),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;
