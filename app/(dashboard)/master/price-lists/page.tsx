"use client";

import { MasterCrudPage, type CrudFieldConfig } from "@/components/master/master-crud-page";
import { ActiveBadge } from "@/components/shared/active-badge";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/data-table/data-table";
import { priceListSchema, type PriceListFormValues } from "@/lib/validation/master";
import type { PriceList } from "@/lib/types/master";

const columns: DataTableColumn<PriceList>[] = [
  { key: "code", header: "Code", render: (r) => r.code },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "priority", header: "Priority", render: (r) => r.priority },
  { key: "minQty", header: "Min Qty", render: (r) => r.minimumQuantity },
  {
    key: "default",
    header: "Default",
    render: (r) => (r.isDefault ? <Badge variant="outline">Default</Badge> : "—"),
  },
  { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
];

const fields: CrudFieldConfig<PriceListFormValues>[] = [
  { name: "code", label: "Code", type: "text", placeholder: "RETAIL", disabledOnEdit: true },
  { name: "name", label: "Name", type: "text", placeholder: "Retail" },
  { name: "description", label: "Description", type: "text" },
  { name: "minimumQuantity", label: "Minimum Quantity", type: "number", step: "0.001" },
  { name: "priority", label: "Priority", type: "number" },
  { name: "isDefault", label: "Set as default price list", type: "checkbox" },
];

const emptyValues: PriceListFormValues = {
  code: "",
  name: "",
  description: "",
  minimumQuantity: 1,
  priority: 1,
  isDefault: false,
};

export default function PriceListsPage() {
  return (
    <MasterCrudPage<PriceList, PriceListFormValues>
      title="Price Lists"
      description="Selling price lists (Retail, Wholesale, VIP) assigned to locations and customer groups."
      apiPath="master/price-lists"
      queryKey="price-lists"
      columns={columns}
      fields={fields}
      schema={priceListSchema}
      emptyValues={emptyValues}
      toFormValues={(row) => ({
        code: row.code,
        name: row.name,
        description: row.description ?? "",
        minimumQuantity: row.minimumQuantity,
        priority: row.priority,
        isDefault: row.isDefault,
        isActive: row.isActive,
      })}
      entityLabel="price list"
    />
  );
}
