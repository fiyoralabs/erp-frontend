"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import {
  locationConfigurationSchema,
  type LocationConfigurationFormValues,
} from "@/lib/validation/master";
import type { Location, LocationConfiguration, PriceList } from "@/lib/types/master";
import { getCurrencyOptions, getTimezoneOptions } from "@/lib/intl-options";
import { ComboboxField } from "@/components/shared/combobox-field";

const CONFIG_TOGGLES = [
  {
    name: "allowNegativeStock" as const,
    label: "Allow negative stock",
    description:
      "Lets a sale complete even if it would take quantity-on-hand below zero. Useful for pre-orders/backorders; turn off if you need stock counts to always be accurate.",
  },
  {
    name: "enableRoundOff" as const,
    label: "Enable round-off",
    description:
      "Rounds the final invoice total to the nearest whole currency unit (e.g. 99.60 → 100) instead of showing exact decimals.",
  },
  {
    name: "enableBarcode" as const,
    label: "Enable barcode scanning",
    description:
      "Turns on barcode-scanner input on this location's checkout screen for fast product lookup by scanning instead of searching.",
  },
  {
    name: "enableKot" as const,
    label: "Enable Kitchen Order Tickets (KOT)",
    description:
      "For food-service locations: sends orders to a kitchen printer/display as a prep ticket, separate from the customer's receipt. Leave off for retail/warehouse locations.",
  },
];

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const locationId = params.id;

  const locationQuery = useQuery({
    queryKey: ["master", "locations", "detail", locationId],
    queryFn: () => apiClient.get<Location>(`master/locations/${locationId}`),
  });

  const configQuery = useQuery({
    queryKey: ["master", "locations", "configuration", locationId],
    queryFn: () =>
      apiClient.get<LocationConfiguration>(`master/locations/${locationId}/configuration`),
  });

  const allPriceListsQuery = useQuery({
    queryKey: ["master", "price-lists", "all-for-assignment"],
    queryFn: () =>
      apiClient.get<{ content: PriceList[] }>("master/price-lists?page=0&size=100"),
  });

  const assignedPriceListsQuery = useQuery({
    queryKey: ["master", "locations", "price-lists", locationId],
    queryFn: () => apiClient.get<PriceList[]>(`master/locations/${locationId}/price-lists`),
  });

  const configForm = useForm<LocationConfigurationFormValues>({
    resolver: zodResolver(locationConfigurationSchema),
    // Every field needs a real defined value (never `undefined`) from the
    // very first render -- react-hook-form/Base UI's Input decide
    // controlled-vs-uncontrolled from whatever the first render's value is,
    // and `values` below only exists once configQuery has loaded. Without
    // this, every field starts undefined (uncontrolled) then flips to a
    // real string (controlled) the moment data arrives, which is exactly
    // the "changing from uncontrolled to controlled" React/Base UI error.
    defaultValues: {
      currency: "",
      timezone: "",
      receiptTemplate: "",
      invoicePrefix: "",
      allowNegativeStock: false,
      enableRoundOff: false,
      enableBarcode: false,
      enableKot: false,
      printerName: "",
    },
    values: configQuery.data
      ? {
          currency: configQuery.data.currency ?? "",
          timezone: configQuery.data.timezone ?? "",
          receiptTemplate: configQuery.data.receiptTemplate ?? "",
          invoicePrefix: configQuery.data.invoicePrefix ?? "",
          allowNegativeStock: configQuery.data.allowNegativeStock,
          enableRoundOff: configQuery.data.enableRoundOff,
          enableBarcode: configQuery.data.enableBarcode,
          enableKot: configQuery.data.enableKot,
          printerName: configQuery.data.printerName ?? "",
        }
      : undefined,
  });

  const saveConfigMutation = useMutation({
    mutationFn: (values: LocationConfigurationFormValues) =>
      apiClient.put<LocationConfiguration>(
        `master/locations/${locationId}/configuration`,
        values
      ),
    onSuccess: () => {
      toast.success("Configuration saved");
      qc.invalidateQueries({ queryKey: ["master", "locations", "configuration", locationId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const currencyOptions = React.useMemo(() => getCurrencyOptions(), []);
  const timezoneOptions = React.useMemo(() => getTimezoneOptions(), []);

  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [defaultId, setDefaultId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!assignedPriceListsQuery.data) return;
    setSelectedIds(new Set(assignedPriceListsQuery.data.map((p) => p.id)));
    // erp doesn't echo which one is "default" back on the read endpoint's
    // PriceListResponse shape distinctly from its own isDefault (that's the
    // price list's own default flag, not this location's chosen default) --
    // default assignment is write-only from this screen's perspective.
  }, [assignedPriceListsQuery.data]);

  const assignMutation = useMutation({
    mutationFn: () =>
      apiClient.post<void>(`master/locations/${locationId}/price-lists`, {
        priceLists: Array.from(selectedIds).map((id) => ({
          priceListId: id,
          isDefault: id === defaultId,
        })),
      }),
    onSuccess: () => {
      toast.success("Price lists assigned");
      qc.invalidateQueries({ queryKey: ["master", "locations", "price-lists", locationId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (locationQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading location...</p>;
  }
  if (!locationQuery.data) {
    return <p className="text-sm text-destructive">Location not found.</p>;
  }

  const location = locationQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="w-fit gap-1.5 px-2" onClick={() => router.push("/master/locations")}>
        <ArrowLeft className="size-4" />
        Back to locations
      </Button>

      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{location.name}</h1>
        <p className="text-sm text-muted-foreground">
          {location.code} · {location.type}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>POS / operational configuration</CardTitle>
          <CardDescription>Auto-provisioned when the location was created.</CardDescription>
        </CardHeader>
        <CardContent>
          {configQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Form {...configForm}>
              <form
                onSubmit={configForm.handleSubmit((values) => saveConfigMutation.mutate(values))}
                className="flex flex-col gap-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={configForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <ComboboxField
                            id={field.name}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            options={currencyOptions}
                            placeholder="e.g. INR"
                            emptyMessage="No matching currency — this must be picked from the list, not free text."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={configForm.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <FormControl>
                          <ComboboxField
                            id={field.name}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            options={timezoneOptions}
                            placeholder="e.g. Asia/Kolkata"
                            emptyMessage="No matching timezone — this must be picked from the list, not free text."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={configForm.control}
                    name="invoicePrefix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Prefix</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={configForm.control}
                    name="receiptTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receipt Template</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={configForm.control}
                    name="printerName"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Printer Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. EPSON-TM-T88VI-Counter1" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Browsers can&apos;t see what printers are installed on a device (no
                          web API exposes that, for the same privacy reasons a website can&apos;t
                          list your files) — so this can&apos;t be auto-detected or offered as a
                          real dropdown from here. Type the exact name of the receipt/kitchen
                          printer as it&apos;s set up on this location&apos;s POS device. If you
                          later add a local print bridge (e.g. QZ Tray) for direct thermal
                          printing, that name should match what it registers.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {CONFIG_TOGGLES.map(({ name, label, description }) => (
                    <FormField
                      key={name}
                      control={configForm.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <Checkbox
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                                {label}
                              </label>
                              <p className="pl-6 text-xs text-muted-foreground">{description}</p>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <Button type="submit" className="w-fit" disabled={saveConfigMutation.isPending}>
                  {saveConfigMutation.isPending && <Loader2 className="animate-spin" />}
                  Save configuration
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed price lists</CardTitle>
          <CardDescription>
            Which price lists this location can sell against, and which is the default.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {allPriceListsQuery.isLoading || assignedPriceListsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              {(allPriceListsQuery.data?.content ?? []).map((pl) => (
                <label key={pl.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={selectedIds.has(pl.id)}
                    onCheckedChange={(checked) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(pl.id);
                        else {
                          next.delete(pl.id);
                          if (defaultId === pl.id) setDefaultId(null);
                        }
                        return next;
                      });
                    }}
                  />
                  <span className="flex-1">
                    {pl.name} ({pl.code})
                  </span>
                  {selectedIds.has(pl.id) && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="radio"
                        name="default-price-list"
                        checked={defaultId === pl.id}
                        onChange={() => setDefaultId(pl.id)}
                      />
                      Default
                    </label>
                  )}
                </label>
              ))}
              <Button
                className="w-fit"
                disabled={assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending && <Loader2 className="animate-spin" />}
                Save price list assignment
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
