"use client";

import * as React from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  ArrowLeft,
  CameraOff,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
  AlertCircle,
  Zap,
  ZapOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface ScanResult {
  success: boolean;
  name?: string;
  variantName?: string;
  price?: number;
  error?: string;
}

// Minimal, presentation-only cart line shape -- decoupled from POS's own
// CartItem type on purpose so this shared/ component never has to import
// from sales/ (avoids a circular import back into pos-client.tsx).
export interface ScannerCartItem {
  key: string | number;
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

// Same decoupling rationale as ScannerCartItem -- a minimal shape the
// inline "no barcode? search instead" panel needs, independent of POS's
// own SellableItem type.
export interface ScannerSearchResult {
  key: string | number;
  name: string;
  variantName?: string | null;
  price: number;
}

interface CameraScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (scannedCode: string) => ScanResult | boolean;
  onOpenPayment?: () => void;
  onIncrementQty?: (key: string | number) => void;
  onDecrementQty?: (key: string | number) => void;
  cart?: ScannerCartItem[];
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchResults?: ScannerSearchResult[];
  isSearching?: boolean;
  onAddSearchResult?: (key: string | number) => void;
  title?: string;
}

// Device detection helper: Camera scanning is MOBILE ONLY.
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const isMobileViewport = window.innerWidth < 1024;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return isMobileViewport || (hasTouch && userAgentMobile);
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.ITF,
];

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function CameraScannerDialog({
  open,
  onOpenChange,
  onScan,
  onOpenPayment,
  onIncrementQty,
  onDecrementQty,
  cart = [],
  searchQuery = "",
  onSearchQueryChange,
  searchResults = [],
  isSearching = false,
  onAddSearchResult,
  title = "Scan to Bill",
}: CameraScannerDialogProps) {
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const containerId = "pos-camera-barcode-reader";

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [hasTorch, setHasTorch] = React.useState(false);
  // Inline "search instead" panel -- covers the whole screen while open so
  // there's room for a real results list, then returns to the same camera
  // session (never stopped/restarted) when dismissed.
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // Ephemeral "just added" flash -- the live cart list below is now the
  // permanent record, so we no longer need a separate "recently scanned"
  // feed alongside it.
  const [lastScanFeedback, setLastScanFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Duplicate Debounce Reference (prevents scanning the same frame 30 times)
  const lastScannedCodeRef = React.useRef<{ code: string; time: number } | null>(null);

  // Stop scanner and release active camera tracks
  const stopScanner = React.useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      } finally {
        scannerRef.current = null;
      }
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const startScanner = React.useCallback(async () => {
    // CRITICAL GUARD: CAMERA SCANNING IS MOBILE ONLY.
    // Never initialize camera, request permissions, or invoke mediaDevices on desktop.
    if (!isMobileDevice()) {
      setIsLoading(false);
      setErrorMsg("Camera barcode scanner is available on mobile devices only.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setLastScanFeedback(null);

    // Stop any active scanner instance first
    await stopScanner();

    // Small delay to allow DOM element rendering inside Dialog
    await new Promise((r) => setTimeout(r, 150));

    const element = document.getElementById(containerId);
    if (!element) {
      setIsLoading(false);
      return;
    }

    try {
      const html5Qrcode = new Html5Qrcode(containerId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = html5Qrcode;

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const boxWidth = Math.max(200, Math.min(320, minEdge - 30));
        const boxHeight = Math.max(140, Math.min(220, Math.floor(boxWidth * 0.65)));
        return { width: boxWidth, height: boxHeight };
      };

      const config = {
        fps: 12,
        qrbox: qrboxFunction,
        aspectRatio: 1.333333,
      };

      // CONTINUOUS SCANNER SUCCESS CALLBACK (DOES NOT CLOSE CAMERA)
      const onScanSuccess = (decodedText: string) => {
        if (!decodedText) return;
        const code = decodedText.trim();
        if (!code) return;

        // 1. DEBOUNCE DUPLICATE FRAMES (1.8 second cooldown for exact same barcode)
        const now = Date.now();
        if (
          lastScannedCodeRef.current &&
          lastScannedCodeRef.current.code === code &&
          now - lastScannedCodeRef.current.time < 1800
        ) {
          return; // Ignore duplicated frame while barcode is held steady
        }
        lastScannedCodeRef.current = { code, time: now };

        // 2. Haptic feedback if supported on mobile
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(80);
          } catch {
            // ignore
          }
        }

        // 3. Process scan with parent handler
        const scanRes = onScan(code);
        const isSuccess = typeof scanRes === "boolean" ? scanRes : scanRes.success;
        const itemName = typeof scanRes === "object" ? scanRes.name : undefined;
        const variantName = typeof scanRes === "object" ? scanRes.variantName : undefined;
        const errText = typeof scanRes === "object" ? scanRes.error : undefined;

        if (isSuccess) {
          const displayName = `${itemName || code}${variantName ? ` (${variantName})` : ""}`;
          setLastScanFeedback({ type: "success", message: `Added: ${displayName}` });
        } else {
          setLastScanFeedback({
            type: "error",
            message: errText ? errText : `No product found for barcode: ${code}`,
          });
        }

        // CRITICAL REQUIREMENT: CAMERA REMAINS OPEN FOR CONTINUOUS SCANNING.
        // DO NOT call stopScanner() or onOpenChange(false) here!
      };

      // Try facing environment (rear camera) first, fallback to user camera
      try {
        await html5Qrcode.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          () => {}
        );
      } catch {
        await html5Qrcode.start(
          { facingMode: "user" },
          config,
          onScanSuccess,
          () => {}
        );
      }

      setIsLoading(false);

      // Check if torch/flashlight is supported
      try {
        const capabilities = html5Qrcode.getRunningTrackCapabilities?.() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      setIsLoading(false);
      const msg = err?.message || String(err);
      if (
        msg.includes("Permission") ||
        msg.includes("NotAllowedError") ||
        msg.includes("denied")
      ) {
        setErrorMsg(
          "Camera access is blocked or permission was denied. Please allow camera access in your browser settings to scan barcodes."
        );
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFoundError")) {
        setErrorMsg("No camera device was found on this device.");
      } else {
        setErrorMsg(`Could not start camera scanner: ${msg}`);
      }
    }
  }, [containerId, onScan, stopScanner]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch {
      // ignore
    }
  };

  const handleClose = () => {
    stopScanner();
    onOpenChange(false);
  };

  const handlePay = () => {
    stopScanner();
    onOpenChange(false);
    if (onOpenPayment) {
      onOpenPayment();
    }
  };

  React.useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
      setIsSearchOpen(false);
    }

    return () => {
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  // Auto-dismiss the flash banner so it doesn't linger over the viewfinder
  React.useEffect(() => {
    if (!lastScanFeedback) return;
    const t = setTimeout(() => setLastScanFeedback(null), 2200);
    return () => clearTimeout(t);
  }, [lastScanFeedback]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) stopScanner();
        onOpenChange(val);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none max-h-none translate-x-0 translate-y-0 rounded-none border-none p-0 gap-0 ring-0 bg-black flex flex-col overflow-hidden"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Point your mobile device camera at product barcodes to continuously add them to the cart.
        </DialogDescription>

        {isSearchOpen ? (
        <div className="flex-1 min-h-0 flex flex-col bg-card">
          <div className="shrink-0 flex items-center gap-2 p-3 border-b bg-card">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setIsSearchOpen(false)}
              aria-label="Back to camera"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
                placeholder="Search by name, SKU or code..."
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isSearching && searchResults.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-10">
                {searchQuery.trim() ? "No matching products found." : "Type a product name, SKU or code to search."}
              </p>
            ) : (
              searchResults.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onAddSearchResult?.(r.key)}
                  className="w-full flex items-center justify-between gap-2 p-3 rounded-xl border bg-muted/30 text-left active:bg-muted/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{r.name}</div>
                    {r.variantName && <div className="text-[11px] text-muted-foreground truncate">{r.variantName}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-[#0F3D3E]">{money.format(r.price)}</span>
                    <span className="h-6 w-6 rounded-full bg-[#0F3D3E] text-white flex items-center justify-center shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="shrink-0 p-3 border-t bg-card flex items-center justify-between gap-3">
            <div className="text-xs shrink-0">
              <div className="font-bold text-foreground">
                {cartCount} {cartCount === 1 ? "item" : "items"}
              </div>
              <div className="text-[#0F3D3E] font-black">{money.format(cartTotal)}</div>
            </div>
            <Button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              className="flex-1 h-10 text-xs font-bold bg-[#0F3D3E] text-white hover:bg-[#0c3132]"
            >
              Back to Scanning
            </Button>
          </div>
        </div>
        ) : (
        <>
        {/* Camera Viewfinder Section */}
        <div className="relative shrink-0 bg-black overflow-hidden" style={{ height: "42vh", minHeight: 220 }}>
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center p-4 space-y-3 text-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
              <p className="text-xs font-semibold text-white">Starting camera...</p>
              <p className="text-[11px] text-white/60">Please grant camera permission if prompted.</p>
            </div>
          )}

          {errorMsg ? (
            <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center space-y-3 bg-black">
              <div className="h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center">
                <CameraOff className="h-6 w-6" />
              </div>
              <p className="text-xs text-white/80 max-w-xs">{errorMsg}</p>
              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={startScanner} className="gap-1.5 text-xs bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white">
                  <RefreshCw className="h-3.5 w-3.5" /> Try Again
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs text-white/70 hover:bg-white/10 hover:text-white">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* HTML5 QR Code Mount Element */}
              <div id={containerId} className="w-full h-full" />

              {/* Corner-bracket scan frame overlay */}
              {!isLoading && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-60 h-40">
                    <span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
                    <span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
                    <span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
                    <span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Overlaid header controls */}
          <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              {onAddSearchResult && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="Search instead"
                >
                  <Search className="h-4.5 w-4.5" />
                </Button>
              )}
              {hasTorch && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                  onClick={toggleTorch}
                >
                  {torchOn ? <ZapOff className="h-4.5 w-4.5 text-amber-400" /> : <Zap className="h-4.5 w-4.5" />}
                </Button>
              )}
            </div>
          </div>

          {/* Live scan feedback flash */}
          {lastScanFeedback && (
            <div
              className={
                lastScanFeedback.type === "success"
                  ? "absolute bottom-2 inset-x-3 z-30 px-3 py-2 rounded-xl bg-emerald-600/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg animate-in fade-in slide-in-from-bottom-2"
                  : "absolute bottom-2 inset-x-3 z-30 px-3 py-2 rounded-xl bg-red-600/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg animate-in fade-in slide-in-from-bottom-2"
              }
            >
              {lastScanFeedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{lastScanFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Bottom Sheet: Live Scanned Items + Total + Review Order */}
        <div className="flex-1 min-h-0 bg-card rounded-t-3xl -mt-5 relative z-10 flex flex-col shadow-[0_-8px_24px_rgba(0,0,0,0.3)]">
          <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h2 className="text-sm font-bold text-foreground">Scanned Items</h2>
              <p className="text-[11px] text-muted-foreground">
                {cartCount} {cartCount === 1 ? "item" : "items"} total
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total Price</div>
              <div className="text-lg font-black text-[#0F3D3E]">{money.format(cartTotal)}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs font-medium">Point the camera at a barcode to add items</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {money.format(item.unitPrice)}
                      {item.variantName ? ` · ${item.variantName}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDecrementQty?.(item.key)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onIncrementQty?.(item.key)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sticky Bottom CTA */}
          {onOpenPayment && (
            <div className="shrink-0 p-3 border-t bg-card">
              <Button
                type="button"
                disabled={cart.length === 0}
                onClick={handlePay}
                className="w-full h-11 text-sm font-bold bg-[#0F3D3E] text-white hover:bg-[#0c3132] disabled:opacity-50"
              >
                Review Order {cartCount > 0 ? `(${cartCount})` : ""}
              </Button>
            </div>
          )}
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
