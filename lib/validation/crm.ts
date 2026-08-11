import { z } from "zod";

// Mirrors erp's CRM module request records (crm/api/request/*.java,
// sales/api/request/Quotation*.java) added alongside this frontend work.

export const leadSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().max(100).optional().or(z.literal("")),
  companyName: z.string().max(200).optional().or(z.literal("")),
  jobTitle: z.string().max(100).optional().or(z.literal("")),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  alternateEmail: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  alternatePhone: z.string().max(30).optional().or(z.literal("")),
  whatsappNumber: z.string().max(30).optional().or(z.literal("")),
  website: z.string().max(255).optional().or(z.literal("")),
  industry: z.string().max(100).optional().or(z.literal("")),
  businessType: z.string().max(100).optional().or(z.literal("")),
  numberOfEmployees: z.number().min(0).nullable().optional(),
  estimatedRevenue: z.number().min(0).nullable().optional(),
  address: z.string().optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  leadSourceId: z.number().nullable().optional(),
  rating: z.enum(["HOT", "WARM", "COLD"]).nullable().optional(),
  estimatedDealValue: z.number().min(0).nullable().optional(),
  expectedClosingDate: z.string().optional().or(z.literal("")),
  assignedUserId: z.number().nullable().optional(),
  locationId: z.number().nullable().optional(),
  campaignId: z.number().nullable().optional(),
  description: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
export type LeadFormValues = z.infer<typeof leadSchema>;

export const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  accountType: z.enum(["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR", "OTHER"]),
  locationId: z.number().nullable().optional(),
  industry: z.string().max(100).optional().or(z.literal("")),
  website: z.string().max(255).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  taxId: z.string().max(50).optional().or(z.literal("")),
  billingAddress: z.string().optional().or(z.literal("")),
  billingCity: z.string().max(100).optional().or(z.literal("")),
  billingState: z.string().max(100).optional().or(z.literal("")),
  billingCountry: z.string().max(100).optional().or(z.literal("")),
  billingPostalCode: z.string().max(20).optional().or(z.literal("")),
  shippingAddress: z.string().optional().or(z.literal("")),
  shippingCity: z.string().max(100).optional().or(z.literal("")),
  shippingState: z.string().max(100).optional().or(z.literal("")),
  shippingCountry: z.string().max(100).optional().or(z.literal("")),
  shippingPostalCode: z.string().max(20).optional().or(z.literal("")),
  annualRevenue: z.number().min(0).nullable().optional(),
  employeeCount: z.number().min(0).nullable().optional(),
  assignedUserId: z.number().nullable().optional(),
  parentAccountId: z.number().nullable().optional(),
  description: z.string().optional().or(z.literal("")),
});
export type AccountFormValues = z.infer<typeof accountSchema>;

export const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().max(100).optional().or(z.literal("")),
  accountId: z.number().nullable().optional(),
  locationId: z.number().nullable().optional(),
  jobTitle: z.string().max(100).optional().or(z.literal("")),
  department: z.string().max(100).optional().or(z.literal("")),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  secondaryEmail: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  mobile: z.string().max(30).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  whatsappNumber: z.string().max(30).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  assignedUserId: z.number().nullable().optional(),
  description: z.string().optional().or(z.literal("")),
});
export type ContactFormValues = z.infer<typeof contactSchema>;

export const opportunitySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  accountId: z.number({ error: "Account is required" }),
  primaryContactId: z.number().nullable().optional(),
  pipelineId: z.number({ error: "Pipeline is required" }),
  stageId: z.number({ error: "Stage is required" }),
  amount: z.number({ error: "Amount is required" }).min(0),
  probability: z.number().min(0).max(100).nullable().optional(),
  expectedCloseDate: z.string().optional().or(z.literal("")),
  leadSourceId: z.number().nullable().optional(),
  assignedUserId: z.number().nullable().optional(),
  locationId: z.number().nullable().optional(),
  competitor: z.string().max(200).optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});
export type OpportunityFormValues = z.infer<typeof opportunitySchema>;

export const pipelineSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type PipelineFormValues = z.infer<typeof pipelineSchema>;

export const pipelineStageSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sequence: z.number({ error: "Sequence is required" }),
  probability: z.number({ error: "Probability is required" }).min(0).max(100),
  color: z.string().optional().or(z.literal("")),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type PipelineStageFormValues = z.infer<typeof pipelineStageSchema>;

export const activitySchema = z.object({
  relatedType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "OPPORTUNITY"]),
  relatedId: z.number(),
  type: z.enum(["CALL", "MEETING", "EMAIL", "WHATSAPP", "SMS", "NOTE", "VISIT", "DEMO", "PROPOSAL", "OTHER"]),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional().or(z.literal("")),
  assignedUserId: z.number().nullable().optional(),
  startAt: z.string().optional().or(z.literal("")),
  endAt: z.string().optional().or(z.literal("")),
  outcome: z.string().optional().or(z.literal("")),
  direction: z.enum(["INCOMING", "OUTGOING"]).nullable().optional(),
  phoneNumber: z.string().optional().or(z.literal("")),
  durationSeconds: z.number().nullable().optional(),
  meetingUrl: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  pinned: z.boolean().optional(),
});
export type ActivityFormValues = z.infer<typeof activitySchema>;

export const crmTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  relatedType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "OPPORTUNITY"]).nullable().optional(),
  relatedId: z.number().nullable().optional(),
  assignedUserId: z.number().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional().or(z.literal("")),
  dueTime: z.string().optional().or(z.literal("")),
});
export type CrmTaskFormValues = z.infer<typeof crmTaskSchema>;

export const followUpSchema = z.object({
  relatedType: z.enum(["LEAD", "CONTACT", "ACCOUNT", "OPPORTUNITY"]).nullable().optional(),
  relatedId: z.number().nullable().optional(),
  followUpDate: z.string().min(1, "Follow-up date is required"),
  followUpTime: z.string().optional().or(z.literal("")),
  method: z.enum(["CALL", "EMAIL", "WHATSAPP", "MEETING", "VISIT", "OTHER"]),
  description: z.string().optional().or(z.literal("")),
  assignedUserId: z.number().nullable().optional(),
});
export type FollowUpFormValues = z.infer<typeof followUpSchema>;

export const campaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(["EMAIL", "SOCIAL_MEDIA", "ADVERTISEMENT", "EVENT", "REFERRAL", "WHATSAPP", "DIGITAL", "OTHER"]),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  budget: z.number().min(0).nullable().optional(),
  actualCost: z.number().min(0).nullable().optional(),
  expectedRevenue: z.number().min(0).nullable().optional(),
  description: z.string().optional().or(z.literal("")),
  ownerUserId: z.number().nullable().optional(),
});
export type CampaignFormValues = z.infer<typeof campaignSchema>;

export const leadSourceSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(100),
  active: z.boolean().optional(),
});
export type LeadSourceFormValues = z.infer<typeof leadSourceSchema>;

export const tagSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  color: z.string().optional().or(z.literal("")),
});
export type TagFormValues = z.infer<typeof tagSchema>;

export const quotationItemSchema = z.object({
  productId: z.number({ error: "Product is required" }),
  productVariantId: z.number().nullable().optional(),
  quantity: z.number({ error: "Quantity is required" }).min(0.001),
  unitPrice: z.number({ error: "Unit price is required" }).min(0),
  discountAmount: z.number().min(0).optional(),
  taxPercentage: z.number().min(0).optional(),
});

export const quotationSchema = z.object({
  customerId: z.number({ error: "Customer is required" }),
  locationId: z.number({ error: "Location is required" }),
  contactId: z.number().nullable().optional(),
  opportunityId: z.number().nullable().optional(),
  quotationDate: z.string().min(1, "Quotation date is required"),
  expiryDate: z.string().optional().or(z.literal("")),
  remarks: z.string().optional().or(z.literal("")),
  items: z.array(quotationItemSchema).min(1, "At least one line item is required"),
});
export type QuotationFormValues = z.infer<typeof quotationSchema>;
