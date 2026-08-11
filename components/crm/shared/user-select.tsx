"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, type PagedResult } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/lib/types/settings";
import type { CurrentUser } from "@/lib/types/user";

const UNASSIGNED = "__unassigned__";

// Shared across every CRM "assign to a user" field so there's one place
// that knows how to list company users -- previously several dialogs asked
// for a raw numeric user id typed by hand, which nobody could reasonably
// know off the top of their head.
export function useCrmUsers() {
  return useQuery({
    queryKey: ["crm", "users", "all"],
    queryFn: async () => {
      const res = await apiClient.get<PagedResult<User>>("users?page=0&size=200");
      return res.content.filter((u) => u.isActive);
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiClient.get<CurrentUser>("users/me"),
  });
}

// For read-only displays (list rows, detail pages) that need to turn a bare
// assignedUserId/createdBy id into the person's name instead of "User #7".
export function useUserNameLookup() {
  const { data } = useCrmUsers();
  return React.useMemo(() => {
    const map = new Map<number, string>();
    (data ?? []).forEach((u) => map.set(u.id, u.fullName));
    return map;
  }, [data]);
}

interface UserSelectProps {
  value: number | null | undefined;
  onChange: (id: number | undefined) => void;
  placeholder?: string;
  allowUnassigned?: boolean;
  className?: string;
}

export function UserSelect({ value, onChange, placeholder = "Select user", allowUnassigned = true, className }: UserSelectProps) {
  const usersQuery = useCrmUsers();
  const users = usersQuery.data ?? [];

  // Base UI's Select only learns an item's label by mounting its SelectItem,
  // which normally happens the first time the popup opens. A value assigned
  // programmatically (e.g. defaulting to the current user before the user
  // ever opens the dropdown) would otherwise render as the raw id until
  // then, so the label map is handed to Select.Root up front instead.
  const items = React.useMemo(() => {
    const map: Record<string, React.ReactNode> = {};
    if (allowUnassigned) map[UNASSIGNED] = "Unassigned";
    users.forEach((u) => { map[String(u.id)] = u.fullName; });
    return map;
  }, [users, allowUnassigned]);

  return (
    <Select
      items={items}
      value={value ? String(value) : allowUnassigned ? UNASSIGNED : ""}
      onValueChange={(v) => onChange(!v || v === UNASSIGNED ? undefined : Number(v))}
    >
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder={usersQuery.isLoading ? "Loading users…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowUnassigned && <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>}
        {users.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
