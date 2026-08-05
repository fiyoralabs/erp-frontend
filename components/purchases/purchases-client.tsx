"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileCheck, FileUp, Loader2, Plus, ReceiptText, Truck, Undo2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { apiClient,ApiRequestError,type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { Location,PaymentMethod,Tax } from "@/lib/types/master";
import type { ProductSummary,Variant } from "@/lib/types/product";
import type { GoodsReceipt,PurchaseInvoice,PurchaseOrder,PurchasePayment,PurchaseReturn,Supplier,SupplierLedger } from "@/lib/types/purchase";
import { Badge } from "@/components/ui/badge"; import { Button } from "@/components/ui/button"; import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card"; import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog"; import { Input } from "@/components/ui/input"; import { Label } from "@/components/ui/label"; import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select"; import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table"; import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs"; import { Textarea } from "@/components/ui/textarea";

type Sellable={productId:number;variantId:number|null;label:string}; type Action="supplier"|"order"|"receipt"|"invoice"|"payment"|"return"|null;
const today=localDateInputValue; const money=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}); const err=(e:unknown)=>e instanceof ApiRequestError||e instanceof Error?e.message:"Something went wrong"; const key=(p:number,v:number|null)=>`${p}:${v??"base"}`;

type WorkingLocationContext = { activeLocation: Location | null; allowedLocations: Location[]; locationRequired: boolean };

export function PurchasesClient(){const qc=useQueryClient();const[action,setAction]=React.useState<Action>(null);const[detail,setDetail]=React.useState<PurchaseOrder|GoodsReceipt|PurchaseInvoice|PurchaseReturn|PurchasePayment|null>(null);const[ledgerSupplier,setLedgerSupplier]=React.useState<Supplier|null>(null);
 const locationContextQuery = useQuery({ queryKey: ["users", "me", "context"], queryFn: () => apiClient.get<WorkingLocationContext>("users/me/context") });
 const activeLocation = locationContextQuery.data?.activeLocation ?? null;
 const suppliers=useQuery({queryKey:["purchase","suppliers"],queryFn:()=>apiClient.get<Supplier[]>("purchases/suppliers")});
 const orders=useQuery({queryKey:["purchase","orders",activeLocation?.id],enabled:!!activeLocation,queryFn:()=>apiClient.get<PurchaseOrder[]>(`purchases/orders?locationId=${activeLocation!.id}`)});
 const receipts=useQuery({queryKey:["purchase","receipts",activeLocation?.id],enabled:!!activeLocation,queryFn:()=>apiClient.get<GoodsReceipt[]>(`purchases/goods-receipts?locationId=${activeLocation!.id}`)});
 const invoices=useQuery({queryKey:["purchase","invoices",activeLocation?.id],enabled:!!activeLocation,queryFn:()=>apiClient.get<PurchaseInvoice[]>(`purchases/invoices?locationId=${activeLocation!.id}`)});
 const returns=useQuery({queryKey:["purchase","returns",activeLocation?.id],enabled:!!activeLocation,queryFn:()=>apiClient.get<PurchaseReturn[]>(`purchases/returns?locationId=${activeLocation!.id}`)});
 const payments=useQuery({queryKey:["purchase","payments"],queryFn:()=>apiClient.get<PurchasePayment[]>("purchases/payments")});
 const locations=useQuery({queryKey:["master","locations","purchase"],queryFn:()=>apiClient.get<PagedResult<Location>>("master/locations?page=0&size=100")}); const taxes=useQuery({queryKey:["master","taxes","purchase"],queryFn:()=>apiClient.get<PagedResult<Tax>>("master/taxes?page=0&size=100")}); const methods=useQuery({queryKey:["master","payment-methods","purchase"],queryFn:()=>apiClient.get<PagedResult<PaymentMethod>>("master/payment-methods?page=0&size=100")}); const sellables=useQuery({queryKey:["purchase","sellables"],queryFn:async()=>{const p=await apiClient.get<PagedResult<ProductSummary>>("products?page=0&size=100");return(await Promise.all(p.content.filter(x=>x.isActive).map(async x=>x.hasVariants?(await apiClient.get<Variant[]>(`products/${x.id}/variants`)).filter(v=>v.isActive).map(v=>({productId:x.id,variantId:v.id,label:`${x.name} — ${v.variantName} (${v.sku})`})):[{productId:x.id,variantId:null,label:`${x.name} (${x.code})`}]))).flat() as Sellable[];}});
 const refresh=()=>Promise.all(["suppliers","orders","receipts","invoices","returns","payments"].map(x=>qc.invalidateQueries({queryKey:["purchase",x]}))); const o=orders.data??[],r=receipts.data??[],i=invoices.data??[]; const toReceive=o.filter(x=>x.status!=="RECEIVED").length,toInvoice=r.filter(x=>!i.some(y=>y.goodsReceiptId===x.id)).length,due=i.reduce((a,x)=>a+x.balanceAmount,0);
 return <div className="flex flex-col gap-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-2xl font-semibold">Purchases</h1><p className="text-sm text-muted-foreground">Order, receive, verify supplier invoices, pay, and return stock from one connected workspace.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setAction("supplier")}><Plus/>Supplier</Button><Link href="/purchases/new"><Button><Plus/>Purchase order</Button></Link></div></div>
 <div className="grid gap-3 sm:grid-cols-3"><Metric label="Orders to receive" value={String(toReceive)} warn={toReceive>0}/><Metric label="Receipts to invoice" value={String(toInvoice)} warn={toInvoice>0}/><Metric label="Supplier amount due" value={money.format(due)} warn={due>0}/></div>
  <Tabs defaultValue="orders"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="receipts">Goods receipts</TabsTrigger><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="suppliers">Suppliers</TabsTrigger><TabsTrigger value="returns">Returns</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger></TabsList>
  <Tab value="orders" title="Purchase orders" desc="Approved commitments and receipt progress." action={toReceive>0?<Link href="/purchases"><Button onClick={()=>setAction("receipt")}><Truck/>Receive goods</Button></Link>:undefined}><TableWrap heads={["PO","Supplier","Location","Expected","Progress","Total","Actions"]}>{o.map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.poNumber}</TableCell><TableCell>{x.supplierName}</TableCell><TableCell>{x.locationName}</TableCell><TableCell>{x.expectedDate??"—"}</TableCell><TableCell><Status text={x.status}/></TableCell><TableCell>{money.format(x.totalAmount)}</TableCell><TableCell><div className="flex items-center gap-2">{["APPROVED","PARTIALLY_RECEIVED"].includes(x.status)&&<Link href={`/purchases/receive?poId=${x.id}`}><Button size="sm" className="gap-1"><Truck className="h-3.5 w-3.5"/>Receive</Button></Link>}<Button size="sm" variant="outline" onClick={()=>setDetail(x)}>View</Button></div></TableCell></TableRow>)}</TableWrap></Tab>
  <Tab value="receipts" title="Goods receipts" desc="Accepted stock is already reflected in Inventory."><TableWrap heads={["GRN","PO","Supplier","Location","Date","Lines","Actions"]}>{r.map(x=>{const isAlreadyInvoiced=i.some(inv=>String(inv.goodsReceiptId)===String(x.id));return <TableRow key={x.id}><TableCell className="font-medium">{x.grnNumber}</TableCell><TableCell>{x.poNumber}</TableCell><TableCell>{x.supplierName}</TableCell><TableCell>{x.locationName}</TableCell><TableCell>{x.receiptDate}</TableCell><TableCell>{x.lines.length}</TableCell><TableCell><div className="flex items-center gap-2">{isAlreadyInvoiced?<Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-normal py-1 px-2.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600"/>Invoiced</Badge>:<Link href={`/purchases/invoice/new?grnId=${x.id}`}><Button size="sm" className="gap-1"><ReceiptText className="h-3.5 w-3.5"/>Post invoice</Button></Link>}<Button size="sm" variant="outline" onClick={()=>setDetail(x)}>View</Button></div></TableCell></TableRow>})}</TableWrap></Tab>
   <Tab value="invoices" title="Supplier invoices" desc="Balances are tied to payments, returns, supplier ledger, and Finance journals."><TableWrap heads={["Invoice","Supplier","GRN","Due","Status","Balance","Actions"]}>{i.map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.invoiceNumber}</TableCell><TableCell>{x.supplierName}</TableCell><TableCell>{x.grnNumber}</TableCell><TableCell>{x.dueDate??"—"}</TableCell><TableCell><Status text={x.status}/></TableCell><TableCell className="font-medium">{money.format(x.balanceAmount)}</TableCell><TableCell><div className="flex items-center gap-2">{x.balanceAmount>0&&<Link href={`/purchases/payment/new?invoiceId=${x.id}`}><Button size="sm" className="gap-1"><WalletCards className="h-3.5 w-3.5"/>Record payment</Button></Link>}<Link href={`/purchases/return/new?invoiceId=${x.id}`}><Button size="sm" variant="outline" className="gap-1 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/40"><Undo2 className="h-3.5 w-3.5"/>Return</Button></Link><Button size="sm" variant="outline" onClick={()=>setDetail(x)}>View</Button></div></TableCell></TableRow>)}</TableWrap></Tab>
   <Tab value="suppliers" title="Suppliers" desc="Outstanding balances are computed from invoices, payments, and returns."><TableWrap heads={["Code","Supplier","Outstanding","Status",""]}>{(suppliers.data??[]).filter(x=>x.isActive).map(x=><TableRow key={x.id}><TableCell>{x.code}</TableCell><TableCell className="font-medium">{x.name}</TableCell><TableCell>{money.format(x.outstandingBalance)}</TableCell><TableCell><Status text="ACTIVE"/></TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>setLedgerSupplier(x)}>Ledger</Button></TableCell></TableRow>)}</TableWrap></Tab>
   <Tab value="returns" title="Purchase returns" desc="Posted returns reduce the original receipt batch and supplier balance." action={<Link href="/purchases"><Button variant="outline" onClick={()=>setAction("return")}>New return</Button></Link>}><TableWrap heads={["Return","Invoice","Supplier","Date","Total",""]}>{(returns.data??[]).map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.returnNumber}</TableCell><TableCell>{x.invoiceNumber}</TableCell><TableCell>{x.supplierName}</TableCell><TableCell>{x.returnDate}</TableCell><TableCell>{money.format(x.totalAmount)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>setDetail(x)}>View</Button></TableCell></TableRow>)}</TableWrap></Tab>
  <Tab value="payments" title="Supplier payments" desc="Posted payments are reflected in supplier ledger and Finance."><TableWrap heads={["Date","Invoice","Supplier","Method","Reference","Amount","Status","Actions"]}>{(payments.data??[]).map(x=><TableRow key={x.id}><TableCell>{x.paymentDate}</TableCell><TableCell>{x.invoiceNumber?x.invoiceNumber:`Invoice #${x.purchaseInvoiceId}`}</TableCell><TableCell className="font-medium">{x.supplierName??"—"}</TableCell><TableCell>{x.paymentMethodCode.replaceAll("_"," ")}</TableCell><TableCell className="font-mono text-xs">{x.referenceNumber??"—"}</TableCell><TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">{money.format(x.amount)}</TableCell><TableCell><Status text={x.status}/></TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>setDetail(x)}>View</Button></TableCell></TableRow>)}</TableWrap></Tab>
  </Tabs>
  <ActionDialog action={action} close={()=>setAction(null)} saved={async()=>{await refresh();setAction(null)}} activeLocation={activeLocation} suppliers={suppliers.data??[]} orders={o} receipts={r} invoices={i} locations={(locations.data?.content??[]).filter(x=>x.isActive)} taxes={(taxes.data?.content??[]).filter(x=>x.isActive)} methods={(methods.data?.content??[]).filter(x=>x.isActive)} sellables={sellables.data??[]}/>
  <DetailDialog value={detail} close={()=>setDetail(null)}/>
  <LedgerDialog supplier={ledgerSupplier} close={()=>setLedgerSupplier(null)}/>
 </div>}

function Metric({label,value,warn}:{label:string;value:string;warn?:boolean}){return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className={warn?"text-2xl font-semibold text-amber-600":"text-2xl font-semibold"}>{value}</p></CardContent></Card>}
function Status({text}:{text:string}){return <Badge variant={["PAID","RECEIVED","POSTED","ACTIVE"].includes(text)?"secondary":"default"}>{text.replaceAll("_"," ")}</Badge>}
function Tab({value,title,desc,action,children}:{value:string;title:string;desc:string;action?:React.ReactNode;children:React.ReactNode}){return <TabsContent value={value} className="mt-4"><Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{title}</CardTitle><CardDescription>{desc}</CardDescription></div>{action}</CardHeader><CardContent>{children}</CardContent></Card></TabsContent>}
function TableWrap({heads,children}:{heads:string[];children:React.ReactNode}){return <div className="overflow-x-auto"><Table><TableHeader><TableRow>{heads.map((h,n)=><TableHead key={n}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div>}

function ActionDialog({action,close,saved,activeLocation,suppliers,orders,receipts,invoices,locations,taxes,methods,sellables}:{action:Action;close:()=>void;saved:()=>Promise<void>;activeLocation:Location|null;suppliers:Supplier[];orders:PurchaseOrder[];receipts:GoodsReceipt[];invoices:PurchaseInvoice[];locations:Location[];taxes:Tax[];methods:PaymentMethod[];sellables:Sellable[]}){const[supplier,setSupplier]=React.useState("");const[location,setLocation]=React.useState("");const[document,setDocument]=React.useState("");const[item,setItem]=React.useState("");const[quantity,setQuantity]=React.useState("");const[price,setPrice]=React.useState("");const[date,setDate]=React.useState(today());const[other,setOther]=React.useState("");const[tax,setTax]=React.useState("");const[method,setMethod]=React.useState("");const[reason,setReason]=React.useState("");React.useEffect(()=>{if(action){setSupplier("");setLocation(activeLocation?String(activeLocation.id):"");setDocument("");setItem("");setQuantity("");setPrice("");setDate(today());setOther("");setTax("");setMethod("");setReason("")}},[action,activeLocation]);const mutation=useMutation({mutationFn:async()=>{const sku=sellables.find(x=>key(x.productId,x.variantId)===item);if(action==="supplier")return apiClient.post("suppliers",{code:other,name:reason,creditLimit:0,paymentTermsDays:30});if(action==="order"){if(!sku)throw new Error("Select an item");return apiClient.post("purchases/orders",{supplierId:Number(supplier),locationId:Number(location),orderDate:date,expectedDate:other||null,lines:[{productId:sku.productId,productVariantId:sku.variantId,orderedQuantity:Number(quantity),unitPrice:Number(price),discountAmount:0,taxPercentage:0}]})}if(action==="receipt"){const po=orders.find(x=>x.id===Number(document))!;const line=po.lines[0];return apiClient.post("purchases/goods-receipts",{purchaseOrderId:po.id,locationId:po.locationId,receiptDate:date,lines:[{productId:line.productId,productVariantId:line.productVariantId,receivedQuantity:Number(quantity),acceptedQuantity:Number(quantity),rejectedQuantity:0,purchasePrice:Number(price),batchNumber:other||null}]})}if(action==="invoice"){const grn=receipts.find(x=>x.id===Number(document))!;const line=grn.lines[0];return apiClient.post("purchases/invoices",{supplierId:grn.supplierId,goodsReceiptId:grn.id,invoiceNumber:other,invoiceDate:date,dueDate:null,lines:[{productId:line.productId,productVariantId:line.productVariantId,quantity:Number(quantity),purchasePrice:Number(price),taxId:Number(tax)}]})}if(action==="payment")return apiClient.post(`purchases/invoices/${document}/payments`,{paymentMethodCode:method,amount:Number(quantity),paymentDate:date,referenceNumber:other||null});const inv=invoices.find(x=>x.id===Number(document))!;const line=inv.lines[0];return apiClient.post("purchases/returns",{purchaseInvoiceId:inv.id,returnDate:date,reason,lines:[{productId:line.productId,productVariantId:line.productVariantId,quantity:Number(quantity),reason}]});},onSuccess:async()=>{toast.success("Purchase transaction posted");await saved()},onError:e=>toast.error(err(e))});const title={supplier:"Add supplier",order:"Create purchase order",receipt:"Receive goods",invoice:"Post supplier invoice",payment:"Record supplier payment",return:"Return to supplier"}[action??"order"];return <Dialog open={!!action} onOpenChange={x=>{if(!x)close()}}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Posts directly to the connected Purchase, Inventory, supplier ledger, and Finance workflow.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">{action==="supplier"?<><Field label="Supplier code"><Input value={other} onChange={e=>setOther(e.target.value)}/></Field><Field label="Supplier name"><Input value={reason} onChange={e=>setReason(e.target.value)}/></Field></>:<>{action==="order"&&<><Field label="Supplier"><Picker value={supplier} set={setSupplier} values={suppliers.map(x=>[String(x.id),x.name])}/></Field><Field label="Location"><Picker value={location} set={setLocation} values={locations.map(x=>[String(x.id),x.name])}/></Field><Field label="Item / variant"><Picker value={item} set={setItem} values={sellables.map(x=>[key(x.productId,x.variantId),x.label])}/></Field></>}{["receipt","invoice","payment","return"].includes(action??"")&&<Field label={action==="receipt"?"Open order":action==="invoice"?"Uninvoiced receipt":"Invoice"}><Picker value={document} set={setDocument} values={(action==="receipt"?orders.filter(x=>x.status!=="RECEIVED"):action==="invoice"?receipts.filter(x=>!invoices.some(i=>i.goodsReceiptId===x.id)):invoices.filter(x=>x.balanceAmount>0)).map(x=>[String(x.id),String((x as {poNumber?:string;invoiceNumber?:string;grnNumber?:string}).poNumber??(x as {invoiceNumber?:string}).invoiceNumber??(x as {grnNumber?:string}).grnNumber??x.id)])}/></Field>}<Field label="Date"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label={action==="payment"?"Amount":"Quantity"}><Input type="number" min="0.001" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field>{["order","receipt","invoice"].includes(action??"")&&<Field label="Unit price"><Input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></Field>}{action==="invoice"&&<><Field label="Supplier invoice number"><Input value={other} onChange={e=>setOther(e.target.value)}/></Field><Field label="Tax"><Picker value={tax} set={setTax} values={taxes.map(x=>[String(x.id),`${x.name} (${x.taxPercentage}%)`])}/></Field></>}{action==="payment"&&<><Field label="Payment method"><Picker value={method} set={setMethod} values={methods.map(x=>[x.code,x.name])}/></Field><Field label="Reference"><Input value={other} onChange={e=>setOther(e.target.value)}/></Field></>}{action==="receipt"&&<Field label="Batch / lot"><Input value={other} onChange={e=>setOther(e.target.value)}/></Field>}{action==="order"&&<Field label="Expected date"><Input type="date" value={other} onChange={e=>setDate(e.target.value)}/></Field>}{action==="return"&&<Field label="Reason"><Textarea value={reason} onChange={e=>setReason(e.target.value)}/></Field>}</>}</div><DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={()=>mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending&&<Loader2 className="animate-spin"/>}Post</Button></DialogFooter></DialogContent></Dialog>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>} function Picker({value,set,values}:{value:string;set:(x:string)=>void;values:string[][]}){return <Select items={Object.fromEntries(values)} value={value} onValueChange={x=>set(x??"")}><SelectTrigger className="w-full"><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{values.map(x=><SelectItem key={x[0]} value={x[0]}>{x[1]}</SelectItem>)}</SelectContent></Select>}

function DetailDialog({value,close}:{value:PurchaseOrder|GoodsReceipt|PurchaseInvoice|PurchaseReturn|PurchasePayment|null;close:()=>void}){
  if (!value) return null;

  const doc = value as Record<string, any>;
  const isPayment = "paymentMethodCode" in doc || ("amount" in doc && !("lines" in doc));
  const isInvoice = "invoiceNumber" in doc && "balanceAmount" in doc;
  const isGRN = "grnNumber" in doc && "lines" in doc;
  const isPO = "poNumber" in doc && "lines" in doc;
  const isReturn = "returnNumber" in doc && "lines" in doc;

  const lines = Array.isArray(doc.lines) ? doc.lines : [];
  const ref = isPayment
    ? `Payment #${doc.id}`
    : isInvoice
    ? String(doc.invoiceNumber)
    : isGRN
    ? String(doc.grnNumber)
    : isReturn
    ? String(doc.returnNumber)
    : isPO
    ? String(doc.poNumber)
    : `Doc #${doc.id}`;

  const supplier = (value as { supplierName?: string }).supplierName ?? "—";
  const location = (value as { locationName?: string }).locationName ?? "—";
  const date = (value as { orderDate?: string; receiptDate?: string; invoiceDate?: string; returnDate?: string; paymentDate?: string }).orderDate
    ?? (value as { receiptDate?: string }).receiptDate
    ?? (value as { invoiceDate?: string }).invoiceDate
    ?? (value as { returnDate?: string }).returnDate
    ?? (value as { paymentDate?: string }).paymentDate
    ?? "—";

  const total = (value as { totalAmount?: number; amount?: number }).totalAmount ?? (value as { amount?: number }).amount;
  const balance = (value as { balanceAmount?: number }).balanceAmount;
  const paid = (value as { paidAmount?: number }).paidAmount;

  return (
    <Dialog open={!!value} onOpenChange={x=>{if(!x)close()}}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">{ref}</DialogTitle>
            {value.status && <Status text={String(value.status)}/>}
          </div>
          <DialogDescription>Full document details, supplier identity, and itemized breakdown.</DialogDescription>
        </DialogHeader>

        {/* Payment Summary View */}
        {isPayment ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-md text-xs border">
              <div><span className="text-muted-foreground block">Supplier:</span><strong className="text-sm">{supplier}</strong></div>
              <div><span className="text-muted-foreground block">Invoice #:</span><strong className="text-sm">{(value as { invoiceNumber?: string }).invoiceNumber ?? `Invoice #${(value as { purchaseInvoiceId?: number }).purchaseInvoiceId}`}</strong></div>
              <div><span className="text-muted-foreground block">Payment Date:</span><strong className="text-sm">{date}</strong></div>
              <div><span className="text-muted-foreground block">Method:</span><strong className="text-sm">{String((value as { paymentMethodCode?: string }).paymentMethodCode).replaceAll("_", " ")}</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-md border bg-emerald-50/50 dark:bg-emerald-950/20">
              <div>
                <span className="text-xs text-muted-foreground block">Transaction Reference / UTR #</span>
                <strong className="text-sm font-mono">{(value as { referenceNumber?: string }).referenceNumber ?? "—"}</strong>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Amount Paid</span>
                <strong className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{money.format(total ?? 0)}</strong>
              </div>
            </div>

            {/* Payment Proof Attachment Link */}
            {doc.attachmentUrl && (
              <div className="p-3 rounded-md bg-muted/30 border space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground">Attached Proof of Payment</div>
                <a
                  href={doc.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-medium"
                >
                  <FileCheck className="h-3.5 w-3.5" /> View Attached Payment Receipt / Proof ↗
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* General Header Details Grid */}
            <div className="grid grid-cols-3 gap-3 bg-muted/40 p-3 rounded-md text-xs border my-1">
              <div><span className="text-muted-foreground block">Supplier:</span><strong className="text-sm">{supplier}</strong></div>
              <div><span className="text-muted-foreground block">Store Location:</span><strong className="text-sm">{location}</strong></div>
              <div><span className="text-muted-foreground block">Date:</span><strong className="text-sm">{date}</strong></div>
            </div>

            {/* Linked Documents & Attachments */}
            {isInvoice && (
              <div className="space-y-2">
                {(value as { grnNumber?: string }).grnNumber && (
                  <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded border">
                    <strong>Linked Goods Receipt:</strong> {(value as { grnNumber?: string }).grnNumber}
                    {(value as { dueDate?: string }).dueDate && <span className="ml-4"><strong>Due Date:</strong> {(value as { dueDate?: string }).dueDate}</span>}
                  </div>
                )}

                {(doc.attachmentUrl || doc.paymentProofUrl) && (
                  <div className="p-3 rounded-md bg-muted/30 border space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Attached Scanned Documents</div>
                    <div className="flex flex-wrap gap-2">
                      {doc.attachmentUrl && (
                        <a
                          href={doc.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-800 hover:bg-blue-100 font-medium"
                        >
                          <FileUp className="h-3.5 w-3.5" /> View Attached Supplier Tax Invoice ↗
                        </a>
                      )}
                      {doc.paymentProofUrl && (
                        <a
                          href={doc.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-medium"
                        >
                          <FileCheck className="h-3.5 w-3.5" /> View Attached Payment Proof ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(value as { remarks?: string } | null)?.remarks && (
              <div className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded border">
                <strong>Remarks:</strong> {(value as { remarks?: string }).remarks}
              </div>
            )}

            {/* Document Line Items */}
            <div className="space-y-2 mt-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document Line Items ({lines.length})</div>
              <TableWrap heads={["Item & Variant","SKU","Qty","Unit Price (₹)","Discount (₹)","Tax (%)","Line Total (₹)"]}>
                {lines.map((x,n)=>{
                  const qty = (x as { orderedQuantity?: number; acceptedQuantity?: number; quantity?: number }).orderedQuantity 
                    ?? (x as { acceptedQuantity?: number; quantity?: number }).acceptedQuantity 
                    ?? (x as { quantity?: number }).quantity 
                    ?? 1;
                  const price = (x as { unitPrice?: number; purchasePrice?: number }).unitPrice 
                    ?? (x as { purchasePrice?: number }).purchasePrice 
                    ?? 0;
                  const discount = (x as { discountAmount?: number }).discountAmount ?? 0;
                  const taxPct = (x as { taxPercentage?: number }).taxPercentage ?? 0;
                  const taxAmt = (x as { taxAmount?: number }).taxAmount ?? 0;
                  const lineTotal = (x as { lineTotal?: number }).lineTotal ?? (qty * price - discount + taxAmt);

                  return (
                    <TableRow key={n}>
                      <TableCell className="font-medium">
                        {(x as { productName?: string }).productName}
                        <span className="block text-xs text-muted-foreground">{(x as { variantName?: string }).variantName??"Base Item"}</span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{(x as { sku?: string }).sku??"—"}</TableCell>
                      <TableCell className="font-semibold">{qty}</TableCell>
                      <TableCell>{money.format(price)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{discount > 0 ? money.format(discount) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{taxPct > 0 ? `${taxPct}%` : "—"}</TableCell>
                      <TableCell className="font-semibold">{money.format(lineTotal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableWrap>
            </div>

            {/* Invoice Financial Summary */}
            {isInvoice && balance != null && (
              <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-muted/30 border text-xs text-right mt-2">
                <div><span className="text-muted-foreground block">Invoice Total:</span><strong className="text-sm font-semibold">{money.format(total ?? 0)}</strong></div>
                <div><span className="text-muted-foreground block">Paid Amount:</span><strong className="text-sm font-semibold text-emerald-600">{money.format(paid ?? 0)}</strong></div>
                <div><span className="text-muted-foreground block">Outstanding Balance:</span><strong className="text-sm font-bold text-amber-600">{money.format(balance)}</strong></div>
              </div>
            )}

            {!isInvoice && total != null && (
              <div className="flex justify-end pt-2 border-t font-semibold text-sm">
                <span>Total Document Value:&nbsp;</span>
                <span className="text-primary">{money.format(total)}</span>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function LedgerDialog({supplier,close}:{supplier:Supplier|null;close:()=>void}){const q=useQuery({queryKey:["purchase","ledger",supplier?.id],enabled:!!supplier,queryFn:()=>apiClient.get<SupplierLedger>(`suppliers/${supplier!.id}/ledger?page=0&size=100`)});return <Dialog open={!!supplier} onOpenChange={x=>{if(!x)close()}}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{supplier?.name} ledger</DialogTitle><DialogDescription>Outstanding {money.format(q.data?.outstandingBalance??0)}</DialogDescription></DialogHeader><TableWrap heads={["Date","Type","Reference","Amount"]}>{(q.data?.transactions.content??[]).map((x,n)=><TableRow key={n}><TableCell>{x.date}</TableCell><TableCell>{x.type}</TableCell><TableCell>{x.reference}</TableCell><TableCell>{money.format(x.amount)}</TableCell></TableRow>)}</TableWrap></DialogContent></Dialog>}
