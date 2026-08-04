export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export interface AuditLogEntry {
  auditId: number;
  companyId: number;
  tableName: string;
  recordId: number;
  action: AuditAction;
  changedBy: number | null;
  changedAt: string;
  oldValues: string | null;
  newValues: string | null;
}

export interface AuditUser {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
}
