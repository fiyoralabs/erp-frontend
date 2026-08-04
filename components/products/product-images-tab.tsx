"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { imageSchema, type ImageFormValues } from "@/lib/validation/product";
import type { ProductImage } from "@/lib/types/product";

const emptyValues: ImageFormValues = { imageUrl: "", displayOrder: 0, isPrimary: false };

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function ProductImagesTab({ productId }: { productId: number }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProductImage | null>(null);

  // erp has no "list images for product" endpoint -- images are only
  // reachable via create/update/delete by their own id (confirmed live:
  // ProductMediaController has no GET). This UI tracks images it has
  // created/seen this session; there's no way to discover pre-existing
  // images from a fresh page load. Documented in IMPLEMENTATION_PLAN.md.
  const [images, setImages] = React.useState<ProductImage[]>([]);

  const form = useForm<ImageFormValues>({
    resolver: zodResolver(imageSchema),
    defaultValues: emptyValues,
  });

  React.useEffect(() => {
    if (createOpen) form.reset({ ...emptyValues, displayOrder: images.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  const createMutation = useMutation({
    mutationFn: (values: ImageFormValues) =>
      apiClient.post<ProductImage>("products/images", { ...values, productId }),
    onSuccess: (created) => {
      toast.success("Image added");
      setImages((prev) => [...prev, created]);
      setCreateOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete<void>(`products/images/${id}`),
    onSuccess: (_data, id) => {
      toast.success("Image removed");
      setImages((prev) => prev.filter((img) => img.id !== id));
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleteTarget(null);
    },
  });

  const qcInvalidate = () => qc.invalidateQueries({ queryKey: ["products", productId] });
  React.useEffect(() => {
    if (!createMutation.isSuccess && !deleteMutation.isSuccess) return;
    qcInvalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMutation.isSuccess, deleteMutation.isSuccess]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Images added this session (erp has no endpoint to list a product&apos;s existing
          images -- only add/update/delete by id).
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add image
        </Button>
      </div>

      {images.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No images added yet this session.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <Card key={img.id} className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt=""
                className="aspect-square w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <CardContent className="flex items-center justify-between gap-2 pt-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Order {img.displayOrder}</span>
                  {img.isPrimary && (
                    <Badge variant="outline" className="w-fit text-[10px]">
                      Primary
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive hover:text-destructive sm:size-8"
                  aria-label="Delete image"
                  onClick={() => setDeleteTarget(img)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add image</DialogTitle>
            <DialogDescription>
              erp stores an image URL, not a file upload -- host the image elsewhere and paste
              its URL here.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                        Primary image
                      </label>
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="animate-spin" />}
                  Add
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove image?"
        description="This permanently deletes the image record (not the file itself, which erp never stored)."
        confirmLabel="Remove"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
