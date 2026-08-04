"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Plus, RotateCcw, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { Location, PaymentMethod, PriceList } from "@/lib/types/master";
import type { ProductSummary, Variant } from "@/lib/types/product";
import type { Customer, CustomerLedger, SalesInvoice, SalesReturn, Wishlist } from "@/lib/types/sales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Sellable = { productId:number; variantId:number|null; label:string };
type Action = "customer"|"invoice"|"payment"|"return"|null;
const today = localDateInputValue;
const money = new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"});
const message = (e:unknown) => e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong";
const itemKey = (p:number,v:number|null) => `${p}:${v??"base"}`;

export function SalesClient(){
  const qc=useQueryClient();
  const [action,setAction]=React.useState<Action>(null);
  const [selectedCustomer,setSelectedCustomer]=React.useState<Customer|null>(null);
  const [detail,setDetail]=React.useState<SalesInvoice|SalesReturn|null>(null);
  const [ledgerCustomer,setLedgerCustomer]=React.useState<Customer|null>(null);
  const [wishlistCustomer,setWishlistCustomer]=React.useState<Customer|null>(null);
  const customers=useQuery({queryKey:["sales","customers"],queryFn:()=>apiClient.get<PagedResult<Customer>>("sales/customers?page=0&size=100")});
  const invoices=useQuery({queryKey:["sales","invoices"],queryFn:()=>apiClient.get<PagedResult<SalesInvoice>>("sales/invoices?page=0&size=100")});
  const returns=useQuery({queryKey:["sales","returns"],queryFn:()=>apiClient.get<PagedResult<SalesReturn>>("sales/returns?page=0&size=100")});
  const locations=useQuery({queryKey:["master","locations","sales"],queryFn:()=>apiClient.get<PagedResult<Location>>("master/locations?page=0&size=100")});
  const methods=useQuery({queryKey:["master","payment-methods","sales"],queryFn:()=>apiClient.get<PagedResult<PaymentMethod>>("master/payment-methods?page=0&size=100")});
  const priceLists=useQuery({queryKey:["master","price-lists","sales"],queryFn:()=>apiClient.get<PagedResult<PriceList>>("master/price-lists?page=0&size=100")});
  const sellables=useQuery({queryKey:["sales","sellables"],queryFn:async()=>{
    const products=await apiClient.get<PagedResult<ProductSummary>>("products?page=0&size=100");
    return (await Promise.all(products.content.filter(p=>p.isActive).map(async p=>p.hasVariants
      ? (await apiClient.get<Variant[]>(`products/${p.id}/variants`)).filter(v=>v.isActive).map(v=>({productId:p.id,variantId:v.id,label:`${p.name} — ${v.variantName} (${v.sku})`}))
      : [{productId:p.id,variantId:null,label:`${p.name} (${p.code})`}]))).flat();
  }});
  const refresh=()=>Promise.all(["customers","invoices","returns"].map(k=>qc.invalidateQueries({queryKey:["sales",k]})));
  const c=(customers.data?.content??[]).filter(x=>x.active), inv=invoices.data?.content??[], ret=returns.data?.content??[];
  const due=inv.reduce((sum,x)=>sum+x.balanceAmount,0);
  const todaySales=inv.filter(x=>x.invoiceDate===today()).reduce((sum,x)=>sum+x.totalAmount,0);
  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><h1 className="text-2xl font-semibold">Sales</h1><p className="text-sm text-muted-foreground">Sell by exact SKU, collect payments, manage customers, and restore stock through controlled returns.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{setSelectedCustomer(null);setAction("customer")}}><Users/>New customer</Button><Button onClick={()=>setAction("invoice")}><ShoppingBag/>New sale</Button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Today’s sales" value={money.format(todaySales)}/><Metric label="Receivables" value={money.format(due)} warn={due>0}/><Metric label="Active customers" value={String(c.length)}/></div>
    <Tabs defaultValue="invoices"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="customers">Customers</TabsTrigger><TabsTrigger value="returns">Returns</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger></TabsList>
      <Tab value="invoices" title="Sales invoices" desc="Posted sales immediately deduct stock and create receivables." action={due>0?<Button variant="outline" onClick={()=>setAction("payment")}><CreditCard/>Record payment</Button>:undefined}>
        <Grid heads={["Invoice","Date","Customer","Status","Total","Balance",""]}>{inv.map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.invoiceNumber}</TableCell><TableCell>{x.invoiceDate}</TableCell><TableCell>{c.find(y=>y.id===x.customerId)?.name??`Customer #${x.customerId}`}</TableCell><TableCell><Status value={x.status}/></TableCell><TableCell>{money.format(x.totalAmount)}</TableCell><TableCell className="font-medium">{money.format(x.balanceAmount)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>setDetail(x)}>View</Button></TableCell></TableRow>)}</Grid>
      </Tab>
      <Tab value="customers" title="Customers" desc="Profiles, credit terms, wishlist, and independently calculated ledger.">
        <Grid heads={["Code","Customer","Type","Credit limit","Lifetime sales","Status",""]}>{c.map(x=><TableRow key={x.id}><TableCell>{x.code}</TableCell><TableCell className="font-medium">{x.name}<span className="block text-xs text-muted-foreground">{x.phone||x.email||"No contact"}</span></TableCell><TableCell>{x.customerType}</TableCell><TableCell>{money.format(x.creditLimit)}</TableCell><TableCell>{money.format(x.totalPurchaseAmount)}</TableCell><TableCell><Status value="ACTIVE"/></TableCell><TableCell><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={()=>{setSelectedCustomer(x);setAction("customer")}}>Edit</Button><Button size="sm" variant="outline" onClick={()=>setLedgerCustomer(x)}>Ledger</Button><Button size="sm" variant="outline" onClick={()=>setWishlistCustomer(x)}>Wishlist</Button></div></TableCell></TableRow>)}</Grid>
      </Tab>
      <Tab value="returns" title="Sales returns" desc="Return quantities are validated against the invoice and tracked goods are added back to Inventory." action={<Button variant="outline" onClick={()=>setAction("return")}><RotateCcw/>New return</Button>}>
        <Grid heads={["Return","Invoice","Date","Total","Receivable","Customer credit",""]}>{ret.map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.returnNumber}</TableCell><TableCell>{inv.find(i=>i.id===x.invoiceId)?.invoiceNumber??`#${x.invoiceId}`}</TableCell><TableCell>{x.returnDate}</TableCell><TableCell>{money.format(x.totalAmount)}</TableCell><TableCell>{money.format(x.receivableAppliedAmount)}</TableCell><TableCell>{money.format(x.creditAmount)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>setDetail(x)}>View</Button></TableCell></TableRow>)}</Grid>
      </Tab>
      <Tab value="payments" title="Customer payments" desc="Invoice collections are reflected in the customer ledger and Finance journals.">
        <Grid heads={["Date","Invoice","Method","Reference","Amount","Status"]}>{inv.flatMap(i=>i.payments.map(p=><TableRow key={p.id}><TableCell>{p.paymentDate}</TableCell><TableCell>{i.invoiceNumber}</TableCell><TableCell>{p.paymentMethodName}</TableCell><TableCell>{p.referenceNumber??"—"}</TableCell><TableCell>{money.format(p.amount)}</TableCell><TableCell><Status value={p.status}/></TableCell></TableRow>))}</Grid>
      </Tab>
    </Tabs>
    <CustomerDialog open={action==="customer"} customer={selectedCustomer} priceLists={(priceLists.data?.content??[]).filter(x=>x.isActive)} locations={(locations.data?.content??[]).filter(x=>x.isActive)} close={()=>setAction(null)} saved={async()=>{await refresh();setAction(null)}}/>
    <InvoiceDialog open={action==="invoice"} customers={c} locations={(locations.data?.content??[]).filter(x=>x.isActive)} methods={(methods.data?.content??[]).filter(x=>x.isActive)} sellables={sellables.data??[]} close={()=>setAction(null)} saved={async()=>{await refresh();setAction(null)}}/>
    <PaymentDialog open={action==="payment"} invoices={inv.filter(x=>x.balanceAmount>0)} methods={(methods.data?.content??[]).filter(x=>x.isActive)} close={()=>setAction(null)} saved={async()=>{await refresh();setAction(null)}}/>
    <ReturnDialog open={action==="return"} invoices={inv} close={()=>setAction(null)} saved={async()=>{await refresh();setAction(null)}}/>
    <DetailDialog value={detail} customer={detail?c.find(x=>x.id===detail.customerId):undefined} close={()=>setDetail(null)}/>
    <LedgerDialog customer={ledgerCustomer} close={()=>setLedgerCustomer(null)}/>
    <WishlistDialog customer={wishlistCustomer} sellables={sellables.data??[]} close={()=>setWishlistCustomer(null)}/>
  </div>;
}

function Metric({label,value,warn}:{label:string;value:string;warn?:boolean}){return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className={warn?"text-2xl font-semibold text-amber-600":"text-2xl font-semibold"}>{value}</p></CardContent></Card>}
function Status({value}:{value:string}){return <Badge variant={["PAID","POSTED","ACTIVE"].includes(value)?"secondary":"default"}>{value.replaceAll("_"," ")}</Badge>}
function Tab({value,title,desc,action,children}:{value:string;title:string;desc:string;action?:React.ReactNode;children:React.ReactNode}){return <TabsContent value={value} className="mt-4"><Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>{title}</CardTitle><CardDescription>{desc}</CardDescription></div>{action}</CardHeader><CardContent>{children}</CardContent></Card></TabsContent>}
function Grid({heads,children}:{heads:string[];children:React.ReactNode}){return <div className="overflow-x-auto"><Table><TableHeader><TableRow>{heads.map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div>}
function Field({label,children,className=""}:{label:string;children:React.ReactNode;className?:string}){return <div className={"grid gap-2 "+className}><Label>{label}</Label>{children}</div>}
function Picker({value,set,items,placeholder="Select"}:{value:string;set:(v:string)=>void;items:[string,string][];placeholder?:string}){return <Select value={value} onValueChange={v=>set(v??"")}><SelectTrigger><SelectValue placeholder={placeholder}/></SelectTrigger><SelectContent>{Object.fromEntries(items) && items.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>}
function Footer({busy,close,label="Post"}:{busy:boolean;close:()=>void;label?:string}){return <DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={busy}>{busy&&<Loader2 className="animate-spin"/>}{label}</Button></DialogFooter>}

function CustomerDialog({open,customer,priceLists,locations,close,saved}:{open:boolean;customer:Customer|null;priceLists:PriceList[];locations:Location[];close:()=>void;saved:()=>Promise<void>}){
  const [form,setForm]=React.useState({customerType:"INDIVIDUAL",name:"",phone:"",email:"",priceListId:"",preferredLocationId:"",creditLimit:"0",creditDays:"0",remarks:""});
  React.useEffect(()=>{if(open)setForm({customerType:customer?.customerType??"INDIVIDUAL",name:customer?.name??"",phone:customer?.phone??"",email:customer?.email??"",priceListId:String(customer?.priceListId??""),preferredLocationId:String(customer?.preferredLocationId??""),creditLimit:String(customer?.creditLimit??0),creditDays:String(customer?.creditDays??0),remarks:customer?.remarks??""})},[open,customer]);
  const mutation=useMutation({mutationFn:()=>{const body={...form,priceListId:form.priceListId?Number(form.priceListId):null,preferredLocationId:form.preferredLocationId?Number(form.preferredLocationId):null,creditLimit:Number(form.creditLimit),creditDays:Number(form.creditDays),active:true};return customer?apiClient.put(`sales/customers/${customer.id}`,body):apiClient.post("sales/customers",body)},onSuccess:async()=>{toast.success(customer?"Customer updated":"Customer created");await saved()},onError:e=>toast.error(message(e))});
  const deactivate=useMutation({mutationFn:()=>apiClient.delete(`sales/customers/${customer!.id}`),onSuccess:async()=>{toast.success("Customer deactivated");await saved()},onError:e=>toast.error(message(e))});
  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));
  return <Dialog open={open} onOpenChange={v=>{if(!v)close()}}><DialogContent className="sm:max-w-2xl"><form onSubmit={e=>{e.preventDefault();mutation.mutate()}}><DialogHeader><DialogTitle>{customer?"Edit customer":"New customer"}</DialogTitle><DialogDescription>Credit, price-list, and preferred-store settings drive invoice validation and pricing.</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2">
    <Field label="Customer type"><Picker value={form.customerType} set={v=>set("customerType",v)} items={[["INDIVIDUAL","Individual"],["BUSINESS","Business"]]}/></Field><Field label="Name"><Input required value={form.name} onChange={e=>set("name",e.target.value)}/></Field>
    <Field label="Phone"><Input value={form.phone} onChange={e=>set("phone",e.target.value)}/></Field><Field label="Email"><Input type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></Field>
    <Field label="Price list"><Picker value={form.priceListId} set={v=>set("priceListId",v)} items={priceLists.map(x=>[String(x.id),x.name])}/></Field><Field label="Preferred location"><Picker value={form.preferredLocationId} set={v=>set("preferredLocationId",v)} items={locations.map(x=>[String(x.id),x.name])}/></Field>
    <Field label="Credit limit"><Input type="number" min="0" value={form.creditLimit} onChange={e=>set("creditLimit",e.target.value)}/></Field><Field label="Credit days"><Input type="number" min="0" value={form.creditDays} onChange={e=>set("creditDays",e.target.value)}/></Field>
    <Field label="Remarks" className="sm:col-span-2"><Textarea value={form.remarks} onChange={e=>set("remarks",e.target.value)}/></Field>
  </div><DialogFooter>{customer&&<Button type="button" variant="destructive" onClick={()=>deactivate.mutate()} disabled={deactivate.isPending}>Deactivate</Button>}<Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending&&<Loader2 className="animate-spin"/>}Save</Button></DialogFooter></form></DialogContent></Dialog>;
}

function InvoiceDialog({open,customers,locations,methods,sellables,close,saved}:{open:boolean;customers:Customer[];locations:Location[];methods:PaymentMethod[];sellables:Sellable[];close:()=>void;saved:()=>Promise<void>}){
  const [customer,setCustomer]=React.useState(""),[location,setLocation]=React.useState(""),[date,setDate]=React.useState(today()),[due,setDue]=React.useState(today()),[remarks,setRemarks]=React.useState("");
  const [lines,setLines]=React.useState([{item:"",quantity:"1",price:"",discount:"0"}]);
  const [payment,setPayment]=React.useState({method:"",amount:"",reference:""});
  React.useEffect(()=>{if(open){setCustomer("");setLocation("");setDate(today());setDue(today());setRemarks("");setLines([{item:"",quantity:"1",price:"",discount:"0"}]);setPayment({method:"",amount:"",reference:""})}},[open]);
  const mutation=useMutation({mutationFn:()=>apiClient.post<SalesInvoice>("sales/invoices",{customerId:Number(customer),locationId:Number(location),invoiceDate:date,dueDate:due,remarks,lines:lines.map(l=>{const s=sellables.find(x=>itemKey(x.productId,x.variantId)===l.item);if(!s)throw new Error("Select every SKU");return{productId:s.productId,productVariantId:s.variantId,quantity:Number(l.quantity),sellingPrice:l.price?Number(l.price):null,discountPercentage:Number(l.discount)}}),payments:payment.amount?[{paymentMethodCode:payment.method,amount:Number(payment.amount),paymentDate:date,referenceNumber:payment.reference||null}]:[]}),onSuccess:async x=>{toast.success(`${x.invoiceNumber} posted — tracked stock reduced`);await saved()},onError:e=>toast.error(message(e))});
  return <Dialog open={open} onOpenChange={v=>{if(!v)close()}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><form onSubmit={e=>{e.preventDefault();mutation.mutate()}}><DialogHeader><DialogTitle>New sales invoice</DialogTitle><DialogDescription>Prices and taxes resolve from the customer/location price list. Selling price is only an explicit override.</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Field label="Customer"><Picker value={customer} set={setCustomer} items={customers.map(x=>[String(x.id),`${x.name} (${x.code})`])}/></Field><Field label="Selling location"><Picker value={location} set={setLocation} items={locations.map(x=>[String(x.id),x.name])}/></Field><Field label="Invoice date"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Due date"><Input type="date" value={due} onChange={e=>setDue(e.target.value)}/></Field>
  </div><div className="space-y-3"><div className="flex items-center justify-between"><Label>Sale items</Label><Button type="button" size="sm" variant="outline" onClick={()=>setLines(x=>[...x,{item:"",quantity:"1",price:"",discount:"0"}])}><Plus/>Add line</Button></div>{lines.map((line,n)=><div key={n} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(220px,1fr)_100px_130px_100px_auto]"><Picker value={line.item} set={v=>setLines(x=>x.map((r,i)=>i===n?{...r,item:v}:r))} items={sellables.map(x=>[itemKey(x.productId,x.variantId),x.label])} placeholder="Product / variant"/><Input aria-label="Quantity" type="number" min=".001" step=".001" value={line.quantity} onChange={e=>setLines(x=>x.map((r,i)=>i===n?{...r,quantity:e.target.value}:r))}/><Input aria-label="Price override" type="number" min=".01" step=".01" placeholder="Auto price" value={line.price} onChange={e=>setLines(x=>x.map((r,i)=>i===n?{...r,price:e.target.value}:r))}/><Input aria-label="Discount percent" type="number" min="0" max="100" step=".01" value={line.discount} onChange={e=>setLines(x=>x.map((r,i)=>i===n?{...r,discount:e.target.value}:r))}/><Button type="button" variant="ghost" disabled={lines.length===1} onClick={()=>setLines(x=>x.filter((_,i)=>i!==n))}>Remove</Button></div>)}</div>
  <div className="my-5 grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-3"><Field label="Payment method (optional)"><Picker value={payment.method} set={v=>setPayment(x=>({...x,method:v}))} items={methods.map(x=>[x.code,x.name])}/></Field><Field label="Amount collected"><Input type="number" min=".01" step=".01" value={payment.amount} onChange={e=>setPayment(x=>({...x,amount:e.target.value}))}/></Field><Field label="Reference"><Input value={payment.reference} onChange={e=>setPayment(x=>({...x,reference:e.target.value}))}/></Field></div><Field label="Remarks"><Textarea value={remarks} onChange={e=>setRemarks(e.target.value)}/></Field><Footer busy={mutation.isPending} close={close} label="Post sale"/></form></DialogContent></Dialog>;
}

function PaymentDialog({open,invoices,methods,close,saved}:{open:boolean;invoices:SalesInvoice[];methods:PaymentMethod[];close:()=>void;saved:()=>Promise<void>}){
  const [invoice,setInvoice]=React.useState(""),[method,setMethod]=React.useState(""),[amount,setAmount]=React.useState(""),[date,setDate]=React.useState(today()),[reference,setReference]=React.useState("");
  const mutation=useMutation({mutationFn:()=>apiClient.post(`sales/invoices/${invoice}/payments`,{paymentMethodCode:method,amount:Number(amount),paymentDate:date,referenceNumber:reference||null,remarks:"Recorded from Sales workspace"}),onSuccess:async()=>{toast.success("Customer payment posted");await saved()},onError:e=>toast.error(message(e))});
  return <Dialog open={open} onOpenChange={v=>{if(!v)close()}}><DialogContent><form onSubmit={e=>{e.preventDefault();mutation.mutate()}}><DialogHeader><DialogTitle>Record customer payment</DialogTitle><DialogDescription>The collectible balance is locked and validated by the backend.</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2"><Field label="Invoice"><Picker value={invoice} set={setInvoice} items={invoices.map(x=>[String(x.id),`${x.invoiceNumber} — due ${money.format(x.balanceAmount)}`])}/></Field><Field label="Method"><Picker value={method} set={setMethod} items={methods.map(x=>[x.code,x.name])}/></Field><Field label="Amount"><Input required type="number" min=".01" step=".01" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Field label="Date"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Reference" className="sm:col-span-2"><Input value={reference} onChange={e=>setReference(e.target.value)}/></Field></div><Footer busy={mutation.isPending} close={close}/></form></DialogContent></Dialog>;
}

function ReturnDialog({open,invoices,close,saved}:{open:boolean;invoices:SalesInvoice[];close:()=>void;saved:()=>Promise<void>}){
  const [invoiceId,setInvoiceId]=React.useState(""),[lineId,setLineId]=React.useState(""),[quantity,setQuantity]=React.useState(""),[date,setDate]=React.useState(today()),[reason,setReason]=React.useState("");
  const invoice=invoices.find(x=>x.id===Number(invoiceId));
  React.useEffect(()=>setLineId(""),[invoiceId]);
  const mutation=useMutation({mutationFn:()=>apiClient.post("sales/returns",{invoiceId:Number(invoiceId),returnDate:date,reason,lines:[{invoiceItemId:Number(lineId),quantity:Number(quantity),reason}]}),onSuccess:async()=>{toast.success("Sales return posted — tracked stock restored");await saved()},onError:e=>toast.error(message(e))});
  return <Dialog open={open} onOpenChange={v=>{if(!v)close()}}><DialogContent><form onSubmit={e=>{e.preventDefault();mutation.mutate()}}><DialogHeader><DialogTitle>Post sales return</DialogTitle><DialogDescription>Select the exact invoice line. The backend prevents returning more than was sold and restores its product variant.</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2"><Field label="Invoice"><Picker value={invoiceId} set={setInvoiceId} items={invoices.map(x=>[String(x.id),x.invoiceNumber])}/></Field><Field label="Invoice line"><Picker value={lineId} set={setLineId} items={(invoice?.lines??[]).map(x=>[String(x.id),`${x.productName} ${x.variantName??""} — sold ${x.quantity}`])}/></Field><Field label="Return quantity"><Input required type="number" min=".001" step=".001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field><Field label="Return date"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Reason" className="sm:col-span-2"><Textarea required value={reason} onChange={e=>setReason(e.target.value)}/></Field></div><Footer busy={mutation.isPending} close={close} label="Post return"/></form></DialogContent></Dialog>;
}

function DetailDialog({value,customer,close}:{value:SalesInvoice|SalesReturn|null;customer?:Customer;close:()=>void}){
  const isInvoice=value&&"invoiceNumber" in value;
  const title=!value?"":isInvoice?value.invoiceNumber:value.returnNumber;
  const lines=value?.lines??[];
  return <Dialog open={!!value} onOpenChange={v=>{if(!v)close()}}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{customer?.name??"Customer"} · {value?.status}</DialogDescription></DialogHeader><Grid heads={["Item","Quantity","Amount","Inventory proof"]}>{lines.map((line,n)=><TableRow key={n}><TableCell className="font-medium">{"productName" in line?line.productName:`Product #${line.productId}`}{"variantName" in line&&line.variantName?<span className="block text-xs text-muted-foreground">{line.variantName} · {line.variantSku}</span>:null}</TableCell><TableCell>{line.quantity}</TableCell><TableCell>{money.format(line.lineTotal)}</TableCell><TableCell>{line.inventoryTracked?`Transaction #${line.inventoryTransactionId}`:"Not tracked"}</TableCell></TableRow>)}</Grid></DialogContent></Dialog>;
}

function LedgerDialog({customer,close}:{customer:Customer|null;close:()=>void}){
  const q=useQuery({queryKey:["sales","ledger",customer?.id],queryFn:()=>apiClient.get<CustomerLedger>(`sales/customers/${customer!.id}/ledger?page=0&size=100`),enabled:!!customer});
  return <Dialog open={!!customer} onOpenChange={v=>{if(!v)close()}}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{customer?.name} ledger</DialogTitle><DialogDescription>Outstanding: {money.format(q.data?.summary.outstandingBalance??0)}</DialogDescription></DialogHeader>{q.isLoading?<Loader2 className="animate-spin"/>:<Grid heads={["Date","Type","Document","Receivable effect"]}>{(q.data?.transactions.content??[]).map((x,n)=><TableRow key={n}><TableCell>{x.businessDate}</TableCell><TableCell>{x.entryType}</TableCell><TableCell>{x.documentNumber}</TableCell><TableCell>{money.format(x.receivableEffect)}</TableCell></TableRow>)}</Grid>}</DialogContent></Dialog>;
}

function WishlistDialog({customer,sellables,close}:{customer:Customer|null;sellables:Sellable[];close:()=>void}){
  const qc=useQueryClient();const [item,setItem]=React.useState(""),[quantity,setQuantity]=React.useState("1"),[remarks,setRemarks]=React.useState("");
  const q=useQuery({queryKey:["sales","wishlist",customer?.id],queryFn:()=>apiClient.get<Wishlist>(`sales/customers/${customer!.id}/wishlist`),enabled:!!customer,retry:false});
  const save=useMutation({mutationFn:()=>{const s=sellables.find(x=>itemKey(x.productId,x.variantId)===item);if(!s)throw new Error("Select an item");const body={remarks,items:[{productId:s.productId,productVariantId:s.variantId,quantity:Number(quantity),remarks}]};return q.data?apiClient.put(`sales/customers/${customer!.id}/wishlist`,body):apiClient.post(`sales/customers/${customer!.id}/wishlist`,body)},onSuccess:async()=>{toast.success("Wishlist saved");await qc.invalidateQueries({queryKey:["sales","wishlist",customer?.id]})},onError:e=>toast.error(message(e))});
  const remove=useMutation({mutationFn:(id:number)=>apiClient.delete(`sales/customers/${customer!.id}/wishlist/items/${id}`),onSuccess:async()=>qc.invalidateQueries({queryKey:["sales","wishlist",customer?.id]}),onError:e=>toast.error(message(e))});
  return <Dialog open={!!customer} onOpenChange={v=>{if(!v)close()}}><DialogContent><DialogHeader><DialogTitle>{customer?.name} wishlist</DialogTitle><DialogDescription>Record requested product variants for follow-up and future conversion.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Product / variant"><Picker value={item} set={setItem} items={sellables.map(x=>[itemKey(x.productId,x.variantId),x.label])}/></Field><Field label="Quantity"><Input type="number" min=".001" step=".001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field><Field label="Remarks" className="sm:col-span-2"><Input value={remarks} onChange={e=>setRemarks(e.target.value)}/></Field></div>{(q.data?.items??[]).map(x=><div key={x.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><span>{sellables.find(s=>s.productId===x.productId&&s.variantId===x.productVariantId)?.label??`Product #${x.productId}`} · {x.quantity}</span><Button size="sm" variant="ghost" onClick={()=>remove.mutate(x.id)}>Remove</Button></div>)}<DialogFooter><Button variant="outline" onClick={close}>Close</Button><Button onClick={()=>save.mutate()} disabled={save.isPending}>{save.isPending&&<Loader2 className="animate-spin"/>}{q.data?"Replace wishlist":"Create wishlist"}</Button></DialogFooter></DialogContent></Dialog>;
}
