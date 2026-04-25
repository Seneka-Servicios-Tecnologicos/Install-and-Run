import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, FileText, Video, LayoutGrid, List, CheckCircle2, RotateCcw, Lock, Globe, Building2, Trash2, GitCommitVertical } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FabMenu } from "@/components/fab-menu";
import { CameraCapture } from "@/components/camera-capture";
import { EntryDialog } from "@/components/entry-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatDateGroup, formatRelative, formatTime } from "@/lib/format";
import { getSignedUrl, deleteMedia } from "@/lib/storage";
import { format, startOfDay } from "date-fns";

export const Route = createFileRoute("/proyecto/$id")({
  head: () => ({
    meta: [{ title: "Proyecto — Report & Run" }],
  }),
  component: ProjectView,
});

interface Entry {
  id: string;
  type: "photo" | "video" | "note";
  title: string | null;
  description: string | null;
  thumbnail_path: string | null;
  media_path: string | null;
  captured_at: string;
  user_id: string;
}
interface Project {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  status: string;
  visibility: string;
  user_id: string;
  client_id: string | null;
  created_at: string;
}
interface ClientLite { id: string; name: string }
interface ProfileLite { id: string; full_name: string | null; email: string | null }

function ProjectView() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<ClientLite | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [authors, setAuthors] = useState<Record<string, ProfileLite>>({});
  const [view, setView] = useState<"timeline" | "lista">("timeline");

  // capture state
  const [cameraMode, setCameraMode] = useState<"photo" | "video" | null>(null);
  const [draft, setDraft] = useState<{ type: "photo" | "video" | "note"; blob?: Blob; mime?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!p) {
      toast.error("Proyecto no encontrado");
      navigate({ to: "/" });
      return;
    }
    setProject(p as Project);

    if (p.client_id) {
      const { data: c } = await supabase.from("clients").select("id, name").eq("id", p.client_id).maybeSingle();
      if (c) setClient(c as ClientLite);
    } else {
      setClient(null);
    }

    const { data: e } = await supabase
      .from("entries")
      .select("id, type, title, description, thumbnail_path, media_path, captured_at, user_id")
      .eq("project_id", id)
      .order("captured_at", { ascending: false });

    const list = (e ?? []) as Entry[];
    setEntries(list);

    const map: Record<string, string> = {};
    await Promise.all(
      list.map(async (en) => {
        if (en.thumbnail_path) {
          const url = await getSignedUrl(en.thumbnail_path);
          if (url) map[en.id] = url;
        }
      }),
    );
    setThumbs(map);

    // load authors for public projects (or just current)
    const userIds = Array.from(new Set(list.map((x) => x.user_id)));
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const am: Record<string, ProfileLite> = {};
      for (const pr of profs ?? []) am[pr.id] = pr as ProfileLite;
      setAuthors(am);
    }
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const grouped = useMemo(() => {
    const groups: { date: Date; key: string; items: Entry[] }[] = [];
    const map = new Map<string, { date: Date; items: Entry[] }>();
    for (const e of entries) {
      const d = startOfDay(new Date(e.captured_at));
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key)!.items.push(e);
    }
    for (const [key, val] of map) groups.push({ date: val.date, key, items: val.items });
    return groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [entries]);

  const isOwner = !!project && project.user_id === user?.id;

  const toggleStatus = async () => {
    if (!project) return;
    const next = project.status === "activo" ? "finalizado" : "activo";
    const { error } = await supabase
      .from("projects")
      .update({ status: next })
      .eq("id", project.id);
    if (error) {
      toast.error("Error al actualizar");
      return;
    }
    setProject({ ...project, status: next });
    toast.success(next === "finalizado" ? "Proyecto finalizado" : "Proyecto reabierto");
  };

  const toggleVisibility = async () => {
    if (!project) return;
    const next = project.visibility === "public" ? "private" : "public";
    const { error } = await supabase
      .from("projects")
      .update({ visibility: next })
      .eq("id", project.id);
    if (error) {
      toast.error("Error al cambiar visibilidad");
      return;
    }
    setProject({ ...project, visibility: next });
    toast.success(next === "public" ? "Ahora es público para todo el equipo" : "Ahora es privado");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setDraft({ type: isVideo ? "video" : "photo", blob: file, mime: file.type });
  };

  if (loading || !user || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title={project.name} />

      <main className="mx-auto max-w-5xl px-4 py-6 pb-32">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div className="min-w-0">
            <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Proyectos
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge variant={project.status === "activo" ? "default" : "secondary"}>
                {project.status === "activo" ? "Activo" : "Finalizado"}
              </Badge>
              <Badge variant="outline" className="gap-1">
                {project.visibility === "public" ? (
                  <><Globe className="h-3 w-3" /> Público</>
                ) : (
                  <><Lock className="h-3 w-3" /> Privado</>
                )}
              </Badge>
            </div>
            {client && (
              <Link
                to="/cliente/$id"
                params={{ id: client.id }}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
              >
                <Building2 className="h-3.5 w-3.5" /> {client.name}
              </Link>
            )}
            {project.location && (
              <p className="text-sm text-muted-foreground mt-1">{project.location}</p>
            )}
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="timeline" className="gap-1.5">
                  <LayoutGrid className="h-4 w-4" /> Timeline
                </TabsTrigger>
                <TabsTrigger value="lista" className="gap-1.5">
                  <List className="h-4 w-4" /> Lista
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={toggleVisibility} className="gap-1.5">
                  {project.visibility === "public" ? (
                    <><Lock className="h-4 w-4" /> Hacer privado</>
                  ) : (
                    <><Globe className="h-4 w-4" /> Hacer público</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={toggleStatus} className="gap-1.5">
                  {project.status === "activo" ? (
                    <><CheckCircle2 className="h-4 w-4" /> Finalizar</>
                  ) : (
                    <><RotateCcw className="h-4 w-4" /> Reabrir</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {entries.length === 0 ? (
          <Card className="p-12 text-center">
            <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Aún no hay entradas. Toca el botón <span className="font-medium text-foreground">+</span> para añadir la primera.
            </p>
          </Card>
        ) : view === "timeline" ? (
          <div className="space-y-8">
            {grouped.map((g) => (
              <section key={g.key}>
                <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b mb-4">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {formatDateGroup(g.date)}
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {g.items.map((e) => (
                    <EntryCard
                      key={e.id}
                      entry={e}
                      thumb={thumbs[e.id]}
                      projectId={project.id}
                      author={authors[e.user_id]}
                      isPublic={project.visibility === "public"}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Hora</th>
                  <th className="text-left px-4 py-2 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2 font-medium">Título</th>
                  {project.visibility === "public" && (
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Autor</th>
                  )}
                  <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Notas</th>
                  <th className="text-right px-4 py-2 font-medium">Vista</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate({ to: "/proyecto/$id/entrada/$entradaId", params: { id: project.id, entradaId: e.id } })}
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                      {format(new Date(e.captured_at), "dd/MM HH:mm")}
                    </td>
                    <td className="px-4 py-2"><TypeIcon type={e.type} /></td>
                    <td className="px-4 py-2 font-medium truncate max-w-[200px]">{e.title || "—"}</td>
                    {project.visibility === "public" && (
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-[150px] hidden md:table-cell">
                        {authors[e.user_id]?.full_name || authors[e.user_id]?.email || "—"}
                      </td>
                    )}
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[300px] hidden sm:table-cell">
                      {e.description || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {thumbs[e.id] && (
                        <img src={thumbs[e.id]} alt="" className="inline-block h-8 w-8 rounded object-cover" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFile}
      />

      <FabMenu
        onPickPhoto={() => setCameraMode("photo")}
        onPickVideo={() => setCameraMode("video")}
        onPickFile={() => fileInputRef.current?.click()}
        onPickNote={() => setDraft({ type: "note" })}
      />

      {cameraMode && (
        <CameraCapture
          mode={cameraMode}
          onClose={() => setCameraMode(null)}
          onCapture={(blob, mime) => {
            setCameraMode(null);
            setDraft({ type: cameraMode, blob, mime });
          }}
        />
      )}

      <EntryDialog
        open={!!draft}
        draft={draft}
        projectId={project.id}
        userId={user.id}
        onClose={() => setDraft(null)}
        onSaved={load}
      />
    </div>
  );
}

function TypeIcon({ type }: { type: Entry["type"] }) {
  const Icon = type === "photo" ? Camera : type === "video" ? Video : FileText;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

function EntryCard({
  entry,
  thumb,
  projectId,
  author,
  isPublic,
}: {
  entry: Entry;
  thumb?: string;
  projectId: string;
  author?: ProfileLite;
  isPublic?: boolean;
}) {
  return (
    <Link
      to="/proyecto/$id/entrada/$entradaId"
      params={{ id: projectId, entradaId: entry.id }}
      className="group"
    >
      <Card className="overflow-hidden p-0 gap-0 transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="aspect-square bg-muted relative overflow-hidden">
          {thumb ? (
            <img src={thumb} alt={entry.title ?? ""} className="w-full h-full object-cover" loading="lazy" />
          ) : entry.type === "note" ? (
            <div className="w-full h-full p-3 text-xs text-muted-foreground line-clamp-6 bg-accent/30">
              {entry.description || entry.title || "Nota"}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <TypeIcon type={entry.type} />
            </div>
          )}
          <div className="absolute top-1.5 left-1.5 bg-background/80 backdrop-blur rounded-md p-1">
            <TypeIcon type={entry.type} />
          </div>
        </div>
        <div className="p-2.5">
          <p className="text-xs font-medium truncate group-hover:text-primary">
            {entry.title || (entry.type === "note" ? "Nota" : entry.type === "photo" ? "Foto" : "Video")}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {formatTime(entry.captured_at)} · {formatRelative(entry.captured_at)}
          </p>
          {isPublic && author && (
            <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
              por {author.full_name || author.email}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
