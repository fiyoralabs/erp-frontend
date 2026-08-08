"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadSourcesSettings } from "@/components/crm/settings/lead-sources-settings";
import { PipelinesSettings } from "@/components/crm/settings/pipelines-settings";
import { TagsSettings } from "@/components/crm/settings/tags-settings";

export function CrmSettingsClient() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">CRM Settings</h1>
        <p className="text-sm text-muted-foreground">Configure lead sources, pipelines, stages and tags.</p>
      </div>
      <Tabs defaultValue="lead-sources">
        <TabsList>
          <TabsTrigger value="lead-sources">Lead Sources</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines &amp; Stages</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="lead-sources"><LeadSourcesSettings /></TabsContent>
        <TabsContent value="pipelines"><PipelinesSettings /></TabsContent>
        <TabsContent value="tags"><TagsSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
