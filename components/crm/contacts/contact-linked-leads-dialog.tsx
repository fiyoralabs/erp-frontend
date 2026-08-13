"use client";

import Link from "next/link";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge, OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import type { ContactLinks } from "@/lib/types/crm";

// Shown instead of deleting when a contact is still linked to a lead
// (Lead.convertedContactId) or opportunity (Opportunity.primaryContactId) --
// both are real FKs onto crm.contact with no ON DELETE clause, so the
// backend rejects a hard delete while either link exists.
export function ContactLinkedLeadsDialog({
  open,
  onOpenChange,
  contactName,
  links,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  links: ContactLinks;
}) {
  const { leads, opportunities } = links;
  const total = leads.length + opportunities.length;
  const plural = total > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Linked to {plural ? "Records" : leads.length ? "a Lead" : "an Opportunity"}</DialogTitle>
          <DialogDescription>
            {contactName} can&apos;t be deleted while linked to the record{plural ? "s" : ""} below.
            Review or delete {plural ? "them" : "it"} first, then come back and delete the contact.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {leads.map((lead) => (
            <Link
              key={`lead-${lead.id}`}
              href={`/crm/leads/${lead.id}`}
              className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
              onClick={() => onOpenChange(false)}
            >
              <span className="font-medium text-primary">
                Lead {lead.leadNumber} — {lead.fullName}
              </span>
              <LeadStatusBadge status={lead.status} />
            </Link>
          ))}
          {opportunities.map((opp) => (
            <Link
              key={`opp-${opp.id}`}
              href={`/crm/opportunities/${opp.id}`}
              className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
              onClick={() => onOpenChange(false)}
            >
              <span className="font-medium text-primary">
                Opportunity {opp.opportunityNumber} — {opp.name}
              </span>
              <OpportunityStatusBadge status={opp.status} />
            </Link>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
