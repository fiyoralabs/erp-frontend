import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ActiveBadge({ isActive, className }: { isActive: boolean; className?: string }) {
  return (
    <Badge variant={isActive ? "default" : "secondary"} className={cn(className)}>
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
