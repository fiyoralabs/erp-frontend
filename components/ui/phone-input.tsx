"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CountryCode {
  code: string;       // e.g. "IN"
  name: string;       // e.g. "India"
  dialCode: string;   // e.g. "+91"
  flag: string;       // e.g. "🇮🇳"
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { code: "OM", name: "Oman", dialCode: "+968", flag: "🇴🇲" },
  { code: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", dialCode: "+973", flag: "🇧🇭" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
];

export function sanitizePhoneNumber(phoneStr: string | null | undefined): string {
  if (!phoneStr) return "";
  let clean = phoneStr.replace(/^(p:|tel:|ph:|mobile:|phone:)\s*/i, "").trim();
  const startsWithPlus = clean.startsWith("+");
  const digits = clean.replace(/[^0-9]/g, "");
  if (!digits) return "";

  if (startsWithPlus) {
    return "+" + digits;
  }
  let local = digits;
  if (local.startsWith("0")) {
    local = local.substring(1);
  }
  if (local.length === 10) {
    return "+91" + local;
  }
  if (local.length === 12 && local.startsWith("91")) {
    return "+" + local;
  }
  return "+" + local;
}

export function parsePhoneParts(fullPhone: string | null | undefined): { dialCode: string; number: string } {
  if (!fullPhone) return { dialCode: "+91", number: "" };
  const clean = sanitizePhoneNumber(fullPhone);
  if (!clean) return { dialCode: "+91", number: "" };

  const matchedCountry = COUNTRY_CODES.find(c => clean.startsWith(c.dialCode));
  if (matchedCountry) {
    return {
      dialCode: matchedCountry.dialCode,
      number: clean.slice(matchedCountry.dialCode.length),
    };
  }

  if (clean.startsWith("+")) {
    return { dialCode: "+91", number: clean.replace(/[^0-9]/g, "") };
  }

  return { dialCode: "+91", number: clean.replace(/[^0-9]/g, "") };
}

interface PhoneInputProps {
  value?: string;
  onChange?: (normalizedValue: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

export function PhoneInput({ value = "", onChange, placeholder = "e.g. 9876543210", id, disabled }: PhoneInputProps) {
  const parts = React.useMemo(() => parsePhoneParts(value), [value]);
  const [selectedDialCode, setSelectedDialCode] = React.useState<string>(parts.dialCode);
  const [phoneNumber, setPhoneNumber] = React.useState<string>(parts.number);

  React.useEffect(() => {
    const updated = parsePhoneParts(value);
    setSelectedDialCode(updated.dialCode);
    setPhoneNumber(updated.number);
  }, [value]);

  const handleDialCodeChange = (newCode: string | null) => {
    if (!newCode) return;
    setSelectedDialCode(newCode);
    emitChange(newCode, phoneNumber);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleanDigits = raw.replace(/^(p:|tel:|ph:|mobile:|phone:)\s*/i, "").replace(/[^0-9]/g, "");
    setPhoneNumber(cleanDigits);
    emitChange(selectedDialCode, cleanDigits);
  };

  const emitChange = (dialCode: string, digits: string) => {
    if (!digits) {
      if (onChange) onChange("");
      return;
    }
    const fullNormalized = `${dialCode}${digits}`;
    if (onChange) onChange(fullNormalized);
  };

  const activeCountry = COUNTRY_CODES.find(c => c.dialCode === selectedDialCode) || COUNTRY_CODES[0];

  return (
    <div className="flex items-center gap-1.5 w-full">
      {/* Country Code & Flag Selector */}
      <Select value={selectedDialCode} onValueChange={handleDialCodeChange} disabled={disabled}>
        <SelectTrigger className="h-9 text-xs w-[110px] shrink-0 bg-background border-input px-2.5 flex items-center justify-between">
          <SelectValue>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="text-base leading-none">{activeCountry.flag}</span>
              <span>{activeCountry.dialCode}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover text-popover-foreground max-h-60">
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={`${c.code}-${c.dialCode}`} value={c.dialCode}>
              <span className="flex items-center gap-2 text-xs">
                <span className="text-base leading-none">{c.flag}</span>
                <span className="font-medium text-foreground">{c.dialCode}</span>
                <span className="text-muted-foreground font-normal">({c.name})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Number Input */}
      <Input
        id={id}
        type="tel"
        value={phoneNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        disabled={disabled}
        className="h-9 text-xs flex-1"
      />
    </div>
  );
}
