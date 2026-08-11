"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History, Calendar, Mail, Phone, ExternalLink, FileText, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { Lead } from "@/lib/types/crm";
import { LeadStatusBadge, LeadRatingBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate, formatDateTime } from "@/components/crm/shared/format";

export function LeadPastInquiriesTab({ leadId }: { leadId: number }) {
  const historyQuery = useQuery({
    queryKey: ["crm", "leads", leadId, "history"],
    queryFn: () => apiClient.get<Lead[]>(`crm/leads/${leadId}/history`),
  });

  if (historyQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Searching for past inquiries...
        </CardContent>
      </Card>
    );
  }

  const pastLeads = historyQuery.data ?? [];

  if (pastLeads.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <History className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No Previous Inquiries Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            This appears to be the first inquiry recorded for this phone number or email address.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Header Banner */}
      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {pastLeads.length} Previous {pastLeads.length === 1 ? "Inquiry" : "Inquiries"} Found
            </h3>
            <p className="text-xs text-muted-foreground">
              Linked across matching contact phone numbers and email addresses.
            </p>
          </div>
        </div>
      </div>

      {/* List of Past Inquiries */}
      <div className="space-y-4">
        {pastLeads.map((pastLead) => (
          <Card key={pastLead.id} className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{pastLead.leadNumber}</span>
                  <LeadStatusBadge status={pastLead.status} />
                  <LeadRatingBadge rating={pastLead.rating} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDateTime(pastLead.createdAt)}</span>
                </div>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Inquiry by <strong className="text-foreground">{pastLead.fullName}</strong>
                {pastLead.companyName ? ` (${pastLead.companyName})` : ""}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              {/* Contact Snapshot */}
              <div className="flex flex-wrap gap-4 p-2.5 rounded-lg bg-muted/40 text-muted-foreground">
                {pastLead.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground">{pastLead.phone}</span>
                  </div>
                )}
                {pastLead.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground">{pastLead.email}</span>
                  </div>
                )}
                {pastLead.estimatedDealValue && (
                  <div className="flex items-center gap-1.5">
                    <span>Est. Value:</span>
                    <strong className="text-foreground">{formatCurrency(pastLead.estimatedDealValue)}</strong>
                  </div>
                )}
              </div>

              {/* Description & Notes captured during past inquiry */}
              {pastLead.description && (
                <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                  <div className="font-medium text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-primary" /> Past Inquiry Details:
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{pastLead.description}</p>
                </div>
              )}

              {pastLead.notes && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-medium text-amber-700 dark:text-amber-300">Internal Notes:</div>
                  <p className="whitespace-pre-wrap">{pastLead.notes}</p>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <Button nativeButton={false} variant="outline" size="sm" className="gap-1.5 text-xs" render={<Link href={`/crm/leads/${pastLead.id}`} />}>
                  <ExternalLink className="h-3.5 w-3.5" /> View Past Inquiry
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
