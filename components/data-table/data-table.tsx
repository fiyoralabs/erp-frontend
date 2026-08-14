"use client";

// Shared paginated table, used by every module. Per ARCHITECTURE.md §5: an
// actual <table> at md: and above, a stacked card-per-row list below md --
// wide tables are unusable as literal tables on a phone screen.

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  // Omit from the mobile card view (e.g. an id column that's redundant there).
  hideOnCard?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => React.Key;
  actions?: (row: T) => React.ReactNode;
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  actions,
  isLoading,
  emptyMessage = "No records found.",
  page,
  totalPages,
  onPageChange,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  const showPagination =
    typeof page === "number" &&
    typeof totalPages === "number" &&
    totalPages > 1 &&
    onPageChange;

  return (
    <div className="flex flex-col gap-3">
      {/* Card list -- below md: */}
      <div className="flex flex-col gap-3 md:hidden">
        {data.map((row) => {
          const visibleColumns = columns.filter((c) => !c.hideOnCard);
          const [titleColumn, ...detailColumns] = visibleColumns;
          return (
            <Card
              key={rowKey(row)}
              className={cn(onRowClick && "cursor-pointer transition-colors hover:bg-muted/50", rowClassName?.(row))}
              onClick={() => onRowClick?.(row)}
            >
              <CardContent className="flex flex-col gap-3 p-4">
                {titleColumn && (
                  <div className="text-base font-semibold leading-tight">
                    {titleColumn.render(row)}
                  </div>
                )}
                {detailColumns.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {detailColumns.map((col) => (
                      <div key={col.key} className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {col.header}
                        </span>
                        <span className="truncate font-medium">{col.render(row)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {actions && (
                  <div className="flex justify-end gap-2 border-t pt-2" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Real table -- md: and above */}
      <div className="hidden rounded-xl ring-1 ring-foreground/10 md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
              {actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={rowKey(row)}
                className={cn(onRowClick && "cursor-pointer transition-colors hover:bg-muted/50", rowClassName?.(row))}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-sm text-muted-foreground">
            Page {page! + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-xl hover:border-[#0F3D3E]/40 hover:text-[#0F3D3E] dark:hover:border-[#a3cfcf]/40 dark:hover:text-[#a3cfcf]"
              disabled={page === 0}
              onClick={() => onPageChange!(page! - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-xl hover:border-[#0F3D3E]/40 hover:text-[#0F3D3E] dark:hover:border-[#a3cfcf]/40 dark:hover:text-[#a3cfcf]"
              disabled={page! + 1 >= totalPages!}
              onClick={() => onPageChange!(page! + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
