"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Loader2, Copy, Check, RefreshCw, Globe, ExternalLink, Webhook, CheckCircle2 } from "lucide-react";

interface MetaConfigResponse {
  id?: number;
  companyId: number;
  pageId?: string;
  pageName?: string;
  verifyToken?: string;
  isActive?: boolean;
  isConnected?: boolean;
  connectedUserName?: string;
  connectedAt?: string;
  lastSyncedAt?: string;
  webhookUrl: string;
}

interface MetaPageOption {
  id: string;
  name: string;
}

export function MetaIntegrationSettings() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [copied, setCopied] = useState(false);

  const [config, setConfig] = useState<MetaConfigResponse | null>(null);
  const [pages, setPages] = useState<MetaPageOption[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Check URL parameters for OAuth redirect feedback
    const success = searchParams.get("success");
    const connectedUser = searchParams.get("connectedUser");
    const error = searchParams.get("error");

    if (success === "true") {
      toast.success(`Successfully connected Meta account for ${connectedUser || "User"}!`);
    } else if (error) {
      toast.error(`Meta OAuth Connection failed: ${error}`);
    }

    fetchConfig();
  }, [searchParams]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<MetaConfigResponse>("crm/meta-config");
      if (res) {
        setConfig(res);
        setSelectedPageId(res.pageId || "");
        setPageName(res.pageName || "");
        setVerifyToken(res.verifyToken || "");
        setIsActive(res.isActive ?? true);

        if (res.isConnected) {
          fetchDiscoveredPages();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load Meta integration settings.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoveredPages = async () => {
    setLoadingPages(true);
    try {
      const res = await apiClient.get<MetaPageOption[]>("crm/meta-pages");
      if (res) {
        setPages(res);
      }
    } catch (err: any) {
      console.error("Failed to load user pages:", err);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleConnectMeta = async () => {
    setConnecting(true);
    try {
      const res = await apiClient.get<{ authorizeUrl: string }>("crm/meta-oauth/authorize");
      if (res?.authorizeUrl) {
        window.location.href = res.authorizeUrl;
      } else {
        toast.error("Could not generate Meta authorization link.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate Meta OAuth connection.");
    } finally {
      setConnecting(false);
    }
  };

  const handlePageSelect = async (pageId: string | null) => {
    if (!pageId) return;
    const pageObj = pages.find((p) => p.id === pageId);
    const pName = pageObj ? pageObj.name : "";
    setSelectedPageId(pageId);
    setPageName(pName);

    try {
      const updated = await apiClient.post<MetaConfigResponse>("crm/meta-pages/select", {
        pageId,
        pageName: pName,
      });
      setConfig(updated);
      toast.success(`Selected Facebook Page: ${pName}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update selected page.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        pageId: selectedPageId,
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
          {/* OAuth Authorization Banner */}
          <div className="rounded-lg border bg-blue-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-semibold">
                  {config?.isConnected ? `Connected as ${config.connectedUserName || "Facebook User"}` : "Connect Meta Business Account"}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {config?.isConnected
                  ? `Connected on ${new Date(config.connectedAt!).toLocaleDateString()}. Fiyora automatically ingests leads from your authorized Facebook Lead Forms.`
                  : "Authorize Fiyora via Meta Business Login (config_id: 939235305865838) to automatically fetch your Facebook Pages and Lead Ads."}
              </p>
            </div>
            <Button
              onClick={handleConnectMeta}
              disabled={connecting}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shrink-0 text-xs h-9"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {config?.isConnected ? "Reconnect Meta Account" : "Connect Meta Business"}
            </Button>
          </div>

          {/* Page Selection dropdown if OAuth Connected */}
          {config?.isConnected && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Target Facebook Page
                </Label>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={fetchDiscoveredPages} disabled={loadingPages}>
                  <RefreshCw className={`h-3 w-3 ${loadingPages ? "animate-spin" : ""}`} /> Refresh Pages
                </Button>
              </div>

              {pages.length > 0 ? (
                <div className="space-y-2">
                  <Select value={selectedPageId} onValueChange={handlePageSelect}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Facebook Page" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} ({p.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Selected page is automatically subscribed to real-time Lead Ads notifications.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {loadingPages ? "Loading Facebook Pages..." : "No Facebook Pages found for this account. Ensure your Facebook account has admin access to at least one Facebook Page."}
                </p>
              )}
            </div>
          )}

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
              Meta Webhook notifications are received at this HTTPS URL in real-time.
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
    </div>
  );
}
