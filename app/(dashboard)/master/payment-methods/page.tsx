"use client";

import { MasterCrudPage, type CrudFieldConfig } from "@/components/master/master-crud-page";
import { ActiveBadge } from "@/components/shared/active-badge";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/data-table/data-table";
import { paymentMethodSchema, type PaymentMethodFormValues } from "@/lib/validation/master";
import type { PaymentMethod } from "@/lib/types/master";

const columns: DataTableColumn<PaymentMethod>[] = [
  { key: "code", header: "Code", render: (r) => r.code },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "order", header: "Order", render: (r) => r.displayOrder },
  {
    key: "default",
    header: "Default",
    render: (r) => (r.isDefault ? <Badge variant="outline">Default</Badge> : "—"),
  },
  { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.isActive} /> },
];

const fields: CrudFieldConfig<PaymentMethodFormValues>[] = [
  { name: "code", label: "Code", type: "text", placeholder: "CASH", disabledOnEdit: true },
  { name: "name", label: "Name", type: "text", placeholder: "Cash" },
  { name: "displayOrder", label: "Display Order", type: "number" },
  { name: "isDefault", label: "Set as default method", type: "checkbox" },
];

const emptyValues: PaymentMethodFormValues = {
  code: "",
  name: "",
  displayOrder: 0,
  isDefault: false,
};

export default function PaymentMethodsPage() {
  return (
    <MasterCrudPage<PaymentMethod, PaymentMethodFormValues>
      title="Payment Methods"
      description="Payment methods accepted at checkout (Cash, Card, UPI, Net Banking, etc.)."
      apiPath="master/payment-methods"
      queryKey="payment-methods"
      columns={columns}
      fields={fields}
      schema={paymentMethodSchema}
      emptyValues={emptyValues}
      toFormValues={(row) => ({
        code: row.code,
        name: row.name,
        displayOrder: row.displayOrder,
        isDefault: row.isDefault,
        isActive: row.isActive,
      })}
      entityLabel="payment method"
    />
  );
}
