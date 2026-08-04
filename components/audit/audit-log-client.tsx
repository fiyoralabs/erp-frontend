"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Filter, RefreshCw, ScrollText, ShieldCheck } from "lucide-react";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { AuditAction, AuditLogEntry, AuditUser } from "@/lib/types/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";

type Filters = { tableName: string; recordId: string; action: "ALL" | AuditAction; changedBy: string; from: string; to: string };
const blankFilters: Filters = { tableName: "", recordId: "", action: "ALL", changedBy: "ALL", from: "", to: "" };

export function AuditLogClient() {
  const [draft, setDraft] = React.useState<Filters>(blankFilters);
  const [filters, setFilters] = React.useState<Filters>(blankFilters);
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<AuditLogEntry | null>(null);
  const query = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: "20" });
    if (filters.tableName.trim()) p.set("tableName", filters.tableName.trim());
    if (filters.recordId) p.set("recordId", filters.recordId);
    if (filters.action !== "ALL") p.set("action", filters.action);
    if (filters.changedBy !== "ALL") p.set("changedBy", filters.changedBy);
    if (filters.from && filters.to) { p.set("from", filters.from); p.set("to", filters.to); }
    return p.toString();
  }, [filters, page]);
  const logs = useQuery({ queryKey: ["audit", query], queryFn: () => apiClient.get<PagedResult<AuditLogEntry>>(`audit?${query}`) });
  const users = useQuery({ queryKey: ["audit", "users"], queryFn: () => apiClient.get<PagedResult<AuditUser>>("users?page=0&size=100") });
  const userName = React.useCallback((id: number | null) => {
    if (id == null) return "System";
    const user = users.data?.content.find((item) => item.id === id);
    return user ? `${user.fullName} (#${id})` : `User #${id}`;
  }, [users.data]);
  const columns: DataTableColumn<AuditLogEntry>[] = [
    { key: "time", header: "When", render: (row) => formatDateTime(row.changedAt) },
    { key: "action", header: "Action", render: (row) => <ActionBadge action={row.action} /> },
    { key: "entity", header: "Entity", render: (row) => <div><p className="font-medium">{friendlyTable(row.tableName)}</p><p className="text-xs text-muted-foreground">{row.tableName}</p></div> },
    { key: "record", header: "Record", render: (row) => `#${row.recordId}`, hideOnCard: true },
    { key: "user", header: "Changed by", render: (row) => userName(row.changedBy) },
  ];
  const datePairInvalid = Boolean(Boolean(draft.from) !== Boolean(draft.to) || (draft.from && draft.to && draft.from > draft.to));
  const error = logs.error instanceof ApiRequestError ? logs.error.message : logs.error ? "Audit history could not be loaded." : null;
  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-2xl font-semibold">Audit Log</h1><p className="text-sm text-muted-foreground">An immutable history of important changes across the ERP.</p></div>
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />Read-only compliance record</div>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Filter className="size-4" />Find an event</CardTitle><CardDescription>Filter by exact database entity, record, action, employee, or a complete date range.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Field label="Entity table"><Input list="audit-tables" placeholder="e.g. sales.invoice" value={draft.tableName} onChange={(e) => setDraft({ ...draft, tableName: e.target.value })}/><datalist id="audit-tables">{[...new Set(logs.data?.content.map((x) => x.tableName) ?? [])].map((x) => <option key={x} value={x}/>)}</datalist></Field>
      <Field label="Record ID"><Input type="number" min="1" placeholder="Any record" value={draft.recordId} onChange={(e) => setDraft({ ...draft, recordId: e.target.value })}/></Field>
      <Field label="Action"><Picker value={draft.action} onChange={(value) => setDraft({ ...draft, action: value as Filters["action"] })} items={[["ALL","All actions"],["INSERT","Created"],["UPDATE","Updated"],["DELETE","Deleted"]]}/></Field>
      <Field label="Changed by"><Picker value={draft.changedBy} onChange={(value) => setDraft({ ...draft, changedBy: value })} items={[["ALL","All users"],...(users.data?.content.map((u) => [String(u.id), u.fullName] as [string,string]) ?? [])]}/></Field>
      <Field label="From"><Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })}/></Field>
      <Field label="To"><Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })}/></Field>
      {datePairInvalid && <p className="text-xs text-destructive sm:col-span-2 lg:col-span-3 xl:col-span-6">Provide both dates, with From on or before To.</p>}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6"><Button disabled={datePairInvalid} onClick={() => { setFilters(draft); setPage(0); }}><Filter />Apply filters</Button><Button variant="outline" onClick={() => { setDraft(blankFilters); setFilters(blankFilters); setPage(0); }}>Clear</Button><Button variant="ghost" onClick={() => logs.refetch()}><RefreshCw />Refresh</Button></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Activity history</CardTitle><CardDescription>{logs.data ? `${logs.data.totalElements.toLocaleString("en-IN")} recorded events` : "Loading recorded events…"}</CardDescription></CardHeader><CardContent>{error ? <Empty text={error}/> : <DataTable columns={columns} data={logs.data?.content ?? []} rowKey={(row) => row.auditId} actions={(row) => <Button variant="outline" size="sm" onClick={() => setSelected(row)}><Eye />Details</Button>} isLoading={logs.isLoading} emptyMessage="No audit events match these filters." page={page} totalPages={logs.data?.totalPages ?? 0} onPageChange={setPage}/>}</CardContent></Card>
    <AuditDetail entry={selected} userName={userName} onClose={() => setSelected(null)}/>
  </div>;
}

function AuditDetail({ entry, userName, onClose }: { entry: AuditLogEntry | null; userName: (id: number | null) => string; onClose: () => void }) {
  return <Dialog open={entry !== null} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Audit event #{entry?.auditId}</DialogTitle><DialogDescription>Recorded evidence is immutable and cannot be edited from this screen.</DialogDescription></DialogHeader>{entry && <div className="space-y-4"><div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"><Meta label="Action"><ActionBadge action={entry.action}/></Meta><Meta label="Entity" value={friendlyTable(entry.tableName)}/><Meta label="Record" value={`#${entry.recordId}`}/><Meta label="Changed by" value={userName(entry.changedBy)}/><Meta label="Timestamp" value={formatDateTime(entry.changedAt)}/><Meta label="Database table" value={entry.tableName}/></div><div className="grid gap-4 lg:grid-cols-2"><Snapshot title="Before" raw={entry.oldValues}/><Snapshot title="After" raw={entry.newValues}/></div></div>}</DialogContent></Dialog>;
}
function Snapshot({ title, raw }: { title: string; raw: string | null }) { const parsed = parseJson(raw); return <section><h3 className="mb-2 text-sm font-medium">{title}</h3>{parsed ? <div className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs"><pre className="whitespace-pre-wrap break-words">{JSON.stringify(parsed, null, 2)}</pre></div> : <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">No snapshot was recorded.</div>}</section>; }
function ActionBadge({ action }: { action: AuditAction }) { return <Badge variant={action === "DELETE" ? "destructive" : action === "INSERT" ? "default" : "secondary"}>{action === "INSERT" ? "CREATED" : action === "UPDATE" ? "UPDATED" : "DELETED"}</Badge>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid content-start gap-2"><Label>{label}</Label>{children}</div>; }
function Picker({ value, onChange, items }: { value: string; onChange: (value: string) => void; items: [string,string][] }) { return <Select items={Object.fromEntries(items)} value={value} onValueChange={(value) => onChange(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{items.map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>; }
function Meta({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) { return <div><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 text-sm font-medium">{children ?? value}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="py-12 text-center text-sm text-muted-foreground"><ScrollText className="mx-auto mb-2 size-8"/>{text}</div>; }
function parseJson(raw: string | null) { if (!raw) return null; try { return JSON.parse(raw) as unknown; } catch { return raw; } }
function friendlyTable(table: string) { const name = table.split(".").at(-1) ?? table; return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date); }
