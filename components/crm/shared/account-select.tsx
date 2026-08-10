"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, type PagedResult } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account } from "@/lib/types/crm";

const NONE = "__none__";

// Mirrors components/crm/shared/user-select.tsx's UserSelect -- same
// reasoning: a raw numeric Account ID typed by hand is not something anyone
// can reasonably know off the top of their head.
export function useCrmAccounts() {
  return useQuery({
    queryKey: ["crm", "accounts", "all"],
    queryFn: async () => {
      const res = await apiClient.get<PagedResult<Account>>("crm/accounts?page=0&size=200");
      return res.content;
    },
  });
}

// For read-only displays (pipeline cards, etc.) that need to turn a bare
// accountId into the account's name instead of "Account #7".
export function useAccountNameLookup() {
  const { data } = useCrmAccounts();
  return React.useMemo(() => {
    const map = new Map<number, string>();
    (data ?? []).forEach((a) => map.set(a.id, a.name));
    return map;
  }, [data]);
}

interface AccountSelectProps {
  value: number | null | undefined;
  onChange: (id: number | undefined) => void;
  placeholder?: string;
  allowNone?: boolean;
  className?: string;
}

export function AccountSelect({ value, onChange, placeholder = "Select account", allowNone = true, className }: AccountSelectProps) {
  const accountsQuery = useCrmAccounts();
  const accounts = accountsQuery.data ?? [];

  const items = React.useMemo(() => {
    const map: Record<string, React.ReactNode> = {};
    if (allowNone) map[NONE] = "None";
    accounts.forEach((a) => { map[String(a.id)] = a.name; });
    return map;
  }, [accounts, allowNone]);

  return (
    <Select
      items={items}
      value={value ? String(value) : allowNone ? NONE : ""}
      onValueChange={(v) => onChange(!v || v === NONE ? undefined : Number(v))}
    >
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder={accountsQuery.isLoading ? "Loading accounts…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>None</SelectItem>}
        {accounts.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
