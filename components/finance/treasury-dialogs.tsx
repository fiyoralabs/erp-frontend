"use client";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { BankAccount, CashAccount, Reconciliation } from "@/lib/types/finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const message = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong");

export function TreasuryEditDialog({
  cash,
  bank,
  close,
  saved,
}: {
  cash: CashAccount | null;
  bank: BankAccount | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const value = cash ?? bank;
  const [name, setName] = React.useState("");
  const [institution, setInstitution] = React.useState("");
  const [swift, setSwift] = React.useState("");
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (cash) {
      setName(cash.name);
      setActive(cash.isActive);
    } else if (bank) {
      setName(bank.accountName);
      setInstitution(bank.bankName);
      setSwift(bank.swiftCode ?? "");
      setActive(bank.isActive);
    }
  }, [cash, bank]);

  const mutation = useMutation({
    mutationFn: () =>
      cash
        ? apiClient.put(`finance/cash-accounts/${cash.id}`, { name, isActive: active })
        : apiClient.put(`finance/bank-accounts/${bank!.id}`, {
            accountName: name,
            bankName: institution,
            swiftCode: swift || null,
            isActive: active,
          }),
    onSuccess: async () => {
      toast.success("Treasury account updated");
      await saved();
    },
    onError: (e) => toast.error(message(e)),
  });

  return (
    <Dialog open={!!value} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {cash ? "cash" : "bank"} account</DialogTitle>
            <DialogDescription>
              The GL link and opening balance are permanent. Deactivation preserves accounting history.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-4">
            <Field label="Account name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            {bank && (
              <>
                <Field label="Bank name">
                  <Input required value={institution} onChange={(e) => setInstitution(e.target.value)} />
                </Field>
                <Field label="SWIFT / IFSC">
                  <Input value={swift} onChange={(e) => setSwift(e.target.value)} />
                </Field>
              </>
            )}

            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Account active
            </label>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={mutation.isPending} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
              {mutation.isPending && <Loader2 className="animate-spin" />}Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReconciliationDetail({ id, close }: { id: number | null; close: () => void }) {
  const detail = useQuery({
    queryKey: ["finance", "reconciliation", id],
    queryFn: () => apiClient.get<Reconciliation>(`finance/reconciliations/${id}`),
    enabled: id !== null,
  });

  const x = detail.data;

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        {detail.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#0F3D3E]" />
            <span>Loading reconciliation detail...</span>
          </div>
        ) : (
          x && (
            <>
              <DialogHeader>
                <DialogTitle>{x.bankAccountName} reconciliation</DialogTitle>
                <DialogDescription>
                  Statement date {x.statementDate} · {x.status}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 bg-muted/10">
                <Info label="Statement balance" value={money.format(x.statementBalance)} />
                <Info label="Book balance" value={money.format(x.bookBalance)} />
                <Info label="Difference" value={money.format(x.difference)} />
                <Info label="Reconciled at" value={new Date(x.reconciledAt).toLocaleString()} />
                <Info label="Notes" value={x.notes ?? "—"} />
              </div>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
