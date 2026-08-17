"use client";

import * as React from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, Loader2, RefreshCw, X, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CameraScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (scannedCode: string) => void;
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

export function CameraScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan Product Barcode",
}: CameraScannerDialogProps) {
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const containerId = "pos-camera-barcode-reader";

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [hasTorch, setHasTorch] = React.useState(false);

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

      const onScanSuccess = (decodedText: string) => {
        if (!decodedText) return;

        // Haptic feedback if supported on mobile
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(80);
          } catch {
            // ignore
          }
        }

        stopScanner();
        onOpenChange(false);
        onScan(decodedText.trim());
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
  }, [containerId, onOpenChange, onScan, stopScanner]);

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
      <DialogContent className="w-[92vw] max-w-md p-0 overflow-hidden bg-card border shadow-2xl rounded-2xl">
        <DialogHeader className="p-3.5 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
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
              onClick={() => {
                stopScanner();
                onOpenChange(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogDescription className="sr-only">
          Point your mobile device camera at a product barcode or QR code to scan and add it to the cart.
        </DialogDescription>

        <div className="relative bg-black flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-background/90 flex flex-col items-center justify-center p-4 space-y-3 text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-xs font-semibold text-foreground">Starting camera scanner...</p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    stopScanner();
                    onOpenChange(false);
                  }}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* HTML5 QR Code Mount Element */}
              <div id={containerId} className="w-full h-full min-h-[300px]" />

              {/* Scanning Laser Line Overlay */}
              {!isLoading && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4 z-10">
                  <div className="relative w-64 h-40 border-2 border-primary/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-bounce" />
                  </div>
                  <p className="text-white text-xs font-medium mt-4 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    Position barcode inside the box
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 border-t bg-muted/20 text-center text-[11px] text-muted-foreground">
          Supports EAN-13, CODE-128, CODE-39, UPC, and QR Codes.
        </div>
      </DialogContent>
    </Dialog>
  );
}
