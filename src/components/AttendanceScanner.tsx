import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, QrCode, Check, AlertCircle, Camera } from "lucide-react";

// The secret token baked into the generated attendance QR code
export const ATTENDANCE_TOKEN = "singh-fitness-gym-attend-v1";

interface AttendanceScannerProps {
  onSuccess: () => void;
  onExpired: () => void;
  onClose: () => void;
  memberStatus: string;
}

type ScanState = "idle" | "starting" | "scanning" | "success" | "expired" | "error";

export default function AttendanceScanner({
  onSuccess,
  onExpired,
  onClose,
  memberStatus,
}: AttendanceScannerProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);

  const stopScanner = async () => {
    if (scannerRef.current && scannerStarted.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (_) {
        // ignore errors on stop
      }
      scannerStarted.current = false;
    }
  };

  const startScanner = async () => {
    setScanState("starting");
    setErrorMsg("");

    const qr = new Html5Qrcode("qr-reader-container");
    scannerRef.current = qr;

    try {
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          await stopScanner();

          if (decodedText === ATTENDANCE_TOKEN) {
            if (memberStatus === "Expired") {
              setScanState("expired");
              onExpired();
            } else {
              setScanState("success");
              onSuccess();
            }
          } else {
            setScanState("error");
            setErrorMsg("Invalid QR Code. Please scan the official Singh Fitness Gym code.");
          }
        },
        () => {}
      );
      scannerStarted.current = true;
      setScanState("scanning");
    } catch (err: unknown) {
      setScanState("error");
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setErrorMsg("Camera permission denied. Please allow camera access in your browser settings.");
        } else {
          setErrorMsg(err.message || "Failed to start camera.");
        }
      } else {
        setErrorMsg("Failed to start camera. Ensure camera is available.");
      }
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleRetry = async () => {
    await stopScanner();
    setScanState("idle");
    setErrorMsg("");
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 z-[60] animate-fadeIn">
      <div className="bg-neutral-950 border border-white/10 rounded-[32px] p-6 max-w-sm w-full text-center relative shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white cursor-pointer"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-black uppercase tracking-tight text-white mb-1">
          Attendance QR Scanner
        </h3>
        <p className="text-xs text-white/40 uppercase tracking-widest font-black mb-5">
          Point camera at the gym entrance QR code
        </p>

        <div className="w-64 h-64 mx-auto rounded-3xl bg-[#090909] border border-white/5 relative overflow-hidden flex items-center justify-center mb-5">
          <div
            id="qr-reader-container"
            className={`w-full h-full ${scanState === "scanning" || scanState === "starting" ? "block" : "hidden"}`}
            style={{ borderRadius: "24px", overflow: "hidden" }}
          />

          {scanState === "idle" && (
            <div className="text-center space-y-3 relative z-10 px-4">
              <div className="w-16 h-16 bg-yellow-400/10 border border-yellow-400/30 rounded-full flex items-center justify-center mx-auto">
                <Camera size={28} className="text-yellow-400" />
              </div>
              <p className="text-xs font-bold text-white/60">Tap below to activate camera</p>
            </div>
          )}

          {scanState === "starting" && (
            <div className="text-center space-y-3 relative z-10">
              <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-yellow-400/95 uppercase tracking-wider animate-pulse">Starting camera...</p>
            </div>
          )}

          {scanState === "success" && (
            <div className="text-center space-y-2 relative z-10">
              <div className="w-14 h-14 bg-green-500/20 border border-green-500 rounded-full flex items-center justify-center text-green-400 mx-auto">
                <Check size={28} strokeWidth={3} />
              </div>
              <p className="text-xs font-black text-green-400 uppercase tracking-wider">Attendance Marked!</p>
              <p className="text-[10px] text-white/40">Streak +1 · Points +100</p>
            </div>
          )}

          {scanState === "expired" && (
            <div className="text-center space-y-2 relative z-10 px-4">
              <div className="w-14 h-14 bg-red-500/20 border border-red-500 rounded-full flex items-center justify-center text-red-400 mx-auto">
                <X size={28} strokeWidth={3} />
              </div>
              <p className="text-xs font-black text-red-400 uppercase tracking-wider">Access Denied</p>
              <p className="text-[10px] text-white/40">Membership Expired</p>
            </div>
          )}

          {scanState === "error" && (
            <div className="text-center space-y-2 relative z-10 px-4">
              <div className="w-14 h-14 bg-orange-500/20 border border-orange-500 rounded-full flex items-center justify-center text-orange-400 mx-auto">
                <AlertCircle size={24} />
              </div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-wider">Scanner Error</p>
              <p className="text-[9px] text-white/50 leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {scanState === "scanning" && (
            <>
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-yellow-400 rounded-tl-lg pointer-events-none" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-yellow-400 rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-yellow-400 rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-yellow-400 rounded-br-lg pointer-events-none" />
              <div className="absolute left-0 right-0 h-0.5 bg-yellow-400 shadow-[0_0_8px_#facc15] animate-laser pointer-events-none" />
            </>
          )}
        </div>

        <div className="space-y-3">
          {scanState === "idle" && (
            <button
              onClick={startScanner}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_4px_12px_rgba(250,204,21,0.2)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode size={16} />
              Activate Camera Scanner
            </button>
          )}
          {scanState === "error" && (
            <button onClick={handleRetry} className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer">
              Retry
            </button>
          )}
          {(scanState === "success" || scanState === "expired") && (
            <button onClick={handleClose} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer">
              Close
            </button>
          )}
          {scanState !== "success" && scanState !== "expired" && (
            <button onClick={handleClose} className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
