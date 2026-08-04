"use client";

import { MasterCrudPage, type CrudFieldConfig } from "@/components/master/master-crud-page";
import { ActiveBadge } from "@/components/shared/active-badge";
import type { DataTableColumn } from "@/components/data-table/data-table";
import { customerGroupSchema, type CustomerGroupFormValues } from "@/lib/validation/master";
import type { CustomerGroup } from "@/lib/types/master";

const columns: DataTableColumn<CustomerGroup>[] = [
  { key: "code", header: "Code", render: (r) => r.code },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "priceList", header: "Default Price List", render: (r) => r.defaultPriceListName ?? "—" },
  { key: "creditLimit", header: "Credit Limit", render: (r) => r.creditLimit },
  { key: "creditDays", header: "Credit Days", render: (r) => r.creditDays },
  { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
];

const fields: CrudFieldConfig<CustomerGroupFormValues>[] = [
  { name: "code", label: "Code", type: "text", placeholder: "WHOLESALE", disabledOnEdit: true },
  { name: "name", label: "Name", type: "text", placeholder: "Wholesale" },
  {
    name: "defaultPriceListId",
    label: "Default Price List ID",
    type: "number",
    placeholder: "See Price Lists page for IDs",
  },
  { name: "creditLimit", label: "Credit Limit", type: "number", step: "0.01" },
  { name: "creditDays", label: "Credit Days", type: "number" },
];

const emptyValues: CustomerGroupFormValues = {
  code: "",
  name: "",
  defaultPriceListId: undefined,
  creditLimit: 0,
  creditDays: 0,
};

export default function CustomerGroupsPage() {
  return (
    <MasterCrudPage<CustomerGroup, CustomerGroupFormValues>
      title="Customer Groups"
      description="Customer segments (Retail, Wholesale, VIP, Dealer) with credit and pricing defaults."
      apiPath="master/customer-groups"
      queryKey="customer-groups"
      columns={columns}
      fields={fields}
      schema={customerGroupSchema}
      emptyValues={emptyValues}
      toFormValues={(row) => ({
        code: row.code,
        name: row.name,
        defaultPriceListId: row.defaultPriceListId,
        creditLimit: row.creditLimit,
        creditDays: row.creditDays,
        isActive: row.isActive,
      })}
      entityLabel="customer group"
    />
  );
}
