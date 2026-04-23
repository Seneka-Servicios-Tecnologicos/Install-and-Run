import { useEffect, useRef, useState } from "react";
import { Camera, Video, X, RotateCcw, CircleStop, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CameraCaptureProps {
  mode: "photo" | "video";
  onCapture: (blob: Blob, mime: string) => void;
  onClose: () => void;
}

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: { ideal: "environment" },
};

export function CameraCapture({ mode, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function start() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { ...VIDEO_CONSTRAINTS, facingMode: { ideal: facing } },
          audio: mode === "video",
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        toast.error("No se pudo acceder a la cámara. Verifica permisos.");
        console.error(err);
        onClose();
      }
    }
    start();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, mode, onClose]);

  useEffect(() => {
    if (!recording) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [recording]);

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, "image/jpeg");
      },
      "image/jpeg",
      0.85,
    );
  };

  const startRecord = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: mime || undefined,
        videoBitsPerSecond: 1_000_000, // ~1 Mbps agresivo
        audioBitsPerSecond: 64_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
        onCapture(blob, blob.type);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
    } catch (err) {
      toast.error("No se pudo iniciar la grabación");
      console.error(err);
    }
  };

  const stopRecord = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 text-sm">
          {mode === "video" && recording && (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => setFacing(facing === "environment" ? "user" : "environment")}
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="max-h-full max-w-full"
        />
      </div>

      <div className="p-6 flex items-center justify-center gap-6">
        {mode === "photo" ? (
          <button
            type="button"
            onClick={takePhoto}
            aria-label="Tomar foto"
            className="h-16 w-16 rounded-full bg-white border-4 border-white/40 active:scale-95 transition flex items-center justify-center"
          >
            <Camera className="h-6 w-6 text-black" />
          </button>
        ) : recording ? (
          <button
            type="button"
            onClick={stopRecord}
            aria-label="Detener"
            className="h-16 w-16 rounded-full bg-red-600 border-4 border-white/40 active:scale-95 transition flex items-center justify-center"
          >
            <CircleStop className="h-7 w-7 text-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecord}
            aria-label="Grabar video"
            className="h-16 w-16 rounded-full bg-red-500 border-4 border-white/40 active:scale-95 transition flex items-center justify-center"
          >
            <Circle className="h-6 w-6 text-white" fill="white" />
          </button>
        )}
      </div>

      <div className="text-center text-white/60 text-xs pb-4">
        {mode === "photo" ? "Toca el botón para capturar" : recording ? "Grabando..." : "Toca para iniciar grabación"}
        <Video className="hidden" />
      </div>
    </div>
  );
}
