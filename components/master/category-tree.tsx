"use client";

// Categories form a real hierarchy in erp (Category.parentCategoryId /
// parentCategoryName -- e.g. "Electronics" > "Mobiles" > "Smartphones").
// Same tree-render pattern as Locations (components/master/location-tree.tsx),
// built on the shared lib/tree.ts algorithms since the two entities' parent
// field is just named differently (parentId vs parentCategoryId).

import {
  ChevronRight,
  FolderTree,
  ListFilter,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActiveBadge } from "@/components/shared/active-badge";
import { cn } from "@/lib/utils";
import type { PrunedNode } from "@/lib/tree";
import type { Category } from "@/lib/types/master";

type PrunedCategory = PrunedNode<Category>;

interface CategoryTreeProps {
  nodes: PrunedCategory[];
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (category: Category) => void;
  onAddChild: (parent: Category) => void;
  onDelete: (category: Category) => void;
  onReactivate: (category: Category) => void;
}

export function CategoryTree({
  nodes,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  onReactivate,
}: CategoryTreeProps) {
  return (
    <div className="flex flex-col rounded-xl ring-1 ring-foreground/10">
      {nodes.map((node) => (
        <CategoryTreeRow
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

function CategoryTreeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  onReactivate,
}: {
  node: PrunedCategory;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (category: Category) => void;
  onAddChild: (parent: Category) => void;
  onDelete: (category: Category) => void;
  onReactivate: (category: Category) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

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

        <FolderTree className="size-4 shrink-0 text-muted-foreground" />

        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
        <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
          {node.code}
        </span>
        <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground md:inline">
          Order {node.displayOrder}
        </span>
        <ActiveBadge isActive={node.isActive} />

        <div className="flex shrink-0 items-center gap-1">
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
              nativeButton={false}
              render={<Link href={`/master/categories/${node.id}/attributes`} />}
              aria-label="Manage category attributes"
            >
              <ListFilter className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Add subcategory"
              onClick={() => onAddChild(node)}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Edit category"
              onClick={() => onEdit(node)}
            >
              <Pencil className="size-4" />
            </Button>
            {node.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                aria-label="Deactivate category"
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
                  aria-label="Category actions"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                render={<Link href={`/master/categories/${node.id}/attributes`} />}
              >
                <ListFilter className="size-3.5" /> Attributes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddChild(node)}>
                <Plus className="size-3.5" /> Add subcategory
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(node)}>
                <Pencil className="size-3.5" /> Edit
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
            <CategoryTreeRow
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
