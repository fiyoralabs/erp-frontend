// Standards-based option lists (ECMA-402 `Intl.supportedValuesOf`, supported
// in modern Node/browsers) -- real IANA timezones and ISO 4217 currency
// codes, not a hand-maintained/incomplete hardcoded list.

export interface LabeledOption {
  value: string;
  label: string;
}

let cachedCurrencies: LabeledOption[] | null = null;
export function getCurrencyOptions(): LabeledOption[] {
  if (cachedCurrencies) return cachedCurrencies;
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  cachedCurrencies = Intl.supportedValuesOf("currency")
    .map((code) => ({ value: code, label: `${code} — ${names.of(code) ?? code}` }))
    .sort((a, b) => a.value.localeCompare(b.value));
  return cachedCurrencies;
}

let cachedTimezones: LabeledOption[] | null = null;
// India has a single timezone nationwide (no daylight saving, no regional
// zones) -- pin it first since this ERP is India-first (GST, INR defaults,
// erp's own auto-provisioning defaults new locations to it), rather than
// leaving it buried alphabetically among 418 global entries.
const PINNED_TIMEZONES = ["Asia/Kolkata"];
export function getTimezoneOptions(): LabeledOption[] {
  if (cachedTimezones) return cachedTimezones;
  const all = Intl.supportedValuesOf("timeZone").map((tz) => ({
    value: tz,
    label: tz.replace(/_/g, " "),
  }));
  const pinned = PINNED_TIMEZONES.map((tz) => all.find((o) => o.value === tz)).filter(
    (o): o is LabeledOption => !!o
  );
  const rest = all
    .filter((o) => !PINNED_TIMEZONES.includes(o.value))
    .sort((a, b) => a.value.localeCompare(b.value));
  cachedTimezones = [...pinned, ...rest];
  return cachedTimezones;
}

let validCurrencySet: Set<string> | null = null;
export function isValidCurrency(code: string): boolean {
  if (!validCurrencySet) validCurrencySet = new Set(Intl.supportedValuesOf("currency"));
  return validCurrencySet.has(code);
}

let validTimezoneSet: Set<string> | null = null;
// A location's timezone is used later to format/print real dates and times
// (receipts, reports) -- unlike City, this must be an exact, valid IANA
// identifier or downstream date formatting breaks, so it's validated
// strictly rather than accepted as arbitrary free text.
export function isValidTimezone(tz: string): boolean {
  if (!validTimezoneSet) validTimezoneSet = new Set(Intl.supportedValuesOf("timeZone"));
  return validTimezoneSet.has(tz);
}
