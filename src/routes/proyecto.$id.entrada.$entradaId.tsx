import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2, Save, Camera, Video, FileText } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getSignedUrl, deleteMedia } from "@/lib/storage";

export const Route = createFileRoute("/proyecto/$id/entrada/$entradaId")({
  head: () => ({
    meta: [{ title: "Entrada — Report & Run" }],
  }),
  component: EntryDetail,
});

interface Entry {
  id: string;
  project_id: string;
  type: "photo" | "video" | "note";
  title: string | null;
  description: string | null;
  media_path: string | null;
  thumbnail_path: string | null;
  original_size: number | null;
  compressed_size: number | null;
  captured_at: string;
  created_at: string;
}

function EntryDetail() {
  const { id, entradaId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("id", entradaId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Entrada no encontrada");
        navigate({ to: "/proyecto/$id", params: { id } });
        return;
      }
      const en = data as Entry;
      setEntry(en);
      setTitle(en.title || "");
      setDescription(en.description || "");
      if (en.media_path) {
        const url = await getSignedUrl(en.media_path, 7200);
        setMediaUrl(url);
      }
    })();
  }, [user, entradaId, id, navigate]);

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    const { error } = await supabase
      .from("entries")
      .update({ title: title || null, description: description || null })
      .eq("id", entry.id);
    setSaving(false);
    if (error) {
      toast.error("Error al guardar");
      return;
    }
    toast.success("Cambios guardados");
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!confirm("¿Eliminar esta entrada? Esta acción no se puede deshacer.")) return;
    const paths = [entry.media_path, entry.thumbnail_path].filter(Boolean) as string[];
    await deleteMedia(paths);
    const { error } = await supabase.from("entries").delete().eq("id", entry.id);
    if (error) {
      toast.error("Error al eliminar");
      return;
    }
    toast.success("Entrada eliminada");
    navigate({ to: "/proyecto/$id", params: { id } });
  };

  if (loading || !user || !entry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  const Icon = entry.type === "photo" ? Camera : entry.type === "video" ? Video : FileText;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6 pb-12">
        <Link
          to="/proyecto/$id"
          params={{ id }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver al proyecto
        </Link>

        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">
            {entry.title || (entry.type === "note" ? "Nota" : entry.type === "photo" ? "Foto" : "Video")}
          </h1>
        </div>

        {entry.type === "photo" && mediaUrl && (
          <div className="rounded-lg overflow-hidden bg-muted mb-6">
            <img src={mediaUrl} alt={entry.title ?? ""} className="w-full h-auto" />
          </div>
        )}
        {entry.type === "video" && mediaUrl && (
          <div className="rounded-lg overflow-hidden bg-black mb-6">
            <video src={mediaUrl} controls className="w-full h-auto" />
          </div>
        )}

        <Card className="p-5 mb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ed-title">Título</Label>
            <Input
              id="ed-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-desc">Descripción / notas</Label>
            <Textarea
              id="ed-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="destructive" onClick={handleDelete} className="gap-1.5">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">Metadatos</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Capturado</dt>
              <dd>{formatDateTime(entry.captured_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Creado en sistema</dt>
              <dd>{formatDateTime(entry.created_at)}</dd>
            </div>
            {entry.original_size != null && (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tamaño original</dt>
                  <dd>{formatBytes(entry.original_size)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tamaño comprimido</dt>
                  <dd className="font-medium">{formatBytes(entry.compressed_size)}</dd>
                </div>
              </>
            )}
          </dl>
        </Card>
      </main>
    </div>
  );
}
