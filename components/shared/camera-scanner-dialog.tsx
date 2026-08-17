"use client";

import * as React from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, CheckCircle2, CreditCard, Loader2, RefreshCw, ShoppingBag, X, AlertCircle, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface ScanResult {
  success: boolean;
  name?: string;
  variantName?: string;
  price?: number;
  error?: string;
}

export interface RecentlyScannedItem {
  id: string;
  code: string;
  name: string;
  variantName?: string;
  price: number;
  timestamp: number;
  success: boolean;
}

interface CameraScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (scannedCode: string) => ScanResult | boolean;
  onOpenPayment?: () => void;
  cartCount?: number;
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
  cartCount = 0,
  title = "Scan Product Barcode",
}: CameraScannerDialogProps) {
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const containerId = "pos-camera-barcode-reader";

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [hasTorch, setHasTorch] = React.useState(false);

  // Continuous Feedback & Recently Scanned State
  const [lastScanFeedback, setLastScanFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [recentlyScanned, setRecentlyScanned] = React.useState<RecentlyScannedItem[]>([]);

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
        const price = typeof scanRes === "object" ? scanRes.price : undefined;
        const errText = typeof scanRes === "object" ? scanRes.error : undefined;

        if (isSuccess) {
          const displayName = `${itemName || code}${variantName ? ` (${variantName})` : ""}`;
          setLastScanFeedback({
            type: "success",
            message: `✓ Added: ${displayName}`,
          });

          setRecentlyScanned((prev) => [
            {
              id: `${code}-${now}`,
              code,
              name: itemName || code,
              variantName,
              price: price || 0,
              timestamp: now,
              success: true,
            },
            ...prev.slice(0, 4), // Keep last 5 scanned items in feed
          ]);
        } else {
          setLastScanFeedback({
            type: "error",
            message: errText ? `⚠ ${errText}` : `⚠ No product found for barcode: ${code}`,
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

  const handleCloseDone = () => {
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
    }

    return () => {
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) stopScanner();
        onOpenChange(val);
      }}
    >
      <DialogContent className="w-[94vw] max-w-md p-0 overflow-hidden bg-card border shadow-2xl rounded-2xl">
        {/* Header Toolbar */}
        <DialogHeader className="p-3.5 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#0F3D3E] shrink-0" />
            <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
            {cartCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold gap-1 px-1.5">
                <ShoppingBag className="h-3 w-3" /> {cartCount} items
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasTorch && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-foreground"
                onClick={toggleTorch}
              >
                {torchOn ? <ZapOff className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4" />}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCloseDone}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogDescription className="sr-only">
          Point your mobile device camera at product barcodes to continuously add them to the cart.
        </DialogDescription>

        {/* Real-time Feedback Banner */}
        {lastScanFeedback && (
          <div
            className={
              lastScanFeedback.type === "success"
                ? "mx-3 mt-3 p-2.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center justify-between shadow-xs animate-in fade-in"
                : "mx-3 mt-3 p-2.5 rounded-xl border bg-red-50 border-red-200 text-red-700 font-semibold text-xs flex items-center justify-between shadow-xs animate-in fade-in"
            }
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {lastScanFeedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span className="truncate">{lastScanFeedback.message}</span>
            </div>
            <button
              onClick={() => setLastScanFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 ml-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Viewfinder Container */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[260px] overflow-hidden my-2">
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-background/90 flex flex-col items-center justify-center p-4 space-y-3 text-center">
              <Loader2 className="h-8 w-8 text-[#0F3D3E] animate-spin" />
              <p className="text-xs font-semibold text-foreground">Starting continuous camera scanner...</p>
              <p className="text-[11px] text-muted-foreground">Please grant camera permission if prompted.</p>
            </div>
          )}

          {errorMsg ? (
            <div className="p-5 flex flex-col items-center text-center space-y-3 bg-background w-full">
              <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <CameraOff className="h-6 w-6" />
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left text-xs text-destructive w-full">
                <div className="font-bold text-xs">Camera Error</div>
                <div className="text-[11px] mt-1 text-foreground/80">{errorMsg}</div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={startScanner} className="gap-1.5 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Try Again
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCloseDone} className="text-xs">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* HTML5 QR Code Mount Element */}
              <div id={containerId} className="w-full h-full min-h-[260px]" />

              {/* Scanning Laser Line Overlay */}
              {!isLoading && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4 z-10">
                  <div className="relative w-64 h-36 border-2 border-[#0F3D3E] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-bounce" />
                  </div>
                  <p className="text-white text-xs font-medium mt-3 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                    Continuous Scanner Active — Align Barcode
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Recently Scanned Feed Section */}
        {recentlyScanned.length > 0 && (
          <div className="px-3 py-2 bg-muted/20 border-t space-y-1 text-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Recently Scanned ({recentlyScanned.length})
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {recentlyScanned.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-card border shadow-2xs"
                >
                  <div className="truncate pr-2 font-medium">
                    {item.name} {item.variantName ? `(${item.variantName})` : ""}
                  </div>
                  <div className="font-mono text-emerald-700 font-bold shrink-0">
                    {money.format(item.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Action Footer Bar: Done & Pay */}
        <div className="p-3 border-t bg-card flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCloseDone}
            className="flex-1 h-9 text-xs font-semibold"
          >
            Done
          </Button>

          {onOpenPayment && (
            <Button
              type="button"
              onClick={handlePay}
              className="flex-1 h-9 text-xs font-bold bg-[#0F3D3E] text-white hover:bg-[#0c3132] gap-1.5"
            >
              <CreditCard className="h-3.5 w-3.5" /> Pay Now {cartCount > 0 ? `(${cartCount})` : ""}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
