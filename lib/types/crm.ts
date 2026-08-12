// Fiyora CRM types. Hand-written against the new backend CRM module
// (com.fiyora.erp.crm.* + com.fiyora.erp.sales.*.Quotation) added alongside
// this frontend work -- field names mirror the Java records exactly
// (records serialize with their component names) so these are trustworthy
// without a separate live-curl pass. Plain-noun naming, no DTO suffix, per
// the convention in lib/types/product.ts etc.

export type LeadStatus =
  | "NEW" | "CONTACTED" | "ATTEMPTED_CONTACT" | "INTERESTED" | "QUALIFIED"
  | "UNQUALIFIED" | "NURTURING" | "CONVERTED" | "LOST";

export type LeadRating = "HOT" | "WARM" | "COLD";

export type AccountType = "PROSPECT" | "CUSTOMER" | "PARTNER" | "VENDOR" | "OTHER";

export type OpportunityStatus = "OPEN" | "WON" | "LOST";

export type LossReason =
  | "PRICE" | "COMPETITOR" | "NO_BUDGET" | "NO_RESPONSE"
  | "REQUIREMENT_CHANGED" | "TIMING" | "NOT_INTERESTED" | "OTHER";

export type ActivityType =
  | "CALL" | "MEETING" | "EMAIL" | "WHATSAPP" | "SMS" | "NOTE"
  | "VISIT" | "DEMO" | "PROPOSAL" | "OTHER";

export type ActivityStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type CallDirection = "INCOMING" | "OUTGOING";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type CrmTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type FollowUpMethod = "CALL" | "EMAIL" | "WHATSAPP" | "MEETING" | "VISIT" | "OTHER";
export type FollowUpStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type CampaignType = "EMAIL" | "SOCIAL_MEDIA" | "ADVERTISEMENT" | "EVENT" | "REFERRAL" | "WHATSAPP" | "DIGITAL" | "OTHER";
export type CampaignStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type RelatedEntityType = "LEAD" | "CONTACT" | "ACCOUNT" | "OPPORTUNITY";
export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED";

export interface LeadSource {
  id: number;
  code: string;
  name: string;
  system: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface PipelineStage {
  id: number;
  pipelineId: number;
  name: string;
  sequence: number;
  probability: number;
  color: string | null;
  isWon: boolean;
  isLost: boolean;
  active: boolean;
}

export interface Pipeline {
  id: number;
  name: string;
  isDefault: boolean;
  active: boolean;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string | null;
}

export interface Account {
  id: number;
  accountNumber: string;
  name: string;
  accountType: AccountType;
  locationId: number | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingCountry: string | null;
  billingPostalCode: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingCountry: string | null;
  shippingPostalCode: string | null;
  annualRevenue: number | null;
  employeeCount: number | null;
  assignedUserId: number | null;
  parentAccountId: number | null;
  customerId: number | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface AccountCustomerSummary {
  linked: boolean;
  customerId: number | null;
  customerCode: string | null;
  creditLimit: number | null;
  outstandingBalance: number | null;
  totalPurchaseAmount: number | null;
  lastPurchaseAt: string | null;
  recentInvoices: {
    id: number;
    invoiceNumber: string;
    invoiceDate: string;
    totalAmount: number;
    balanceAmount: number;
    status: string;
  }[];
}

export interface Contact {
  id: number;
  firstName: string;
  lastName: string | null;
  accountId: number | null;
  locationId: number | null;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  secondaryEmail: string | null;
  mobile: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  assignedUserId: number | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Lead {
  id: number;
  leadNumber: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
  alternateEmail: string | null;
  phone: string | null;
  alternatePhone: string | null;
  whatsappNumber: string | null;
  website: string | null;
  industry: string | null;
  businessType: string | null;
  numberOfEmployees: number | null;
  estimatedRevenue: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  leadSourceId: number | null;
  status: LeadStatus;
  rating: LeadRating | null;
  estimatedDealValue: number | null;
  expectedClosingDate: string | null;
  assignedUserId: number | null;
  locationId: number | null;
  campaignId: number | null;
  description: string | null;
  notes: string | null;
  customFields?: string | null;
  convertedAccountId: number | null;
  convertedContactId: number | null;
  convertedOpportunityId: number | null;
  convertedAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
}

export interface LeadDuplicate {
  id: number;
  leadNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
}

export interface LeadProductLine {
  id: number;
  productId: number;
  quantity: number;
  estimatedPrice: number | null;
  discount: number | null;
  notes: string | null;
}

export interface LeadConvertResult {
  accountId: number | null;
  contactId: number | null;
  opportunityId: number | null;
}

export interface Opportunity {
  id: number;
  opportunityNumber: string;
  name: string;
  accountId: number;
  primaryContactId: number | null;
  leadId: number | null;
  pipelineId: number;
  stageId: number;
  status: OpportunityStatus;
  amount: number;
  probability: number;
  expectedRevenue: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  leadSourceId: number | null;
  assignedUserId: number | null;
  locationId: number | null;
  competitor: string | null;
  lossReason: LossReason | null;
  quotationId: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface OpportunityProductLine {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  notes: string | null;
}

export interface Activity {
  id: number;
  relatedType: RelatedEntityType;
  relatedId: number;
  type: ActivityType;
  subject: string;
  description: string | null;
  assignedUserId: number | null;
  startAt: string | null;
  endAt: string | null;
  status: ActivityStatus;
  outcome: string | null;
  priority: string | null;
  direction: CallDirection | null;
  phoneNumber: string | null;
  durationSeconds: number | null;
  meetingUrl: string | null;
  location: string | null;
  pinned: boolean;
  reminderAt: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface CrmTask {
  id: number;
  title: string;
  description: string | null;
  relatedType: RelatedEntityType | null;
  relatedId: number | null;
  assignedUserId: number | null;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  status: CrmTaskStatus;
  reminderAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface FollowUp {
  id: number;
  relatedType: RelatedEntityType | null;
  relatedId: number | null;
  followUpDate: string;
  followUpTime: string | null;
  method: FollowUpMethod;
  description: string | null;
  assignedUserId: number | null;
  reminderAt: string | null;
  status: FollowUpStatus;
  outcome: string | null;
  notes: string | null;
  nextFollowUpId: number | null;
  createdAt: string;
}

export interface CrmTag {
  id: number;
  name: string;
  color: string | null;
}

export interface Campaign {
  id: number;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  actualCost: number | null;
  expectedRevenue: number | null;
  description: string | null;
  ownerUserId: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CampaignStats {
  leadsGenerated: number;
  opportunitiesGenerated: number;
  convertedCustomers: number;
  pipelineValue: number;
  wonRevenue: number;
  conversionRate: number;
  roi: number | null;
}

export interface TimelineEvent {
  id: number;
  eventType: string;
  title: string;
  description: string | null;
  actorUserId: number | null;
  occurredAt: string;
}

export interface QuotationItem {
  id: number;
  productId: number;
  productVariantId: number | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Quotation {
  id: number;
  quotationNumber: string;
  customerId: number;
  locationId: number;
  contactId: number | null;
  opportunityId: number | null;
  quotationDate: string;
  expiryDate: string | null;
  status: QuotationStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  remarks: string | null;
  convertedSalesOrderId: number | null;
  items: QuotationItem[];
  createdAt: string;
  updatedAt: string | null;
}

export interface CrmDashboard {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  openOpportunities: number;
  wonOpportunities: number;
  lostOpportunities: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  conversionRate: number;
  tasksDueToday: number;
  overdueTasks: number;
  followUpsDueToday: number;
  overdueFollowUps: number;
  leadsByStatus: Record<string, number>;
  leadsBySource: Record<string, number>;
  leadsByAssignedUser: Record<string, number>;
  opportunitiesByStage: { stageId: number; count: number; amount: number }[];
  lostReasons: Record<string, number>;
  salespersonPerformance: { userId: number; leadsAssigned: number; wonAmount: number }[];
  wonRevenueByMonth: { month: string; amount: number }[];
  recentLeads: Lead[];
  recentOpportunities: Opportunity[];
}

export interface CrmReports {
  leadsBySource: Record<string, number>;
  leadsByStatus: Record<string, number>;
  leadsBySalesperson: Record<string, number>;
  leadConversionRate: number;
  leadAging: { leadId: number; leadNumber: string; fullName: string; ageDays: number }[];
  opportunitiesByStage: Record<string, number>;
  pipelineValue: number;
  weightedPipelineValue: number;
  wonDeals: number;
  lostDeals: number;
  winRate: number;
  averageDealSize: number;
  averageSalesCycleDays: number | null;
  lostReasons: Record<string, number>;
  forecastByMonth: { month: string; amount: number }[];
}

export interface LeadBatchImportItem {
  firstName: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  alternateEmail?: string;
  phone?: string;
  alternatePhone?: string;
  whatsappNumber?: string;
  website?: string;
  industry?: string;
  businessType?: string;
  numberOfEmployees?: number;
  estimatedRevenue?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  leadSourceId?: number;
  rating?: LeadRating;
  estimatedDealValue?: number;
  expectedClosingDate?: string;
  assignedUserId?: number;
  locationId?: number;
  campaignId?: number;
  description?: string;
  notes?: string;
}

export interface LeadBatchImportRequest {
  leads: LeadBatchImportItem[];
  skipDuplicates: boolean;
}

export interface LeadBatchImportResponse {
  total: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

