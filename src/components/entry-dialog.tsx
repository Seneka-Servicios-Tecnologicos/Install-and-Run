import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { compressImage, processVideo, type CompressedFile } from "@/lib/compress";
import { uploadMedia } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";

interface EntryDraft {
  type: "photo" | "video" | "note";
  blob?: Blob;
  mime?: string;
}

interface EntryDialogProps {
  open: boolean;
  draft: EntryDraft | null;
  projectId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function nowLocalInputValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
}

export function EntryDialog({ open, draft, projectId, userId, onClose, onSaved }: EntryDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [compressed, setCompressed] = useState<CompressedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoTime, setAutoTime] = useState(true);
  const [manualTime, setManualTime] = useState<string>(nowLocalInputValue());

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setCompressed(null);
    setPreviewUrl(null);
    setAutoTime(true);
    setManualTime(nowLocalInputValue());
    if (!draft?.blob) return;

    const url = URL.createObjectURL(draft.blob);
    setPreviewUrl(url);

    (async () => {
      setProcessing(true);
      try {
        if (draft.type === "photo") {
          setCompressed(await compressImage(draft.blob!));
        } else if (draft.type === "video") {
          setCompressed(await processVideo(draft.blob!));
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al procesar el archivo");
      } finally {
        setProcessing(false);
      }
    })();

    return () => URL.revokeObjectURL(url);
  }, [open, draft]);

  const handleSave = async () => {
    if (!draft) return;
    if (draft.type === "note" && !description.trim() && !title.trim()) {
      toast.error("Escribe un título o contenido para la nota");
      return;
    }
    setSaving(true);
    try {
      let mediaPath: string | null = null;
      let thumbPath: string | null = null;
      let originalSize: number | null = null;
      let compressedSize: number | null = null;

      if (draft.type !== "note") {
        if (!compressed) {
          toast.error("Procesa el archivo antes de guardar");
          setSaving(false);
          return;
        }
        mediaPath = await uploadMedia(
          userId,
          projectId,
          compressed.file,
          compressed.extension,
          compressed.mimeType,
        );
        thumbPath = await uploadMedia(
          userId,
          projectId,
          compressed.thumbnail,
          "jpg",
          "image/jpeg",
        );
        originalSize = compressed.originalSize;
        compressedSize = compressed.compressedSize;
      }

      const captured = autoTime ? new Date().toISOString() : new Date(manualTime).toISOString();

      const { error } = await supabase.from("entries").insert({
        project_id: projectId,
        user_id: userId,
        type: draft.type,
        title: title || null,
        description: description || null,
        media_path: mediaPath,
        thumbnail_path: thumbPath,
        original_size: originalSize,
        compressed_size: compressedSize,
        captured_at: captured,
      });
      if (error) throw error;

      toast.success("Entrada guardada");
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la entrada");
    } finally {
      setSaving(false);
    }
  };

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {draft.type === "photo" && "Nueva foto"}
            {draft.type === "video" && "Nuevo video"}
            {draft.type === "note" && "Nueva nota"}
          </DialogTitle>
        </DialogHeader>

        {draft.type !== "note" && previewUrl && (
          <div className="rounded-lg overflow-hidden bg-muted aspect-video">
            {draft.type === "photo" ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <video src={previewUrl} controls className="w-full h-full" />
            )}
          </div>
        )}

        {draft.type !== "note" && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {processing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Comprimiendo...
              </>
            ) : compressed ? (
              <>
                <span>Original: {formatBytes(compressed.originalSize)}</span>
                <span>→</span>
                <span className="text-foreground font-medium">
                  Final: {formatBytes(compressed.compressedSize)}
                </span>
              </>
            ) : null}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="e-title">Título</Label>
            <Input
              id="e-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Patch panel piso 3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-desc">
              {draft.type === "note" ? "Contenido de la nota *" : "Notas / descripción"}
            </Label>
            <Textarea
              id="e-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={draft.type === "note" ? 6 : 3}
              placeholder={draft.type === "note"
                ? "Escribe aquí el detalle de tu nota..."
                : "Detalles del avance, observaciones, materiales..."
              }
            />
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="e-auto" className="cursor-pointer">Hora automática</Label>
                <p className="text-xs text-muted-foreground">
                  {autoTime ? "Se guarda con la fecha y hora actuales." : "Define manualmente cuándo ocurrió."}
                </p>
              </div>
              <Switch id="e-auto" checked={autoTime} onCheckedChange={setAutoTime} />
            </div>
            {!autoTime && (
              <div className="space-y-2">
                <Label htmlFor="e-time">Fecha y hora</Label>
                <Input
                  id="e-time"
                  type="datetime-local"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || processing || (draft.type !== "note" && !compressed)}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
