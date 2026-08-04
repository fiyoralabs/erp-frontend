"use client";

import { MasterCrudPage, type CrudFieldConfig } from "@/components/master/master-crud-page";
import { ActiveBadge } from "@/components/shared/active-badge";
import type { DataTableColumn } from "@/components/data-table/data-table";
import { reasonSchema, type ReasonFormValues } from "@/lib/validation/master";
import type { Reason } from "@/lib/types/master";

const columns: DataTableColumn<Reason>[] = [
  { key: "code", header: "Code", render: (r) => r.code },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "type", header: "Type", render: (r) => r.reasonType },
  { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
];

// reasonType is a free-text field server-side -- these are common conventions
// (used by Inventory adjustments and Sales/Purchase returns) offered as a
// dropdown for consistency, not enforced by the backend.
const fields: CrudFieldConfig<ReasonFormValues>[] = [
  { name: "code", label: "Code", type: "text", placeholder: "DAMAGED", disabledOnEdit: true },
  { name: "name", label: "Name", type: "text", placeholder: "Damaged in transit" },
  {
    name: "reasonType",
    label: "Reason Type",
    type: "select",
    options: [
      { value: "STOCK_ADJUSTMENT", label: "Stock Adjustment" },
      { value: "SALES_RETURN", label: "Sales Return" },
      { value: "PURCHASE_RETURN", label: "Purchase Return" },
      { value: "EXPIRY", label: "Expiry" },
      { value: "DAMAGE", label: "Damage" },
      { value: "LOSS", label: "Loss" },
      { value: "CANCELLATION", label: "Cancellation" },
    ],
  },
];

const emptyValues: ReasonFormValues = { code: "", name: "", reasonType: "" };

export default function ReasonsPage() {
  return (
    <MasterCrudPage<Reason, ReasonFormValues>
      title="Reasons"
      description="Reason codes used for stock adjustments, returns, and cancellations."
      apiPath="master/reasons"
      queryKey="reasons"
      columns={columns}
      fields={fields}
      schema={reasonSchema}
      emptyValues={emptyValues}
      toFormValues={(row) => ({
        code: row.code,
        name: row.name,
        reasonType: row.reasonType,
        isActive: row.isActive,
      })}
      entityLabel="reason"
    />
  );
}
