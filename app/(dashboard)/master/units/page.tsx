"use client";

import { MasterCrudPage, type CrudFieldConfig } from "@/components/master/master-crud-page";
import { ActiveBadge } from "@/components/shared/active-badge";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/data-table/data-table";
import { unitSchema, type UnitFormValues } from "@/lib/validation/master";
import type { Unit } from "@/lib/types/master";

const columns: DataTableColumn<Unit>[] = [
  { key: "code", header: "Code", render: (r) => r.code },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "symbol", header: "Symbol", render: (r) => r.symbol },
  { key: "precision", header: "Decimals", render: (r) => r.decimalPrecision },
  {
    key: "default",
    header: "Default",
    render: (r) => (r.isDefault ? <Badge variant="outline">Default</Badge> : "—"),
  },
  { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
];

const fields: CrudFieldConfig<UnitFormValues>[] = [
  { name: "code", label: "Code", type: "text", placeholder: "KG", disabledOnEdit: true },
  { name: "name", label: "Name", type: "text", placeholder: "Kilogram" },
  { name: "symbol", label: "Symbol", type: "text", placeholder: "kg" },
  { name: "decimalPrecision", label: "Decimal Precision (e.g. 2 for KG, 0 for Piece/PCS)", type: "number", step: "1" },
  { name: "isDefault", label: "Set as default unit", type: "checkbox" },
];

const emptyValues: UnitFormValues = {
  code: "",
  name: "",
  symbol: "",
  decimalPrecision: 2,
  isDefault: false,
};

export default function UnitsPage() {
  return (
    <MasterCrudPage<Unit, UnitFormValues>
      title="Units of Measure"
      description="Units used across products. Weight and liquid units (e.g., Kg, Litre) support decimal quantities, whereas count units (e.g., Piece, PCS, Box, Nos) use 0 decimals."
      apiPath="master/units"
      queryKey="units"
      columns={columns}
      fields={fields}
      schema={unitSchema}
      emptyValues={emptyValues}
      toFormValues={(row) => ({
        code: row.code,
        name: row.name,
        symbol: row.symbol,
        decimalPrecision: row.decimalPrecision,
        isDefault: row.isDefault,
        isActive: row.isActive,
      })}
      entityLabel="unit"
    />
  );
}
