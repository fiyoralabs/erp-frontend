"use client";

import { MasterCrudPage, type CrudFieldConfig } from "@/components/master/master-crud-page";
import { ActiveBadge } from "@/components/shared/active-badge";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/data-table/data-table";
import { taxSchema, type TaxFormValues } from "@/lib/validation/master";
import type { Tax } from "@/lib/types/master";

const columns: DataTableColumn<Tax>[] = [
  { key: "code", header: "Code", render: (r) => r.code },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "rate", header: "Rate", render: (r) => `${r.taxPercentage}%` },
  {
    key: "default",
    header: "Default",
    render: (r) => (r.isDefault ? <Badge variant="outline">Default</Badge> : "—"),
  },
  { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
];

const fields: CrudFieldConfig<TaxFormValues>[] = [
  { name: "code", label: "Code", type: "text", placeholder: "GST18", disabledOnEdit: true },
  { name: "name", label: "Name", type: "text", placeholder: "GST 18%" },
  { name: "taxPercentage", label: "Tax Percentage", type: "number", step: "0.01" },
  { name: "isDefault", label: "Set as default tax", type: "checkbox" },
];

const emptyValues: TaxFormValues = { code: "", name: "", taxPercentage: 0, isDefault: false };

export default function TaxesPage() {
  return (
    <MasterCrudPage<Tax, TaxFormValues>
      title="Taxes"
      description="Flat tax rates applied to products and invoices (GST 0%, 5%, 18%, etc.)."
      apiPath="master/taxes"
      queryKey="taxes"
      columns={columns}
      fields={fields}
      schema={taxSchema}
      emptyValues={emptyValues}
      toFormValues={(row) => ({
        code: row.code,
        name: row.name,
        taxPercentage: row.taxPercentage,
        isDefault: row.isDefault,
        isActive: row.isActive,
      })}
      entityLabel="tax"
    />
  );
}
