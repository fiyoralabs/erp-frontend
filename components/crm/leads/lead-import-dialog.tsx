"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  FileText,
  Check,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import type { LeadBatchImportItem, LeadBatchImportRequest, LeadBatchImportResponse } from "@/lib/types/crm";
import { toast } from "sonner";
import { sanitizePhoneNumber } from "@/components/ui/phone-input";

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Target database fields in Lead model
interface TargetField {
  key: keyof LeadBatchImportItem;
  label: string;
  required?: boolean;
  description?: string;
  aliases: string[];
}

const TARGET_FIELDS: TargetField[] = [
  { key: "firstName", label: "First Name", required: true, aliases: ["first name", "firstname", "fname", "given name", "first_name", "name"] },
  { key: "lastName", label: "Last Name", aliases: ["last name", "lastname", "lname", "surname", "last_name", "family name"] },
  { key: "companyName", label: "Company Name", aliases: ["company", "company name", "org", "organization", "company_name", "business"] },
  { key: "jobTitle", label: "Job Title", aliases: ["title", "job title", "designation", "role", "job_title", "position"] },
  { key: "email", label: "Email Address", aliases: ["email", "e-mail", "email address", "mail", "contact email", "primary email"] },
  { key: "alternateEmail", label: "Alternate Email", aliases: ["alt email", "alternate email", "secondary email", "other email"] },
  { key: "phone", label: "Phone Number", aliases: ["phone", "phone number", "mobile", "cell", "telephone", "contact number", "mobile number"] },
  { key: "alternatePhone", label: "Alternate Phone", aliases: ["alt phone", "alternate phone", "secondary phone", "other phone"] },
  { key: "whatsappNumber", label: "WhatsApp Number", aliases: ["whatsapp", "whatsapp number", "wa number", "wa"] },
  { key: "website", label: "Website", aliases: ["website", "url", "site", "web", "domain"] },
  { key: "industry", label: "Industry", aliases: ["industry", "sector", "domain", "vertical"] },
  { key: "businessType", label: "Business Type", aliases: ["business type", "type", "category"] },
  { key: "numberOfEmployees", label: "Number of Employees", aliases: ["employees", "employee count", "team size", "staff count", "number of employees"] },
  { key: "estimatedRevenue", label: "Estimated Revenue", aliases: ["revenue", "annual revenue", "est revenue", "turnover"] },
  { key: "address", label: "Address", aliases: ["address", "street", "location", "address line"] },
  { key: "city", label: "City", aliases: ["city", "town"] },
  { key: "state", label: "State / Province", aliases: ["state", "province", "region"] },
  { key: "country", label: "Country", aliases: ["country", "nation"] },
  { key: "postalCode", label: "Postal / Zip Code", aliases: ["zip", "postal code", "zipcode", "pincode", "postal_code"] },
  { key: "estimatedDealValue", label: "Estimated Deal Value", aliases: ["deal value", "deal size", "opportunity value", "amount", "budget", "estimated deal value"] },
  { key: "description", label: "Description / Notes", aliases: ["description", "summary", "about", "detail", "details"] },
  { key: "notes", label: "Internal Notes", aliases: ["notes", "internal notes", "comments", "remark", "remarks"] },
];

function autoMatchColumn(headerName: string): string | null {
  const normalized = headerName.trim().toLowerCase();
  for (const field of TARGET_FIELDS) {
    if (field.aliases.some(alias => alias === normalized || normalized.includes(alias) || alias.includes(normalized))) {
      return field.key;
    }
  }
  return null;
}

const STEP_LABELS = {
  1: "Upload File",
  2: "Map Columns",
  3: "Select Rows",
  4: "Import Status",
};

export function LeadImportDialog({ open, onOpenChange, onSuccess }: LeadImportDialogProps) {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [workbook, setWorkbook] = React.useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = React.useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = React.useState<string>("");
  const [rawRows, setRawRows] = React.useState<any[][]>([]);
  const [fileName, setFileName] = React.useState<string>("");

  // Mapping options
  const [headerRowIndex, setHeaderRowIndex] = React.useState<number>(0);
  const [columnMappings, setColumnMappings] = React.useState<Record<number, string>>({}); // colIndex -> targetFieldKey or "IGNORE"
  const [appendRestToDescription, setAppendRestToDescription] = React.useState<boolean>(true);
  const [skipDuplicates, setSkipDuplicates] = React.useState<boolean>(true);

  // Row selection state
  const [selectedRows, setSelectedRows] = React.useState<Record<number, boolean>>({}); // rowIndex -> boolean
  const [startRow, setStartRow] = React.useState<number>(1);
  const [endRow, setEndRow] = React.useState<number>(100);

  // Import execution status
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [importResult, setImportResult] = React.useState<LeadBatchImportResponse | null>(null);

  // Reset dialog state when closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep(1);
      setWorkbook(null);
      setRawRows([]);
      setFileName("");
      setColumnMappings({});
      setSelectedRows({});
      setImportResult(null);
    }
    onOpenChange(newOpen);
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const getXlsxLib = () => {
    return (XLSX as any).default || XLSX;
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    const isCsv = file.name.toLowerCase().endsWith(".csv");

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const xlsxLib = getXlsxLib();

        let wb: XLSX.WorkBook;
        if (isCsv && typeof data === "string") {
          wb = xlsxLib.read(data, { type: "string" });
        } else {
          wb = xlsxLib.read(data, { type: "array" });
        }

        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const firstSheet = wb.SheetNames[0];
        setSelectedSheet(firstSheet);
        parseSheet(wb, firstSheet, 0);
        setStep(2);
      } catch (err: any) {
        toast.error("Failed to parse file: " + (err.message || "Invalid file format"));
      }
    };

    if (isCsv) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Parse worksheet data
  const parseSheet = (wb: XLSX.WorkBook, sheetName: string, hRowIdx: number) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const xlsxLib = getXlsxLib();
    const rows: any[][] = xlsxLib.utils.sheet_to_json(ws, { header: 1, defval: "" });
    setRawRows(rows);

    if (rows.length > hRowIdx) {
      const headers = rows[hRowIdx] as string[];
      const initialMappings: Record<number, string> = {};
      headers.forEach((colHeader, idx) => {
        if (colHeader && String(colHeader).trim()) {
          const match = autoMatchColumn(String(colHeader));
          if (match) {
            initialMappings[idx] = match;
          } else {
            initialMappings[idx] = "IGNORE";
          }
        }
      });
      setColumnMappings(initialMappings);

      // Default select data rows
      const totalDataRows = Math.max(0, rows.length - (hRowIdx + 1));
      setStartRow(1);
      setEndRow(totalDataRows);
      const initialSelected: Record<number, boolean> = {};
      for (let i = hRowIdx + 1; i < rows.length; i++) {
        initialSelected[i] = true;
      }
      setSelectedRows(initialSelected);
    }
  };

  // Handle Sheet or Header Row Change
  const handleSheetChange = (sheetName: string | null) => {
    if (!sheetName) return;
    setSelectedSheet(sheetName);
    if (workbook) {
      parseSheet(workbook, sheetName, headerRowIndex);
    }
  };

  const handleHeaderRowChange = (hIdxStr: string | null) => {
    if (!hIdxStr) return;
    const idx = parseInt(hIdxStr, 10);
    setHeaderRowIndex(idx);
    if (workbook && selectedSheet) {
      parseSheet(workbook, selectedSheet, idx);
    }
  };

  // Helper to extract headers & data rows
  const headers = rawRows[headerRowIndex] || [];
  const dataRowsIndices = React.useMemo(() => {
    const indices: number[] = [];
    for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
      if (rawRows[i] && rawRows[i].some((cell: any) => String(cell).trim() !== "")) {
        indices.push(i);
      }
    }
    return indices;
  }, [rawRows, headerRowIndex]);

  // Update selected rows based on start / end row range controls
  const handleApplyRowRange = (start: number, end: number) => {
    setStartRow(start);
    setEndRow(end);
    const newSelected: Record<number, boolean> = {};
    dataRowsIndices.forEach((rowIdx, relativeIdx) => {
      const rowNum = relativeIdx + 1;
      newSelected[rowIdx] = rowNum >= start && rowNum <= end;
    });
    setSelectedRows(newSelected);
  };

  const handleSelectAll = (select: boolean) => {
    const newSelected: Record<number, boolean> = {};
    dataRowsIndices.forEach((rowIdx) => {
      newSelected[rowIdx] = select;
    });
    setSelectedRows(newSelected);
  };

  // Transform row to LeadBatchImportItem
  const transformRowToLead = (row: any[]): { lead: LeadBatchImportItem; restInfo: string[] } => {
    const lead: Record<string, any> = {};
    const unmappedPairs: string[] = [];
    const customFieldsMap: Record<string, string> = {};

    headers.forEach((colHeader: any, colIdx: number) => {
      const cellVal = row[colIdx] != null ? String(row[colIdx]).trim() : "";
      const mappedKey = columnMappings[colIdx];

      if (mappedKey && mappedKey !== "IGNORE") {
        if (cellVal !== "") {
          if (mappedKey === "phone" || mappedKey === "alternatePhone" || mappedKey === "whatsappNumber") {
            lead[mappedKey] = sanitizePhoneNumber(cellVal);
          } else if (mappedKey === "numberOfEmployees" || mappedKey === "estimatedRevenue" || mappedKey === "estimatedDealValue") {
            const num = parseFloat(cellVal.replace(/[^0-9.-]+/g, ""));
            if (!isNaN(num)) lead[mappedKey] = num;
          } else {
            lead[mappedKey] = cellVal;
          }
        }
      } else if (appendRestToDescription && colHeader && cellVal !== "") {
        const headerStr = String(colHeader).trim();
        unmappedPairs.push(`${headerStr}: ${cellVal}`);
        customFieldsMap[headerStr] = cellVal;
      }
    });

    if (Object.keys(customFieldsMap).length > 0) {
      lead.customFields = JSON.stringify(customFieldsMap);
    }

    return { lead: lead as LeadBatchImportItem, restInfo: unmappedPairs };
  };

  // Perform Batch Import
  const handleExecuteImport = async () => {
    const selectedIndices = dataRowsIndices.filter(idx => selectedRows[idx]);
    if (selectedIndices.length === 0) {
      toast.error("Please select at least one row to import.");
      return;
    }

    const leadsToImport: LeadBatchImportItem[] = [];
    const validationErrors: string[] = [];

    selectedIndices.forEach((rowIdx, idx) => {
      const row = rawRows[rowIdx];
      const { lead } = transformRowToLead(row);

      if (!lead.firstName) {
        if (lead.companyName) {
          lead.firstName = lead.companyName;
        } else if (lead.email) {
          lead.firstName = lead.email.split("@")[0];
        } else {
          validationErrors.push(`Row ${idx + 1}: Missing required First Name.`);
          return;
        }
      }
      leadsToImport.push(lead);
    });

    if (leadsToImport.length === 0) {
      toast.error("No valid leads to import. Please ensure First Name or Company Name is mapped.");
      return;
    }

    setIsSubmitting(true);
    setStep(4);

    try {
      const payload: LeadBatchImportRequest = {
        leads: leadsToImport,
        skipDuplicates,
      };

      const res = await apiClient.post<LeadBatchImportResponse>("crm/leads/batch-import", payload);
      setImportResult(res);
      toast.success(`Successfully imported ${res.importedCount} leads!`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to import leads");
      setImportResult({
        total: leadsToImport.length,
        importedCount: 0,
        skippedCount: 0,
        errors: [err.message || "Server error during import"],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSelectedCount = dataRowsIndices.filter(idx => selectedRows[idx]).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background text-foreground border border-border rounded-xl shadow-xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-card/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-semibold text-foreground truncate">Import Leads from Excel / CSV</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                Dynamically map columns, select rows, and import leads directly into CRM
              </DialogDescription>
            </div>
          </div>

          {/* Stepper indicator - Mobile vs Desktop */}
          <div className="flex items-center gap-2">
            {/* Mobile Step Badge */}
            <div className="sm:hidden px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              Step {step} of 4: {STEP_LABELS[step]}
            </div>

            {/* Desktop / Tablet Stepper Chips */}
            <div className="hidden sm:flex items-center gap-1.5 lg:gap-2 text-xs overflow-x-auto">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${step === 1 ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"}`}>1. Upload</span>
              <span className="text-muted-foreground/60">&rarr;</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${step === 2 ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"}`}>2. Map Columns</span>
              <span className="text-muted-foreground/60">&rarr;</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${step === 3 ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"}`}>3. Select Rows</span>
              <span className="text-muted-foreground/60">&rarr;</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${step === 4 ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"}`}>4. Import</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* STEP 1: Upload File */}
          {step === 1 && (
            <div className="space-y-6 py-2 sm:py-4">
              <div className="border-2 border-dashed border-muted-foreground/30 hover:border-primary rounded-xl p-6 sm:p-10 text-center transition-colors bg-muted/10 hover:bg-muted/20 flex flex-col items-center justify-center cursor-pointer relative group">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="p-3.5 sm:p-4 rounded-full bg-primary/10 text-primary mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="h-7 w-7 sm:h-8 sm:w-8" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">Click or Drag & Drop Excel / CSV file</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Supports .xlsx, .xls, and .csv files. Automatic sheet detection and smart column matching.
                </p>
                <Button size="sm" className="pointer-events-none">
                  Browse File
                </Button>
              </div>

              {/* Information Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-xs text-muted-foreground">
                <div className="p-3.5 rounded-lg bg-card border border-border space-y-1">
                  <div className="font-semibold text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Dynamic Column Match
                  </div>
                  <p className="text-muted-foreground">Headers like Name, Mobile, Mail, Company will be auto-matched to lead database attributes.</p>
                </div>
                <div className="p-3.5 rounded-lg bg-card border border-border space-y-1">
                  <div className="font-semibold text-primary flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Rest Columns to Custom Fields
                  </div>
                  <p className="text-muted-foreground">Unmapped extra columns will automatically be stored as structured Custom Fields.</p>
                </div>
                <div className="p-3.5 rounded-lg bg-card border border-border space-y-1 sm:col-span-2 lg:col-span-1">
                  <div className="font-semibold text-primary flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Interactive Row Picker
                  </div>
                  <p className="text-muted-foreground">Select specific rows or range of rows to import with live validation checks.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Header & Column Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              {/* File Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="font-medium text-foreground truncate">{fileName}</span>
                  <span className="text-muted-foreground flex-shrink-0">({rawRows.length} total rows)</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {sheetNames.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs whitespace-nowrap">Sheet:</Label>
                      <Select value={selectedSheet} onValueChange={handleSheetChange}>
                        <SelectTrigger className="h-8 text-xs w-32 sm:w-40 bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover text-popover-foreground">
                          {sheetNames.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground text-xs whitespace-nowrap">Header Row:</Label>
                    <Select value={String(headerRowIndex)} onValueChange={handleHeaderRowChange}>
                      <SelectTrigger className="h-8 text-xs w-28 sm:w-32 bg-background border-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground">
                        {rawRows.slice(0, 10).map((_, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            Row {idx + 1} {idx === 0 ? "(Default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={appendRestToDescription}
                    onChange={(e) => setAppendRestToDescription(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Append unmapped ("rest") columns into Lead <strong>Description</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Skip duplicate leads (matching email / phone)</span>
                </label>
              </div>

              {/* Column Mapping Table */}
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="px-4 py-2.5 bg-muted/60 border-b border-border text-xs font-semibold text-foreground flex justify-between items-center">
                  <span>Excel Column Header</span>
                  <span>Match to Lead Database Field</span>
                </div>
                <div className="divide-y divide-border max-h-[350px] overflow-y-auto">
                  {headers.map((colHeader: any, idx: number) => {
                    const headerStr = colHeader ? String(colHeader).trim() : `Column ${idx + 1}`;
                    const currentMapped = columnMappings[idx] || "IGNORE";
                    const isMapped = currentMapped !== "IGNORE";

                    return (
                      <div key={idx} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isMapped ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                          <span className="text-xs font-medium text-foreground truncate">{headerStr}</span>
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">(Col {idx + 1})</span>
                        </div>

                        <div className="w-full sm:w-64">
                          <Select
                            value={currentMapped}
                            onValueChange={(val) => {
                              if (val) setColumnMappings((prev) => ({ ...prev, [idx]: val }));
                            }}
                          >
                            <SelectTrigger className={`h-8 text-xs w-full ${isMapped ? "bg-primary/10 border-primary/40 text-primary font-medium" : "bg-background border-input text-muted-foreground"}`}>
                              <SelectValue placeholder="Ignore / Move to Description" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover text-popover-foreground max-h-60">
                              <SelectItem value="IGNORE" className="text-muted-foreground italic">
                                -- Ignore (Move to Description) --
                              </SelectItem>
                              {TARGET_FIELDS.map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label} {field.required ? "*" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Dynamic Row Selection & Preview */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Row Selector Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="font-medium text-foreground whitespace-nowrap">Select Row Range:</span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={dataRowsIndices.length}
                      value={startRow}
                      onChange={(e) => setStartRow(parseInt(e.target.value, 10) || 1)}
                      className="h-8 w-16 text-xs text-center bg-background border-input"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={1}
                      max={dataRowsIndices.length}
                      value={endRow}
                      onChange={(e) => setEndRow(parseInt(e.target.value, 10) || dataRowsIndices.length)}
                      className="h-8 w-16 text-xs text-center bg-background border-input"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyRowRange(startRow, endRow)}
                      className="h-8 text-xs border-border bg-background hover:bg-muted"
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSelectAll(true)}
                      className="h-8 text-xs text-primary hover:text-primary/80 px-2"
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSelectAll(false)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                    >
                      Deselect
                    </Button>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold border border-primary/20 whitespace-nowrap">
                    {activeSelectedCount} Selected
                  </span>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="max-h-[350px] overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead className="sticky top-0 bg-muted border-b border-border text-foreground">
                      <tr>
                        <th className="p-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={activeSelectedCount === dataRowsIndices.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-input text-primary"
                          />
                        </th>
                        <th className="p-2.5 w-12 text-muted-foreground">Row</th>
                        <th className="p-2.5 font-semibold text-primary">First Name</th>
                        <th className="p-2.5 font-semibold">Last Name</th>
                        <th className="p-2.5 font-semibold">Company</th>
                        <th className="p-2.5 font-semibold">Phone</th>
                        <th className="p-2.5 font-semibold">Email</th>
                        <th className="p-2.5 font-semibold">Description Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dataRowsIndices.map((rowIdx, relativeIdx) => {
                        const row = rawRows[rowIdx];
                        const isChecked = !!selectedRows[rowIdx];
                        const { lead } = transformRowToLead(row);

                        return (
                          <tr
                            key={rowIdx}
                            className={`hover:bg-muted/50 transition-colors ${!isChecked ? "opacity-40 bg-muted/20" : ""}`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => setSelectedRows((prev) => ({ ...prev, [rowIdx]: e.target.checked }))}
                                className="rounded border-input text-primary"
                              />
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono">{relativeIdx + 1}</td>
                            <td className="p-2.5 font-medium text-foreground">
                              {lead.firstName ? (
                                lead.firstName
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 text-[11px] italic flex items-center gap-1 font-normal">
                                  <AlertTriangle className="h-3 w-3" /> Auto-fallback
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-foreground">{lead.lastName || "-"}</td>
                            <td className="p-2.5 text-foreground">{lead.companyName || "-"}</td>
                            <td className="p-2.5 text-foreground">{lead.phone || "-"}</td>
                            <td className="p-2.5 text-foreground">{lead.email || "-"}</td>
                            <td className="p-2.5 text-muted-foreground max-w-xs truncate" title={lead.description || ""}>
                              {lead.description || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Import Status / Results */}
          {step === 4 && (
            <div className="py-6 space-y-6">
              {isSubmitting ? (
                <div className="text-center py-10 space-y-4">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
                  <h3 className="text-base font-semibold text-foreground">Importing Leads into Database...</h3>
                  <p className="text-xs text-muted-foreground">Creating lead records, auto-linking accounts and contacts.</p>
                </div>
              ) : importResult ? (
                <div className="space-y-6">
                  {/* Results Summary Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{importResult.importedCount}</div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Successfully Imported</div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{importResult.skippedCount}</div>
                      <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">Skipped Duplicates</div>
                    </div>
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center">
                      <div className="text-2xl font-bold text-destructive">{importResult.errors.length}</div>
                      <div className="text-xs text-destructive font-medium">Validation Errors</div>
                    </div>
                  </div>

                  {/* Errors Detail List if any */}
                  {importResult.errors.length > 0 && (
                    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/30 space-y-2">
                      <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" /> Import Error Logs:
                      </h4>
                      <div className="max-h-40 overflow-y-auto space-y-1 text-xs font-mono text-destructive">
                        {importResult.errors.map((err: string, i: number) => (
                          <div key={i}>&bull; {err}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                      <strong>Batch Import Complete!</strong> All selected leads have been saved to your company tenant. Newly created leads have auto-generated Lead Numbers and associated Prospect Contacts.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-4 border-t border-border bg-card/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div>
            {step > 1 && step < 4 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="w-full sm:w-auto gap-1.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {step === 1 && (
              <Button size="sm" variant="ghost" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto text-xs">
                Cancel
              </Button>
            )}

            {step === 2 && (
              <Button
                size="sm"
                onClick={() => setStep(3)}
                className="w-full sm:w-auto gap-1.5 text-xs"
              >
                Next: Select Rows <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {step === 3 && (
              <Button
                size="sm"
                onClick={handleExecuteImport}
                disabled={activeSelectedCount === 0}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs font-semibold"
              >
                <Check className="h-4 w-4" /> Import {activeSelectedCount} Selected Leads
              </Button>
            )}

            {step === 4 && (
              <Button
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="w-full sm:w-auto text-xs"
              >
                Done & View Leads List
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
