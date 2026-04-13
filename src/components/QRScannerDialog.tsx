import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, X, CheckCircle2, XCircle, FlipHorizontal2 } from "lucide-react";
import { useWakeLock } from "@/hooks/useFullscreen";

export type ScanResult = {
  success: boolean;
  message: string;
  studentName?: string;
};

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (decodedText: string) => Promise<ScanResult>;
  title?: string;
  description?: string;
}

const QR_READER_ID = "qr-reader-container";

const playSuccessBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1600, ctx.currentTime + 0.08);
    oscillator.frequency.setValueAtTime(2000, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore
  }
};

const playErrorBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(400, ctx.currentTime);
    oscillator.frequency.setValueAtTime(300, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore
  }
};

const QRScannerDialog = ({
  open,
  onOpenChange,
  onScan,
  title = "Scan QR Siswa",
  description = "Arahkan kamera ke QR Code pada kartu pelajar",
}: QRScannerDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<ScanResult | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [switching, setSwitching] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastScannedCodeRef = useRef("");
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const facingModeRef = useRef(facingMode);
  facingModeRef.current = facingMode;

  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

  const showOverlay = (result: ScanResult) => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    setOverlay(result);
    overlayTimerRef.current = setTimeout(() => setOverlay(null), 1500);
  };

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  }, []);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const startScanner = useCallback(async (facing: "environment" | "user") => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setError(null);

    try {
      await stopScanner();
      await new Promise((r) => setTimeout(r, 300));

      const el = document.getElementById(QR_READER_ID);
      if (!el) {
        isStartingRef.current = false;
        return;
      }

      const scanner = new Html5Qrcode(QR_READER_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: facing },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 4 / 3,
          disableFlip: false,
          videoConstraints: {
            facingMode: facing,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        },
        async (decodedText) => {
          const now = Date.now();
          if (
            decodedText === lastScannedCodeRef.current &&
            now - lastScanTimeRef.current < 2000
          ) {
            return;
          }
          if (processingRef.current) return;

          lastScannedCodeRef.current = decodedText;
          lastScanTimeRef.current = now;
          processingRef.current = true;

          try {
            const result = await onScanRef.current(decodedText);
            if (result.success) {
              playSuccessBeep();
              setScanCount((c) => c + 1);
              setLastScanned(result.studentName || decodedText);
            } else {
              playErrorBeep();
            }
            showOverlay(result);
          } catch {
            playErrorBeep();
            showOverlay({ success: false, message: "Terjadi kesalahan" });
          } finally {
            processingRef.current = false;
          }
        },
        () => {}
      );
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setError("Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.");
      } else if (facing === "user") {
        setError("Kamera depan tidak tersedia di perangkat ini.");
      } else {
        setError("Gagal membuka kamera: " + (err?.message || "Unknown error"));
      }
    } finally {
      isStartingRef.current = false;
      setSwitching(false);
    }
  }, [stopScanner]);

  const switchCamera = async () => {
    if (switching || isStartingRef.current) return;
    setSwitching(true);
    const next = facingModeRef.current === "environment" ? "user" : "environment";
    setFacingMode(next);
    lastScannedCodeRef.current = "";
    processingRef.current = false;
    await startScanner(next);
  };

  useEffect(() => {
    if (open) {
      setScanCount(0);
      setLastScanned(null);
      setOverlay(null);
      setFacingMode("environment");
      lastScannedCodeRef.current = "";
      processingRef.current = false;
      startScanner("environment");
      requestWakeLock();
    } else {
      stopScanner();
      releaseWakeLock();
    }
    return () => {
      stopScanner();
      releaseWakeLock();
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    stopScanner();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) stopScanner();
      onOpenChange(v);
    }}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg rounded-2xl p-0 overflow-hidden max-h-[95dvh] flex flex-col">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Camera className="h-4 w-4" />
              {title}
            </DialogTitle>
            {/* Tombol ganti kamera */}
            <button
              onClick={switchCamera}
              disabled={switching}
              title={facingMode === "environment" ? "Ganti ke kamera depan" : "Ganti ke kamera belakang"}
              className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-2.5 py-1 hover:bg-primary/10 disabled:opacity-50 transition-colors"
            >
              <FlipHorizontal2 className={`h-3.5 w-3.5 ${switching ? "animate-spin" : ""}`} />
              {switching ? "Ganti..." : facingMode === "environment" ? "Depan" : "Belakang"}
            </button>
          </div>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4 flex-1 overflow-y-auto min-h-0">
          {overlay && (
            <div className="mb-2">
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 shadow-lg ${
                  overlay.success
                    ? "bg-emerald-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {overlay.success ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                ) : (
                  <XCircle className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                )}
                <div className="min-w-0">
                  <span className="text-sm font-bold block leading-tight truncate">
                    {overlay.message}
                  </span>
                  {overlay.studentName && (
                    <span className="text-xs opacity-90 truncate block">{overlay.studentName}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            id={QR_READER_ID}
            className="w-full rounded-xl overflow-hidden bg-black"
            style={{ height: "clamp(220px, 55vw, 420px)" }}
          />

          {scanCount > 0 && (
            <div className="mt-2 flex items-center justify-between text-xs bg-emerald-500/10 text-emerald-700 rounded-lg px-3 py-2">
              <span>✅ Terakhir: {lastScanned}</span>
              <Badge className="bg-emerald-500 text-white text-[10px] px-1.5">{scanCount} scan</Badge>
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-destructive text-center bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={handleClose}
            data-testid="button-close-scanner"
          >
            <X className="h-4 w-4 mr-1" /> Tutup Kamera
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRScannerDialog;
