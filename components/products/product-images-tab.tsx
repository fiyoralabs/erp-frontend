"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import type { ProductImage } from "@/lib/types/product";

export function ProductImagesTab({ productId }: { productId: number }) {
  const qc = useQueryClient(); const [files, setFiles] = React.useState<File[]>([]);
  const query = useQuery({ queryKey: ["products",productId,"images"], queryFn: () => apiClient.get<ProductImage[]>(`products/${productId}/images`) });
  const upload = useMutation({ mutationFn: async () => { const results = []; for (let i=0;i<files.length;i++) { const data=new FormData(); data.append("file",files[i]); data.append("isPrimary",String((query.data?.length ?? 0) === 0 && i === 0)); data.append("displayOrder",String((query.data?.length ?? 0)+i)); results.push(await apiClient.post<ProductImage>(`products/${productId}/images/upload`,data)); } return results; }, onSuccess: (rows) => { toast.success(`${rows.length} image${rows.length===1?"":"s"} uploaded`); setFiles([]); qc.invalidateQueries({queryKey:["products",productId,"images"]}); }, onError: (e) => toast.error(e instanceof Error?e.message:"Upload failed") });
  const remove = useMutation({ mutationFn: (id:number) => apiClient.delete<void>(`products/images/${id}`), onSuccess:()=>{toast.success("Image removed from catalog and storage");qc.invalidateQueries({queryKey:["products",productId,"images"]});} });
  return <div className="space-y-4"><label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-7 hover:bg-muted/30"><ImagePlus className="size-7"/><span className="font-medium">Drop or select product images</span><span className="text-xs text-muted-foreground">Multiple JPEG, PNG, WebP or GIF files · 10 MB each</span><input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>setFiles(Array.from(e.target.files??[]))}/></label>{files.length>0&&<div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">{files.length} file(s) ready</span><Button disabled={upload.isPending} onClick={()=>upload.mutate()}>{upload.isPending?<Loader2 className="animate-spin"/>:<Upload/>}Upload all</Button></div>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{(query.data??[]).map((image)=><div key={image.id} className="group relative overflow-hidden rounded-lg border"><img src={image.imageUrl} alt="" className="aspect-square w-full object-cover"/>{image.isPrimary&&<Badge className="absolute left-2 top-2">Primary</Badge>}<Button variant="destructive" size="icon" className="absolute right-2 top-2 opacity-0 group-hover:opacity-100" onClick={()=>remove.mutate(image.id)}><Trash2/></Button></div>)}</div>{!query.isLoading&&(query.data??[]).length===0&&<p className="text-center text-sm text-muted-foreground">No product images yet.</p>}</div>;
}
