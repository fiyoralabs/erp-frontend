"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, ShieldCheck, Loader2, KeyRound, Phone, Building } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

interface WhatsAppConfigResponse {
  id?: number;
  phoneNumberId?: string;
  wabaId?: string;
  accessTokenMasked?: string;
  businessPhoneNumber?: string;
  isEnabled?: boolean;
  updatedAt?: string;
}

interface WhatsAppConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppConfigDialog({ open, onOpenChange }: WhatsAppConfigDialogProps) {
  const queryClient = useQueryClient();

  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [wabaId, setWabaId] = React.useState("");
  const [accessToken, setAccessToken] = React.useState("");
  const [businessPhoneNumber, setBusinessPhoneNumber] = React.useState("");
  const [isEnabled, setIsEnabled] = React.useState(true);

  const configQuery = useQuery({
    queryKey: ["whatsapp", "config"],
    queryFn: async () => {
      const res = await apiClient.get<WhatsAppConfigResponse>("whatsapp/config");
      return res;
    },
    enabled: open,
  });

  React.useEffect(() => {
    if (configQuery.data) {
      setPhoneNumberId(configQuery.data.phoneNumberId || "");
      setWabaId(configQuery.data.wabaId || "");
      setAccessToken(configQuery.data.accessTokenMasked || "");
      setBusinessPhoneNumber(configQuery.data.businessPhoneNumber || "");
      setIsEnabled(configQuery.data.isEnabled ?? true);
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!phoneNumberId.trim()) throw new Error("Phone Number ID is required");
      if (!accessToken.trim()) throw new Error("Access Token is required");

      const payload = {
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim() || undefined,
        accessToken: accessToken.trim(),
        businessPhoneNumber: businessPhoneNumber.trim() || undefined,
        isEnabled,
      };

      return apiClient.put("whatsapp/config", payload);
    },
    onSuccess: () => {
      toast.success("WhatsApp Business credentials saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "config"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save WhatsApp credentials");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <MessageSquare className="h-5 w-5" /> BYOWA: Connect WhatsApp Business Account
          </DialogTitle>
          <DialogDescription className="text-xs">
            Connect your Meta WhatsApp Cloud API credentials to dispatch customer invoices, payment links, and verification receipts directly to WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {configQuery.isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading WhatsApp Cloud API config...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1">
              <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Bring Your Own WhatsApp (BYOWA)
              </div>
              <p className="text-muted-foreground text-[11px]">
                Enter your Meta Developer App details below. Fiyora ERP calls official Meta Graph API endpoints on your behalf.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneId" className="text-xs font-semibold flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Meta Phone Number ID *
              </Label>
              <Input
                id="phoneId"
                placeholder="e.g. 105938472619401"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wabaId" className="text-xs font-semibold flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-muted-foreground" /> WhatsApp Business Account (WABA) ID (Optional)
              </Label>
              <Input
                id="wabaId"
                placeholder="e.g. 102847291048201"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="token" className="text-xs font-semibold flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Meta Permanent System User Access Token *
              </Label>
              <Input
                id="token"
                type="password"
                placeholder="EAAG..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bizPhone" className="text-xs font-semibold">
                WhatsApp Business Display Phone Number (Optional)
              </Label>
              <Input
                id="bizPhone"
                placeholder="+919876543210"
                value={businessPhoneNumber}
                onChange={(e) => setBusinessPhoneNumber(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="enableWa"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Label htmlFor="enableWa" className="text-xs font-medium cursor-pointer">
                Enable WhatsApp Invoice Dispatch for customers
              </Label>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save WhatsApp Config
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
