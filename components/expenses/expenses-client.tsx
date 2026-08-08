"use client";

import * as React from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { FilePlus2,Loader2,Paperclip,Plus,Tags } from "lucide-react";
import { toast } from "sonner";
import { apiClient,ApiRequestError,type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { Location,PaymentMethod } from "@/lib/types/master";
import type { Expense,ExpenseCategory } from "@/lib/types/expense";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const today=localDateInputValue;
const money=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"});
const errorMessage=(e:unknown)=>e instanceof ApiRequestError||e instanceof Error?e.message:"Something went wrong";

export function ExpensesClient(){
  const qc=useQueryClient();
  const [categoryDialog,setCategoryDialog]=React.useState(false);
  const [editCategory,setEditCategory]=React.useState<ExpenseCategory|null>(null);
  const [expenseDialog,setExpenseDialog]=React.useState(false);
  const [detailId,setDetailId]=React.useState<number|null>(null);
  const [attachmentExpense,setAttachmentExpense]=React.useState<Expense|null>(null);
  const [categoryFilter,setCategoryFilter]=React.useState("all");
  const [locationFilter,setLocationFilter]=React.useState("all");
  const [from,setFrom]=React.useState(""),[to,setTo]=React.useState("");
  const query=React.useMemo(()=>{const p=new URLSearchParams({page:"0",size:"100"});if(categoryFilter!=="all")p.set("expenseCategoryId",categoryFilter);if(locationFilter!=="all")p.set("locationId",locationFilter);if(from&&to){p.set("from",from);p.set("to",to)}return p.toString()},[categoryFilter,locationFilter,from,to]);
  const categories=useQuery({queryKey:["expense","categories"],queryFn:()=>apiClient.get<PagedResult<ExpenseCategory>>("expense-categories?page=0&size=100")});
  const expenses=useQuery({queryKey:["expense","list",query],queryFn:()=>apiClient.get<PagedResult<Expense>>(`expenses?${query}`)});
  const locations=useQuery({queryKey:["master","locations","expense"],queryFn:()=>apiClient.get<PagedResult<Location>>("master/locations?page=0&size=100")});
  const methods=useQuery({queryKey:["master","payment-methods","expense"],queryFn:()=>apiClient.get<PagedResult<PaymentMethod>>("master/payment-methods?page=0&size=100")});
  const detail=useQuery({queryKey:["expense","detail",detailId],queryFn:()=>apiClient.get<Expense>(`expenses/${detailId}`),enabled:detailId!==null});
  const cats=(categories.data?.content??[]).filter(x=>x.active), rows=expenses.data?.content??[], locs=(locations.data?.content??[]).filter(x=>x.isActive);
  const manual=rows.filter(x=>x.source==="MANUAL").reduce((a,x)=>a+x.amount,0),loss=rows.filter(x=>x.source==="INVENTORY_LOSS").reduce((a,x)=>a+x.amount,0);
  const refresh=()=>Promise.all([qc.invalidateQueries({queryKey:["expense","list"]}),qc.invalidateQueries({queryKey:["expense","categories"]})]);
  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-2xl font-semibold">Expenses</h1><p className="text-sm text-muted-foreground">Post operating costs, track vendor evidence, and see Inventory write-offs in the same financial workspace.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{setEditCategory(null);setCategoryDialog(true)}}><Tags/>New category</Button><Button onClick={()=>setExpenseDialog(true)}><Plus/>Post expense</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Filtered total" value={money.format(manual+loss)}/><Metric label="Manual expenses" value={money.format(manual)}/><Metric label="Inventory losses" value={money.format(loss)} warn={loss>0}/></div>
    <Tabs defaultValue="expenses"><TabsList><TabsTrigger value="expenses">Expense register</TabsTrigger><TabsTrigger value="categories">Categories</TabsTrigger></TabsList>
      <TabsContent value="expenses" className="mt-4"><Card><CardHeader><CardTitle>Expense register</CardTitle><CardDescription>Posted documents are immutable and connected to Finance. Open a row to see its evidence and originating Inventory adjustment.</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Picker value={categoryFilter} set={setCategoryFilter} items={[["all","All categories"],...cats.map(x=>[String(x.id),x.name] as [string,string])]}/><Picker value={locationFilter} set={setLocationFilter} items={[["all","All locations"],...locs.map(x=>[String(x.id),x.name] as [string,string])]}/><Input type="date" aria-label="From date" value={from} onChange={e=>setFrom(e.target.value)}/><Input type="date" aria-label="To date" value={to} onChange={e=>setTo(e.target.value)}/></div>
        <Grid heads={["Expense","Date","Category","Location","Vendor / source","Settlement","Amount",""]}>{rows.map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.expenseNumber}<span className="block text-xs text-muted-foreground">{x.invoiceNumber??"No vendor invoice"}</span></TableCell><TableCell>{x.expenseDate}</TableCell><TableCell>{cats.find(c=>c.id===x.expenseCategoryId)?.name??`Category #${x.expenseCategoryId}`}</TableCell><TableCell>{locs.find(l=>l.id===x.locationId)?.name??`Location #${x.locationId}`}</TableCell><TableCell>{x.source==="INVENTORY_LOSS"?<Badge variant="destructive">Inventory loss</Badge>:x.vendorName??"Manual expense"}</TableCell><TableCell>{x.paymentMethodName??"Accounts payable"}</TableCell><TableCell className="font-medium">{money.format(x.amount)}</TableCell><TableCell><div className="flex gap-1"><Button size="sm" variant="outline" onClick={()=>setDetailId(x.id)}>View</Button><Button size="sm" variant="outline" onClick={()=>setAttachmentExpense(x)}><Paperclip/>Evidence</Button></div></TableCell></TableRow>)}</Grid>
      </CardContent></Card></TabsContent>
      <TabsContent value="categories" className="mt-4"><Card><CardHeader><CardTitle>Expense categories</CardTitle><CardDescription>Only active categories are available when posting expenses or Inventory loss write-offs.</CardDescription></CardHeader><CardContent><Grid heads={["Code","Category","Description","Status",""]}>{cats.map(x=><TableRow key={x.id}><TableCell>{x.code}</TableCell><TableCell className="font-medium">{x.name}</TableCell><TableCell>{x.description??"—"}</TableCell><TableCell><Badge variant="secondary">Active</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>{setEditCategory(x);setCategoryDialog(true)}}>Edit</Button></TableCell></TableRow>)}</Grid></CardContent></Card></TabsContent>
    </Tabs>
    <CategoryDialog open={categoryDialog} value={editCategory} close={()=>setCategoryDialog(false)} saved={async()=>{await refresh();setCategoryDialog(false)}}/>
    <ExpenseDialog open={expenseDialog} categories={cats} locations={locs} methods={(methods.data?.content??[]).filter(x=>x.isActive)} close={()=>setExpenseDialog(false)} saved={async()=>{await refresh();setExpenseDialog(false)}}/>
    <AttachmentDialog expense={attachmentExpense} close={()=>setAttachmentExpense(null)} saved={async id=>{await qc.invalidateQueries({queryKey:["expense","detail",id]});await qc.invalidateQueries({queryKey:["expense","list"]});setAttachmentExpense(null)}}/>
    <DetailDialog value={detail.data??null} loading={detail.isLoading} categories={cats} locations={locs} close={()=>setDetailId(null)}/>
  </div>;
}

function Metric({label,value,warn}:{label:string;value:string;warn?:boolean}){return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className={warn?"text-2xl font-semibold text-amber-600":"text-2xl font-semibold"}>{value}</p></CardContent></Card>}
function Grid({heads,children}:{heads:string[];children:React.ReactNode}){return <div className="overflow-x-auto"><Table><TableHeader><TableRow>{heads.map(x=><TableHead key={x}>{x}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div>}
function Field({label,children,className=""}:{label:string;children:React.ReactNode;className?:string}){return <div className={"grid gap-2 "+className}><Label>{label}</Label>{children}</div>}
function Picker({value,set,items}:{value:string;set:(v:string)=>void;items:[string,string][]}){return <Select items={Object.fromEntries(items)} value={value} onValueChange={v=>set(v??"")}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{items.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>}

function CategoryDialog({open,value,close,saved}:{open:boolean;value:ExpenseCategory|null;close:()=>void;saved:()=>Promise<void>}){
  const [code,setCode]=React.useState(""),[name,setName]=React.useState(""),[description,setDescription]=React.useState("");
  React.useEffect(()=>{if(open){setCode(value?.code??"");setName(value?.name??"");setDescription(value?.description??"")}},[open,value]);
  const save=useMutation({mutationFn:()=>value?apiClient.put(`expense-categories/${value.id}`,{name,description,active:true}):apiClient.post("expense-categories",{code,name,description}),onSuccess:async()=>{toast.success(value?"Category updated":"Category created");await saved()},onError:e=>toast.error(errorMessage(e))});
  const deactivate=useMutation({mutationFn:()=>apiClient.delete(`expense-categories/${value!.id}`),onSuccess:async()=>{toast.success("Category deactivated");await saved()},onError:e=>toast.error(errorMessage(e))});
  return <Dialog open={open} onOpenChange={v=>{if(!v)close()}}><DialogContent><form onSubmit={e=>{e.preventDefault();save.mutate()}}><DialogHeader><DialogTitle>{value?"Edit expense category":"New expense category"}</DialogTitle><DialogDescription>Categories drive posting, reporting, and Inventory-loss classification.</DialogDescription></DialogHeader><div className="my-5 grid gap-4"><Field label="Code"><Input required disabled={!!value} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></Field><Field label="Name"><Input required value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Description"><Textarea value={description} onChange={e=>setDescription(e.target.value)}/></Field></div><DialogFooter>{value&&<Button type="button" variant="destructive" onClick={()=>deactivate.mutate()} disabled={deactivate.isPending}>Deactivate</Button>}<Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending&&<Loader2 className="animate-spin"/>}Save</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ExpenseDialog({open,categories,locations,methods,close,saved}:{open:boolean;categories:ExpenseCategory[];locations:Location[];methods:PaymentMethod[];close:()=>void;saved:()=>Promise<void>}){
  const [category,setCategory]=React.useState(""),[location,setLocation]=React.useState(""),[date,setDate]=React.useState(today()),[method,setMethod]=React.useState("payable"),[amount,setAmount]=React.useState(""),[vendor,setVendor]=React.useState(""),[invoice,setInvoice]=React.useState(""),[remarks,setRemarks]=React.useState("");
  React.useEffect(()=>{if(open){setCategory("");setLocation("");setDate(today());setMethod("payable");setAmount("");setVendor("");setInvoice("");setRemarks("")}},[open]);
  const mutation=useMutation({mutationFn:()=>apiClient.post<Expense>("expenses",{expenseCategoryId:Number(category),locationId:Number(location),expenseDate:date,paymentMethodCode:method==="payable"?null:method,amount:Number(amount),vendorName:vendor||null,invoiceNumber:invoice||null,remarks:remarks||null}),onSuccess:async x=>{toast.success(`${x.expenseNumber} posted to Finance`);await saved()},onError:e=>toast.error(errorMessage(e))});
  return <Dialog open={open} onOpenChange={v=>{if(!v)close()}}><DialogContent className="sm:max-w-2xl"><form onSubmit={e=>{e.preventDefault();mutation.mutate()}}><DialogHeader><DialogTitle>Post expense</DialogTitle><DialogDescription>Choose “Accounts payable” for a vendor bill not yet paid; selecting a payment method credits Cash/Bank immediately.</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2"><Field label="Category"><Picker value={category} set={setCategory} items={categories.map(x=>[String(x.id),x.name])}/></Field><Field label="Location"><Picker value={location} set={setLocation} items={locations.map(x=>[String(x.id),x.name])}/></Field><Field label="Expense date"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Settlement"><Picker value={method} set={setMethod} items={[["payable","Accounts payable (unpaid)"],...methods.map(x=>[x.code,x.name] as [string,string])]}/></Field><Field label="Amount"><Input required type="number" min=".01" step=".01" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Field label="Vendor"><Input value={vendor} onChange={e=>setVendor(e.target.value)}/></Field><Field label="Vendor invoice"><Input value={invoice} onChange={e=>setInvoice(e.target.value)}/></Field><Field label="Remarks"><Textarea value={remarks} onChange={e=>setRemarks(e.target.value)}/></Field></div><DialogFooter><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending&&<Loader2 className="animate-spin"/>}Post expense</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AttachmentDialog({expense,close,saved}:{expense:Expense|null;close:()=>void;saved:(id:number)=>Promise<void>}){
  const [name,setName]=React.useState(""),[url,setUrl]=React.useState("");
  React.useEffect(()=>{if(expense){setName("");setUrl("")}},[expense]);
  const mutation=useMutation({mutationFn:()=>apiClient.post(`expenses/${expense!.id}/attachments`,{fileName:name,fileUrl:url}),onSuccess:async()=>{toast.success("Expense evidence attached");await saved(expense!.id)},onError:e=>toast.error(errorMessage(e))});
  return <Dialog open={!!expense} onOpenChange={v=>{if(!v)close()}}><DialogContent><form onSubmit={e=>{e.preventDefault();mutation.mutate()}}><DialogHeader><DialogTitle>Attach evidence to {expense?.expenseNumber}</DialogTitle><DialogDescription>This API stores file metadata and URL. Upload the file to approved storage first, then register its durable URL here.</DialogDescription></DialogHeader><div className="my-5 grid gap-4"><Field label="File name"><Input required value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="File URL"><Input required type="url" value={url} onChange={e=>setUrl(e.target.value)}/></Field></div><DialogFooter><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}><FilePlus2/>Attach</Button></DialogFooter></form></DialogContent></Dialog>;
}

function DetailDialog({value,loading,categories,locations,close}:{value:Expense|null;loading:boolean;categories:ExpenseCategory[];locations:Location[];close:()=>void}){
  return <Dialog open={loading||!!value} onOpenChange={v=>{if(!v)close()}}><DialogContent className="sm:max-w-2xl">{loading?<Loader2 className="animate-spin"/>:value&&<><DialogHeader><DialogTitle>{value.expenseNumber}</DialogTitle><DialogDescription>{value.expenseDate} · {value.status} · {value.source.replaceAll("_"," ")}</DialogDescription></DialogHeader><div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><Info label="Category" value={categories.find(x=>x.id===value.expenseCategoryId)?.name??String(value.expenseCategoryId)}/><Info label="Location" value={locations.find(x=>x.id===value.locationId)?.name??String(value.locationId)}/><Info label="Amount" value={money.format(value.amount)}/><Info label="Settlement" value={value.paymentMethodName??"Accounts payable"}/><Info label="Vendor" value={value.vendorName??"—"}/><Info label="Invoice" value={value.invoiceNumber??"—"}/>{value.adjustmentNumber&&<Info label="Inventory adjustment" value={value.adjustmentNumber}/>}</div><div><h3 className="mb-2 text-sm font-medium">Evidence</h3>{value.attachments.length===0?<p className="text-sm text-muted-foreground">No attachments.</p>:value.attachments.map(a=><a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="block rounded-md border p-3 text-sm underline">{a.fileName}</a>)}</div></>}</DialogContent></Dialog>;
}
function Info({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>}
