"use client";

// Free-text input with filtered, clickable suggestions -- built on Base UI's
// own Combobox primitive (@base-ui/react/combobox, shipped in this
// project's base-nova preset), not the native HTML <datalist> element.
// datalist was tried first for city/currency/timezone fields and turned out
// unreliable in practice (no visible affordance that it's interactive, and
// popup rendering is inconsistent -- especially nested inside a Dialog,
// which uses a CSS transform for centering that datalist's native browser
// popup doesn't reliably render over). Base UI's Combobox uses the same
// Portal/Positioner machinery as this app's Select/Dialog/Popover, so it's
// guaranteed to render and behave consistently everywhere, including nested
// inside a Dialog.
//
// Filtering is done manually here (`filter={null}` disables Root's own
// internal filter) rather than relying on Base UI's default filter
// resolution. That default path was verified live (via browser devtools)
// to sometimes mark the list `data-list-empty` even when `inputValue`
// exactly equals an item's label (e.g. value="Asia/Kolkata" against an
// item {value:"Asia/Kolkata", label:"Asia/Kolkata"}) -- its single-selection
// filter path depends on Root's own uncontrolled "selected value" concept,
// which this component intentionally never sets (city/currency/timezone
// have no separate "selected object", just a plain string). Doing our own
// case-insensitive contains() match and disabling the built-in filter
// removes that whole class of mismatch.
//
// Always free-text: whatever is typed is the value, regardless of whether
// it matches a suggestion -- selecting a suggestion just fills the input.

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyMessage?: string;
  id?: string;
  className?: string;
}

export function ComboboxField({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage = "No matches — you can still use what you've typed.",
  id,
  className,
}: ComboboxFieldProps) {
  const [query, setQuery] = React.useState(value ?? "");

  React.useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 100);
    return options
      .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      .slice(0, 100);
  }, [options, query]);

  return (
    <ComboboxPrimitive.Root
      items={filtered}
      filter={null}
      itemToStringLabel={(item: ComboboxOption) => item.label}
      itemToStringValue={(item: ComboboxOption) => item.value}
      inputValue={query}
      onInputValueChange={(next) => {
        setQuery(next);
        onChange(next);
      }}
      onValueChange={(item) => {
        const opt = item as ComboboxOption | null;
        if (opt) {
          setQuery(opt.value);
          onChange(opt.value);
        }
      }}
    >
      <ComboboxPrimitive.InputGroup className="relative flex items-center">
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-8 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
            className
          )}
        />
        <ComboboxPrimitive.Trigger
          className="absolute right-1 flex size-6 items-center justify-center text-muted-foreground outline-none"
          aria-label="Show suggestions"
        >
          <ChevronsUpDown className="size-4" />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="z-50 outline-none" sideOffset={4}>
          <ComboboxPrimitive.Popup className="max-h-64 w-(--anchor-width) overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <ComboboxPrimitive.Empty>
              <div className="px-2 py-1.5 text-sm text-muted-foreground">{emptyMessage}</div>
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <ComboboxPrimitive.ItemIndicator className="flex size-4 items-center justify-center">
                    <Check className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                  {item.label}
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
