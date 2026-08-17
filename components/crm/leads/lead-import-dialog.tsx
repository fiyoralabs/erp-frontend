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
  X,
  Sliders,
  RotateCcw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    if (field.aliases.some((alias) => alias === normalized || normalized.includes(alias) || alias.includes(normalized))) {
      return field.key;
    }
  }
  return null;
}

const STEP_LABELS = {
  1: "Upload",
  2: "Map Columns",
  3: "Select Rows",
  4: "Success",
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
    const selectedIndices = dataRowsIndices.filter((idx) => selectedRows[idx]);
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

  const activeSelectedCount = dataRowsIndices.filter((idx) => selectedRows[idx]).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[96vw] sm:w-[92vw] lg:max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-surface-container-lowest dark:bg-card text-on-surface border border-outline-variant dark:border-border rounded-2xl shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-outline-variant dark:border-border bg-surface-bright dark:bg-card/90 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container/10 dark:bg-primary/20 text-primary-container dark:text-primary flex items-center justify-center font-bold">
                <FileSpreadsheet className="h-5 w-5 text-[#0f3d3e] dark:text-[#a3cfcf]" />
              </div>
              <div>
                <DialogTitle className="text-lg md:text-xl font-bold tracking-tight text-foreground">
                  Import Leads from Excel / CSV
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Dynamic Column Matching, Custom Fields Fallback & Interactive Row Selection
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-muted/60 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stepper Progress Bar (Desktop & Mobile Responsive) */}
          <div className="flex items-center justify-between sm:justify-start gap-2 pt-2 overflow-x-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  step === 1
                    ? "bg-[#0f3d3e] text-[#beebeb] dark:bg-[#beebeb] dark:text-[#002020] shadow-sm"
                    : step > 1
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > 1 ? <Check className="h-3 w-3" /> : "1."} Upload
              </span>
            </div>

            <div className="w-6 sm:w-10 h-[2px] bg-outline-variant dark:bg-border shrink-0" />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  step === 2
                    ? "bg-[#0f3d3e] text-[#beebeb] dark:bg-[#beebeb] dark:text-[#002020] shadow-sm"
                    : step > 2
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > 2 ? <Check className="h-3 w-3" /> : "2."} Map Columns
              </span>
            </div>

            <div className="w-6 sm:w-10 h-[2px] bg-outline-variant dark:bg-border shrink-0" />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  step === 3
                    ? "bg-[#0f3d3e] text-[#beebeb] dark:bg-[#beebeb] dark:text-[#002020] shadow-sm"
                    : step > 3
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > 3 ? <Check className="h-3 w-3" /> : "3."} Select Rows
              </span>
            </div>

            <div className="w-6 sm:w-10 h-[2px] bg-outline-variant dark:bg-border shrink-0" />

            {/* Step 4 */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  step === 4
                    ? "bg-[#0f3d3e] text-[#beebeb] dark:bg-[#beebeb] dark:text-[#002020] shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                4. Done
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-bright dark:bg-background/50">
          {/* STEP 1: Upload File */}
          {step === 1 && (
            <div className="space-y-6 py-2">
              {/* Dropzone Container */}
              <div className="border-2 border-dashed border-[#a3cfcf] dark:border-[#3b6566] rounded-2xl bg-[#beebeb]/10 hover:bg-[#beebeb]/20 dark:bg-card/40 dark:hover:bg-card/70 transition-all p-8 sm:p-12 flex flex-col items-center justify-center cursor-pointer group relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="p-4 rounded-full bg-background dark:bg-card shadow-md mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-9 w-9 text-[#0f3d3e] dark:text-[#a3cfcf]" />
                </div>
                <h3 className="text-base md:text-lg font-bold text-foreground mb-1 text-center">
                  Click or Drag & Drop Excel / CSV file
                </h3>
                <p className="text-xs text-muted-foreground mb-5 text-center max-w-sm">
                  Maximum file size: 50MB. Supported formats: .xlsx, .xls, .csv
                </p>
                <Button
                  size="sm"
                  className="px-6 py-2 bg-card text-foreground border border-border rounded-xl font-semibold shadow-xs hover:bg-muted pointer-events-none"
                >
                  Browse Files
                </Button>
              </div>

              {/* What to expect next cards */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  What to expect next
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1 */}
                  <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex flex-col gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#d5e0f8] dark:bg-[#223049] flex items-center justify-center text-[#111c2d] dark:text-[#d8e3fb]">
                      <Sparkles className="h-5 w-5 text-[#3c475a] dark:text-[#d8e3fb]" />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">Dynamic Column Match</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      Our system automatically matches your spreadsheet column headers with the CRM lead fields.
                    </p>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex flex-col gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#ffdbc8] dark:bg-[#502f19] flex items-center justify-center text-[#2f1403] dark:text-[#ffdbc8]">
                      <FileText className="h-5 w-5 text-[#623e27] dark:text-[#ffdbc8]" />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">Rest Columns to Custom Fields</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      Unmapped columns are automatically formatted and preserved as structured Custom Fields in notes.
                    </p>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-card p-5 rounded-2xl border border-border shadow-xs flex flex-col gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#beebeb] dark:bg-[#0f3d3e] flex items-center justify-center text-[#002020] dark:text-[#beebeb]">
                      <Layers className="h-5 w-5 text-[#224d4e] dark:text-[#beebeb]" />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">Interactive Row Picker</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      Filter, inspect, and select specific rows before importing to ensure 100% clean data entry.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {step === 2 && (
            <div className="space-y-5">
              {/* File Info Bar & Configuration Options */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#d5e0f8] dark:bg-[#223049] flex items-center justify-center text-[#111c2d] dark:text-[#d8e3fb]">
                    <FileSpreadsheet className="h-5 w-5 text-[#3c475a] dark:text-[#d8e3fb]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground truncate max-w-xs sm:max-w-md">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rawRows.length > 0 ? `${rawRows.length - 1} total rows detected` : "File loaded"} • {headers.length} columns
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {sheetNames.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Sheet:</Label>
                      <Select value={selectedSheet} onValueChange={handleSheetChange}>
                        <SelectTrigger className="h-8 text-xs w-36 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sheetNames.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Header Row:</Label>
                    <Select value={String(headerRowIndex)} onValueChange={handleHeaderRowChange}>
                      <SelectTrigger className="h-8 text-xs w-32 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={appendRestToDescription}
                    onChange={(e) => setAppendRestToDescription(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Append unmapped ("rest") columns to Custom Fields / Notes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span>Skip duplicate leads (matched by email / phone)</span>
                </label>
              </div>

              {/* Column Mapping Table */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
                <div className="grid grid-cols-2 gap-4 px-6 py-3.5 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div>Excel Column Header</div>
                  <div>Match to Lead Database Field</div>
                </div>

                <div className="divide-y divide-border max-h-[380px] overflow-y-auto">
                  {headers.map((colHeader: any, idx: number) => {
                    const headerStr = colHeader ? String(colHeader).trim() : `Column ${idx + 1}`;
                    const currentMapped = columnMappings[idx] || "IGNORE";
                    const isMapped = currentMapped !== "IGNORE";

                    // Preview first sample value
                    const sampleValue =
                      rawRows[headerRowIndex + 1] && rawRows[headerRowIndex + 1][idx] != null
                        ? String(rawRows[headerRowIndex + 1][idx]).trim()
                        : "";

                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-3.5 items-center hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">{headerStr}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">(Col {idx + 1})</span>
                          </div>
                          {sampleValue && (
                            <span className="text-xs text-muted-foreground truncate italic">
                              e.g. "{sampleValue}"
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Select
                              value={currentMapped}
                              onValueChange={(val) => {
                                if (val) setColumnMappings((prev) => ({ ...prev, [idx]: val }));
                              }}
                            >
                              <SelectTrigger
                                className={`h-10 text-xs w-full rounded-xl transition-all ${
                                  isMapped
                                    ? "bg-[#0f3d3e]/10 dark:bg-[#0f3d3e]/30 border-[#0f3d3e]/30 text-foreground font-semibold"
                                    : "bg-background border-input text-muted-foreground"
                                }`}
                              >
                                <SelectValue placeholder="Ignore / Move to Custom Fields" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                <SelectItem value="IGNORE" className="text-muted-foreground italic">
                                  -- Ignore (Move to Custom Fields) --
                                </SelectItem>
                                {TARGET_FIELDS.map((field) => (
                                  <SelectItem key={field.key} value={field.key}>
                                    {field.label} {field.required ? "*" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {isMapped && (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Select Rows & Validate */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Row Selector Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">Select Rows Range:</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={dataRowsIndices.length}
                      value={startRow}
                      onChange={(e) => setStartRow(parseInt(e.target.value, 10) || 1)}
                      className="h-8 w-20 text-xs text-center bg-background rounded-lg"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={1}
                      max={dataRowsIndices.length}
                      value={endRow}
                      onChange={(e) => setEndRow(parseInt(e.target.value, 10) || dataRowsIndices.length)}
                      className="h-8 w-20 text-xs text-center bg-background rounded-lg"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyRowRange(startRow, endRow)}
                      className="h-8 text-xs rounded-lg hover:bg-muted"
                    >
                      Apply
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSelectAll(true)}
                      className="h-8 text-xs text-primary font-medium hover:bg-primary/10"
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSelectAll(false)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Deselect
                    </Button>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-full bg-[#d8e3fb] dark:bg-[#223049] text-[#111c2d] dark:text-[#d8e3fb] font-semibold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{activeSelectedCount} Selected</span>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
                <div className="max-h-[380px] overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs border-b border-border text-foreground font-semibold z-10">
                      <tr>
                        <th className="p-3 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={activeSelectedCount === dataRowsIndices.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 w-14 text-muted-foreground font-mono">Row</th>
                        <th className="p-3 font-semibold text-primary">First Name</th>
                        <th className="p-3 font-semibold">Last Name</th>
                        <th className="p-3 font-semibold">Company</th>
                        <th className="p-3 font-semibold">Phone</th>
                        <th className="p-3 font-semibold">Email</th>
                        <th className="p-3 font-semibold">Custom Fields Preview</th>
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
                            className={`hover:bg-muted/40 transition-colors ${!isChecked ? "opacity-40 bg-muted/10" : ""}`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => setSelectedRows((prev) => ({ ...prev, [rowIdx]: e.target.checked }))}
                                className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 text-muted-foreground font-mono">{relativeIdx + 1}</td>
                            <td className="p-3 font-semibold text-foreground">
                              {lead.firstName ? (
                                lead.firstName
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 text-[11px] italic flex items-center gap-1 font-normal">
                                  <AlertTriangle className="h-3 w-3" /> Auto-fallback
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-foreground">{lead.lastName || "-"}</td>
                            <td className="p-3 text-foreground font-medium">{lead.companyName || "-"}</td>
                            <td className="p-3 text-foreground font-mono">{lead.phone || "-"}</td>
                            <td className="p-3 text-foreground">{lead.email || "-"}</td>
                            <td className="p-3 text-muted-foreground max-w-xs truncate" title={lead.description || ""}>
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

          {/* STEP 4: Success / Import Summary */}
          {step === 4 && (
            <div className="py-8 flex flex-col items-center text-center space-y-6">
              {isSubmitting ? (
                <div className="py-12 space-y-4 flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#0f3d3e] dark:border-[#beebeb] border-t-transparent" />
                  <h3 className="text-base md:text-lg font-bold text-foreground">Importing Leads into Database...</h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Creating database lead records, standardizing phone numbers, and attaching custom fields.
                  </p>
                </div>
              ) : importResult ? (
                <div className="w-full max-w-2xl space-y-6 flex flex-col items-center">
                  {/* Big Success Icon */}
                  <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shadow-inner">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  {/* Heading & Subtext */}
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground">Import Complete</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {importResult.importedCount} leads successfully imported into your CRM.
                    </p>
                  </div>

                  {/* Stats Card Row */}
                  <div className="grid grid-cols-3 gap-3 w-full bg-card rounded-2xl p-4 border border-border shadow-xs">
                    <div className="flex flex-col items-center p-2">
                      <span className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {importResult.importedCount}
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Imported
                      </span>
                    </div>

                    <div className="flex flex-col items-center p-2 border-x border-border">
                      <span className="text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {importResult.skippedCount}
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Skipped
                      </span>
                    </div>

                    <div className="flex flex-col items-center p-2">
                      <span className="text-xl md:text-2xl font-bold text-destructive">
                        {importResult.errors.length}
                      </span>
                      <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider">
                        Failed
                      </span>
                    </div>
                  </div>

                  {/* Error Log if any */}
                  {importResult.errors.length > 0 && (
                    <div className="w-full p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-left space-y-2">
                      <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" /> Validation / Import Warnings:
                      </h4>
                      <div className="max-h-36 overflow-y-auto space-y-1 text-xs font-mono text-destructive">
                        {importResult.errors.map((err, i) => (
                          <div key={i}>&bull; {err}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-outline-variant dark:border-border bg-surface-container-lowest dark:bg-card/90 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            {step > 1 && step < 4 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="w-full sm:w-auto gap-1.5 text-xs rounded-xl font-semibold"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {step === 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="w-full sm:w-auto text-xs rounded-xl"
              >
                Cancel
              </Button>
            )}

            {step === 2 && (
              <Button
                size="sm"
                onClick={() => setStep(3)}
                className="w-full sm:w-auto gap-1.5 text-xs rounded-xl font-semibold bg-[#0f3d3e] hover:bg-[#0f3d3e]/90 text-white dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90 shadow-sm"
              >
                Next: Select Rows <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 3 && (
              <Button
                size="sm"
                onClick={handleExecuteImport}
                disabled={activeSelectedCount === 0}
                className="w-full sm:w-auto gap-1.5 text-xs rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                <Check className="h-4 w-4" /> Import {activeSelectedCount} Leads
              </Button>
            )}

            {step === 4 && (
              <Button
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="w-full sm:w-auto text-xs rounded-xl font-semibold bg-[#0f3d3e] hover:bg-[#0f3d3e]/90 text-white dark:bg-[#beebeb] dark:text-[#002020] shadow-sm"
              >
                Done & View Leads
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
