import type { PagedResult } from "@/lib/api-client";

export type AccountType="ASSET"|"LIABILITY"|"EQUITY"|"REVENUE"|"EXPENSE";
export type ControlType="AR"|"AP"|"CASH"|"BANK"|"INVENTORY"|"COGS"|"SALES_REVENUE";
export type PeriodStatus="OPEN"|"CLOSED"|"LOCKED";
export type JournalStatus="DRAFT"|"POSTED"|"REVERSED";
export type JournalType="MANUAL"|"SYSTEM_SALES"|"SYSTEM_PURCHASE"|"SYSTEM_EXPENSE"|"CLOSING"|"ADJUSTMENT";
export interface Account{id:number;companyId:number;code:string;name:string;type:AccountType;parentId:number|null;isControlAccount:boolean;controlType:ControlType|null;isActive:boolean;createdAt:string;updatedAt:string}
export interface FiscalPeriod{id:number;companyId:number;fiscalYear:number;periodNumber:number;periodName:string;startDate:string;endDate:string;status:PeriodStatus;closedAt:string|null;closedBy:number|null}
export interface JournalLine{id:number;accountId:number;accountCode:string;accountName:string;debitAmount:number;creditAmount:number;memo:string|null}
export interface JournalSummary{id:number;companyId:number;entryNumber:string;entryDate:string;periodId:number;entryType:JournalType;status:JournalStatus;description:string;referenceType:string|null;referenceId:number|null;referenceNumber:string|null;totalDebit:number;totalCredit:number;postedAt:string|null;createdAt:string}
export interface JournalEntry extends JournalSummary{postedBy:number|null;reversedEntryId:number|null;lines:JournalLine[]}
export interface CashAccount{id:number;companyId:number;code:string;name:string;glAccountId:number;glAccountCode:string;currency:string;currentBalance:number;isActive:boolean;createdAt:string}
export interface BankAccount{id:number;companyId:number;bankName:string;accountNumber:string;accountName:string;swiftCode:string|null;currency:string;glAccountId:number;glAccountCode:string;currentBalance:number;isActive:boolean;createdAt:string}
export interface Reconciliation{id:number;companyId:number;bankAccountId:number;bankAccountName:string;statementDate:string;statementBalance:number;bookBalance:number;difference:number;status:string;reconciledAt:string;reconciledBy:number;notes:string|null}
export interface TrialBalanceRow{accountId:number;accountCode:string;accountName:string;accountType:AccountType;debitAmount:number;creditAmount:number;netBalance:number}
export interface TrialBalance{companyId:number;asOfDate:string;rows:TrialBalanceRow[];totalDebit:number;totalCredit:number;isBalanced:boolean}
export interface StatementRow{accountId:number;accountCode:string;accountName:string;balance:number}
export interface StatementSection{sectionName:string;accountType:AccountType;rows:StatementRow[];sectionTotal:number}
export interface BalanceSheet{companyId:number;asOfDate:string;assets:StatementSection;totalAssets:number;liabilities:StatementSection;totalLiabilities:number;equity:StatementSection;totalEquity:number;totalLiabilitiesAndEquity:number;isBalanced:boolean}
export interface ProfitLossRow{accountId:number;accountCode:string;accountName:string;amount:number}
export interface ProfitLossSection{sectionName:string;accountType:AccountType;rows:ProfitLossRow[];sectionTotal:number}
export interface ProfitLoss{companyId:number;startDate:string;endDate:string;revenues:ProfitLossSection;totalRevenue:number;expenses:ProfitLossSection;totalExpense:number;netProfitLoss:number}
export interface LedgerRow{journalEntryId:number;entryNumber:string;entryDate:string;description:string;referenceNumber:string|null;debitAmount:number;creditAmount:number;runningBalance:number}
export interface GeneralLedger{companyId:number;accountId:number;accountCode:string;accountName:string;accountType:AccountType;startDate:string;endDate:string;openingBalance:number;totalDebit:number;totalCredit:number;closingBalance:number;transactions:PagedResult<LedgerRow>}
