"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, type PagedResult } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Contact } from "@/lib/types/crm";

const NONE = "__none__";

function contactName(c: Contact) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

// Mirrors components/crm/shared/user-select.tsx's UserSelect.
export function useCrmContacts() {
  return useQuery({
    queryKey: ["crm", "contacts", "all"],
    queryFn: async () => {
      const res = await apiClient.get<PagedResult<Contact>>("crm/contacts?page=0&size=200");
      return res.content;
    },
  });
}

export function useContactNameLookup() {
  const { data } = useCrmContacts();
  return React.useMemo(() => {
    const map = new Map<number, string>();
    (data ?? []).forEach((c) => map.set(c.id, contactName(c)));
    return map;
  }, [data]);
}

interface ContactSelectProps {
  value: number | null | undefined;
  onChange: (id: number | undefined) => void;
  placeholder?: string;
  allowNone?: boolean;
  className?: string;
}

export function ContactSelect({ value, onChange, placeholder = "Select contact", allowNone = true, className }: ContactSelectProps) {
  const contactsQuery = useCrmContacts();
  const contacts = contactsQuery.data ?? [];

  const items = React.useMemo(() => {
    const map: Record<string, React.ReactNode> = {};
    if (allowNone) map[NONE] = "None";
    contacts.forEach((c) => { map[String(c.id)] = contactName(c); });
    return map;
  }, [contacts, allowNone]);

  return (
    <Select
      items={items}
      value={value ? String(value) : allowNone ? NONE : ""}
      onValueChange={(v) => onChange(!v || v === NONE ? undefined : Number(v))}
    >
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder={contactsQuery.isLoading ? "Loading contacts…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>None</SelectItem>}
        {contacts.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {contactName(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
