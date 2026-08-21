"use client";

import * as React from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { CameraOff, Loader2, RefreshCw, X, Zap, ZapOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const containerId = "product-camera-barcode-reader";

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [hasTorch, setHasTorch] = React.useState(false);
  const [scannedCode, setScannedCode] = React.useState<string | null>(null);
  const isLockedRef = React.useRef(false);

  const stopScanner = React.useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      } finally {
        scannerRef.current = null;
      }
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const startScanner = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setScannedCode(null);
    isLockedRef.current = false;

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
        fps: 15,
        qrbox: qrboxFunction,
        aspectRatio: 1.333333,
      };

      const onScanSuccess = async (decodedText: string) => {
        if (!decodedText || isLockedRef.current) return;
        const code = decodedText.trim();
        if (!code) return;

        // Prevent duplicate detection events
        isLockedRef.current = true;
        setScannedCode(code);

        // Haptic feedback if supported
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(80);
          } catch {
            // Ignore
          }
        }

        // Wait a short moment to show confirmation then trigger callback
        await new Promise((r) => setTimeout(r, 600));

        // Stop camera tracks and clean up scanner
        await stopScanner();
        onOpenChange(false);
        onScan(code);
      };

      try {
        await html5Qrcode.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          () => {}
        );
      } catch {
        // Fallback to front/user camera
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
        const capabilities = html5Qrcode.getRunningTrackCapabilities?.() as unknown as Record<string, unknown>;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch {
        // Ignore
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
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
  }, [containerId, onScan, stopScanner, onOpenChange]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch {
      // Ignore
    }
  };

  const handleClose = () => {
    stopScanner();
    onOpenChange(false);
  };

  React.useEffect(() => {
    let active = true;
    if (open) {
      const timer = setTimeout(() => {
        if (active) {
          startScanner();
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
        setTimeout(() => {
          stopScanner();
        }, 0);
      };
    } else {
      const timer = setTimeout(() => {
        if (active) {
          stopScanner();
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [open, startScanner, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-md p-6 flex flex-col gap-4 overflow-hidden rounded-xl border bg-card shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b">
          <DialogTitle className="text-lg font-semibold">Scan Product Barcode</DialogTitle>
          <Button variant="ghost" size="icon-sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <DialogDescription className="sr-only">
          Point your camera at a barcode to scan it.
        </DialogDescription>

        <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-black border border-border">
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
              {!isLoading && !scannedCode && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-48 h-32">
                    <span className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-md" />
                    <span className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-md" />
                    <span className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-md" />
                    <span className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-md" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Flashlight button */}
          {hasTorch && !isLoading && !errorMsg && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 z-30 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              onClick={toggleTorch}
            >
              {torchOn ? <ZapOff className="h-4 w-4 text-amber-400" /> : <Zap className="h-4 w-4" />}
            </Button>
          )}

          {/* Scanned code feedback */}
          {scannedCode && (
            <div className="absolute inset-0 z-20 bg-emerald-950/95 flex flex-col items-center justify-center p-4 space-y-2 text-center animate-in fade-in zoom-in-95">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-bounce" />
              <p className="text-sm font-semibold text-white">Barcode Detected</p>
              <code className="text-xs bg-black/40 text-emerald-200 px-3 py-1 rounded-md font-mono">{scannedCode}</code>
              <p className="text-[11px] text-emerald-300/80">Opening Add Product...</p>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground py-1">
          {scannedCode ? "Processing..." : "Point your camera at a barcode to scan it automatically."}
        </div>

        <div className="-mx-6 -mb-6 mt-2 flex justify-end gap-2 border-t bg-muted/30 p-4">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
