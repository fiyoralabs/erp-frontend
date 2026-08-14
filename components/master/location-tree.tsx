"use client";

// Locations form a real hierarchy in erp (Location.parentId / parentName --
// e.g. a Warehouse can be the parent of several Stores). This renders that
// hierarchy as an actual collapsible tree instead of a flat table, using
// the generic tree algorithms in lib/tree.ts (shared with Categories, which
// has the identical shape under a differently-named parent field).

import Link from "next/link";
import {
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Store,
  Trash2,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActiveBadge } from "@/components/shared/active-badge";
import { buildTree, collectAllIds, filterTree, type PrunedNode } from "@/lib/tree";
import { cn } from "@/lib/utils";
import type { Location } from "@/lib/types/master";

export function buildLocationTree(locations: Location[]) {
  return buildTree(locations, (loc) => loc.parentId, (a, b) => a.name.localeCompare(b.name));
}

export { collectAllIds };

export function filterLocationTree(
  nodes: ReturnType<typeof buildLocationTree>,
  matches: (loc: Location) => boolean
) {
  return filterTree(nodes, matches);
}

type PrunedLocation = PrunedNode<Location>;

interface LocationTreeProps {
  nodes: PrunedLocation[];
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (loc: Location) => void;
  onAddChild: (parent: Location) => void;
  onDelete: (loc: Location) => void;
  onReactivate: (loc: Location) => void;
}

export function LocationTree({
  nodes,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  onReactivate,
}: LocationTreeProps) {
  return (
    <div className="flex flex-col rounded-xl ring-1 ring-foreground/10">
      {nodes.map((node) => (
        <LocationTreeRow
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          onToggle={onToggle}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onReactivate={onReactivate}
        />
      ))}
    </div>
  );
}

function LocationTreeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  onReactivate,
}: {
  node: PrunedLocation;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (loc: Location) => void;
  onAddChild: (parent: Location) => void;
  onDelete: (loc: Location) => void;
  onReactivate: (loc: Location) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const TypeIcon = node.type === "WAREHOUSE" ? Warehouse : Store;

  return (
    <div>
      <div
        className={cn(
          "group flex min-h-11 items-center gap-2 border-b py-1.5 pr-2 last:border-b-0 hover:bg-muted/50",
          !node.selfMatches && "opacity-50"
        )}
        style={{ paddingLeft: `${depth * 22 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            <ChevronRight className={cn("size-4 transition-transform", isExpanded && "rotate-90")} />
          </button>
        ) : (
          <span className="size-7 shrink-0" />
        )}

        <TypeIcon className="size-4 shrink-0 text-muted-foreground" />

        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
        <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
          {node.code}
        </span>
        <Badge variant="outline" className="hidden shrink-0 md:inline-flex">
          {node.type}
        </Badge>
        <span className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground lg:inline">
          {node.city ?? "—"}
        </span>
        {node.isDefault && (
          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
            Default
          </Badge>
        )}
        <ActiveBadge isActive={node.isActive} />

        <div className="flex shrink-0 items-center gap-1">
          {/* Reactivate is deliberately NOT hidden behind hover like the
              rest of these actions -- it's the one action someone needs to
              find without already knowing it's there. */}
          {!node.isActive && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-600/10 hover:text-emerald-700 dark:text-emerald-400"
              onClick={() => onReactivate(node)}
            >
              <RotateCcw className="size-3.5" />
              Reactivate
            </Button>
          )}
          {/* Below sm: a real hover state doesn't exist on touch, and these
              buttons were reserving ~150px of layout width via opacity-0
              (invisible but still taking space) which squeezed node.name's
              flex-1 span down to nothing on narrow screens -- collapse to a
              single overflow menu instead. */}
          <div className="hidden gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Add child location"
              onClick={() => onAddChild(node)}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Edit location"
              onClick={() => onEdit(node)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Location settings"
              nativeButton={false}
              render={<Link href={`/master/locations/${node.id}`} />}
            >
              <Settings2 className="size-4" />
            </Button>
            {node.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                aria-label="Deactivate location"
                onClick={() => onDelete(node)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 sm:hidden"
                  aria-label="Location actions"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAddChild(node)}>
                <Plus className="size-3.5" /> Add child
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(node)}>
                <Pencil className="size-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/master/locations/${node.id}`} />}>
                <Settings2 className="size-3.5" /> Settings
              </DropdownMenuItem>
              {node.isActive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(node)}>
                    <Trash2 className="size-3.5" /> Deactivate
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <LocationTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onReactivate={onReactivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
