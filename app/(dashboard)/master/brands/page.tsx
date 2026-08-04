"use client";

import { MasterCrudPage, type CrudFieldConfig } from "@/components/master/master-crud-page";
import { ActiveBadge } from "@/components/shared/active-badge";
import type { DataTableColumn } from "@/components/data-table/data-table";
import { brandSchema, type BrandFormValues } from "@/lib/validation/master";
import type { Brand } from "@/lib/types/master";

const columns: DataTableColumn<Brand>[] = [
  { key: "code", header: "Code", render: (r) => r.code },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
];

const fields: CrudFieldConfig<BrandFormValues>[] = [
  { name: "code", label: "Code", type: "text", placeholder: "NIKE", disabledOnEdit: true },
  { name: "name", label: "Name", type: "text", placeholder: "Nike" },
  { name: "logoUrl", label: "Logo URL", type: "text", placeholder: "https://…" },
];

const emptyValues: BrandFormValues = { code: "", name: "", logoUrl: "" };

export default function BrandsPage() {
  return (
    <MasterCrudPage<Brand, BrandFormValues>
      title="Brands"
      description="Product brands used for catalog filtering."
      apiPath="master/brands"
      queryKey="brands"
      columns={columns}
      fields={fields}
      schema={brandSchema}
      emptyValues={emptyValues}
      toFormValues={(row) => ({
        code: row.code,
        name: row.name,
        logoUrl: row.logoUrl ?? "",
        isActive: row.isActive,
      })}
      entityLabel="brand"
    />
  );
}
