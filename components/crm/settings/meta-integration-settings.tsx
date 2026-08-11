"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { Loader2, Copy, Check, RefreshCw, Globe, ShieldCheck, Zap } from "lucide-react";

interface MetaConfigResponse {
  id?: number;
  companyId: number;
  pageId?: string;
  pageName?: string;
  verifyToken?: string;
  isActive?: boolean;
  lastSyncedAt?: string;
  webhookUrl: string;
}

export function MetaIntegrationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [config, setConfig] = useState<MetaConfigResponse | null>(null);
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<MetaConfigResponse>("crm/meta-config");
      if (res) {
        setConfig(res);
        setPageId(res.pageId || "");
        setPageName(res.pageName || "");
        setVerifyToken(res.verifyToken || "");
        setIsActive(res.isActive ?? true);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load Meta integration settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        pageId,
        pageName,
        accessToken,
        verifyToken,
        isActive,
      };
      const updated = await apiClient.post<MetaConfigResponse>("crm/meta-config", payload);
      setConfig(updated);
      toast.success("Meta Lead Ads integration configuration updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Could not save Meta configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post<{ syncedCount: number; syncedAt: string }>("crm/meta-config/sync");
      toast.success(`Successfully imported ${res.syncedCount} missed Meta leads.`);
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync Meta leads.");
    } finally {
      setSyncing(false);
    }
  };

  const copyWebhookUrl = () => {
    if (!config?.webhookUrl) return;
    navigator.clipboard.writeText(config.webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Overview Card */}
      <Card className="border-blue-500/20 bg-gradient-to-r from-blue-950/20 via-background to-background">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500 font-bold text-lg">
                f
              </div>
              <div>
                <CardTitle className="text-lg">Meta Lead Ads Integration</CardTitle>
                <CardDescription>
                  Connect Facebook &amp; Instagram Lead Ads to automatically capture, normalize (+91), deduplicate, and track customer inquiry history.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isActive ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400"}`}>
                {isActive ? "Active" : "Disabled"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook Endpoint Box */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-blue-400" /> Company Webhook Callback URL
              </Label>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={copyWebhookUrl}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy URL"}
              </Button>
            </div>
            <div className="rounded border bg-background px-3 py-2 text-xs font-mono select-all text-blue-400 font-medium break-all">
              {config?.webhookUrl}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste this URL into **Meta Developer Console** under Webhook Subscriptions (`leadgen` topic) to stream leads in real-time.
            </p>
          </div>

          {/* Sync Trigger Action */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-card">
            <div>
              <p className="text-xs font-medium">Catch-Up Downtime Sync</p>
              <p className="text-[11px] text-muted-foreground">
                Last Synced: {config?.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString() : "Never"}
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleManualSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 text-blue-500" />}
              {syncing ? "Syncing..." : "Sync Missed Leads Now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Meta API Credentials
          </CardTitle>
          <CardDescription>
            Configure your Meta Facebook Page Access Token and security verify token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={(c) => setIsActive(!!c)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
                  Enable Meta Lead Ads Integration
                </Label>
                <p className="text-xs text-muted-foreground">Ingest leads from Facebook and Instagram forms into this CRM company.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pageId">Facebook Page ID</Label>
                <Input
                  id="pageId"
                  placeholder="e.g. 109283746592817"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pageName">Facebook Page Name</Label>
                <Input
                  id="pageName"
                  placeholder="e.g. Fiyora Store"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accessToken">Page Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="EAAG..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter your long-lived Meta Page Access Token (generated in Meta Graph API Explorer or Developer Console).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="verifyToken">Webhook Verify Token</Label>
              <Input
                id="verifyToken"
                placeholder="Verification token string..."
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" className="gap-2" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-primary" />}
                {saving ? "Saving..." : "Save Meta Configuration"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
