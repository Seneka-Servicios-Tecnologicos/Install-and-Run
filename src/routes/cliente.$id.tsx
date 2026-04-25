import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, FolderOpen, LayoutGrid, List, Camera, Video, FileText, Lock, Globe, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatDateGroup, formatRelative, formatTime } from "@/lib/format";
import { getSignedUrl } from "@/lib/storage";
import { format, startOfDay } from "date-fns";

export const Route = createFileRoute("/cliente/$id")({
  head: () => ({
    meta: [{ title: "Cliente — Install & Report" }],
  }),
  component: ClientView,
});

interface Client {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  created_by: string;
}
interface ProjectWithEntries {
  id: string;
  name: string;
  location: string | null;
  status: string;
  visibility: string;
  created_at: string;
  user_id: string;
  entries: EntryPreview[];
}
interface EntryPreview {
  id: string;
  type: "photo" | "video" | "note";
  title: string | null;
  description: string | null;
  thumbnail_path: string | null;
  captured_at: string;
  user_id: string;
}

function ClientView() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<ProjectWithEntries[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [view, setView] = useState<"timeline" | "lista">("timeline");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: c } = await supabase
        .from("clients")
        .select("id, name, contact, notes, created_by")
        .eq("id", id)
        .maybeSingle();
      if (!c) {
        toast.error("Cliente no encontrado");
        navigate({ to: "/clientes" });
        return;
      }
      setClient(c as Client);

      const { data: p } = await supabase
        .from("projects")
        .select("id, name, location, status, visibility, created_at, user_id")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      const projs = (p ?? []) as Omit<ProjectWithEntries, "entries">[];

      // For each project, fetch its entries (limit a few for inline preview)
      const enriched: ProjectWithEntries[] = await Promise.all(
        projs.map(async (proj) => {
          const { data: e } = await supabase
            .from("entries")
            .select("id, type, title, description, thumbnail_path, captured_at, user_id")
            .eq("project_id", proj.id)
            .order("captured_at", { ascending: false });
          return { ...proj, entries: ((e ?? []) as EntryPreview[]) };
        }),
      );
      setProjects(enriched);

      const tmap: Record<string, string> = {};
      await Promise.all(
        enriched.flatMap((proj) =>
          proj.entries.map(async (en) => {
            if (en.thumbnail_path) {
              const url = await getSignedUrl(en.thumbnail_path);
              if (url) tmap[en.id] = url;
            }
          }),
        ),
      );
      setThumbs(tmap);
    })();
  }, [user, id, navigate]);

  const grouped = useMemo(() => {
    const map = new Map<string, { date: Date; items: ProjectWithEntries[] }>();
    for (const p of projects) {
      const d = startOfDay(new Date(p.created_at));
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, date: val.date, items: val.items }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [projects]);

  if (loading || !user || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">
        <Link to="/clientes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Clientes
        </Link>

        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              {client.contact && (
                <p className="text-sm text-muted-foreground mt-1">{client.contact}</p>
              )}
              {client.notes && (
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{client.notes}</p>
              )}
            </div>
          </div>
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
        </div>

        {projects.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Este cliente aún no tiene proyectos. Crea uno y asígnalo a este cliente desde la página de proyectos.
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
                <div className="space-y-3">
                  {g.items.map((p) => (
                    <ProjectExpandableCard key={p.id} project={p} thumbs={thumbs} />
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
                  <th className="text-left px-4 py-2 font-medium">Proyecto</th>
                  <th className="text-left px-4 py-2 font-medium">Visibilidad</th>
                  <th className="text-left px-4 py-2 font-medium">Estado</th>
                  <th className="text-right px-4 py-2 font-medium">Entradas</th>
                  <th className="text-right px-4 py-2 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate({ to: "/proyecto/$id", params: { id: p.id } })}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.location && <div className="text-xs text-muted-foreground">{p.location}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {p.visibility === "public" ? (
                        <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Público</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Privado</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === "activo" ? "default" : "secondary"}>
                        {p.status === "activo" ? "Activo" : "Finalizado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{p.entries.length}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatRelative(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  );
}

function ProjectExpandableCard({
  project,
  thumbs,
}: {
  project: ProjectWithEntries;
  thumbs: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{project.name}</span>
            {project.visibility === "public" ? (
              <Badge variant="outline" className="gap-1 text-xs"><Globe className="h-3 w-3" /> Público</Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-xs"><Lock className="h-3 w-3" /> Privado</Badge>
            )}
            <Badge variant={project.status === "activo" ? "default" : "secondary"} className="text-xs">
              {project.status === "activo" ? "Activo" : "Finalizado"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {project.entries.length} entradas · {formatRelative(project.created_at)}
            {project.location && ` · ${project.location}`}
          </p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {expanded ? "Ocultar" : "Desglosar"}
        </span>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/20">
          {project.entries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">Sin entradas todavía.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {project.entries.map((en) => (
                <li
                  key={en.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-background cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate({
                      to: "/proyecto/$id/entrada/$entradaId",
                      params: { id: project.id, entradaId: en.id },
                    });
                  }}
                >
                  <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    {thumbs[en.id] ? (
                      <img src={thumbs[en.id]} alt="" className="h-full w-full object-cover" />
                    ) : en.type === "note" ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : en.type === "video" ? (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Camera className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {en.title || (en.type === "note" ? "Nota" : en.type === "photo" ? "Foto" : "Video")}
                    </p>
                    {en.description && (
                      <p className="text-xs text-muted-foreground truncate">{en.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTime(en.captured_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-3 mt-2 border-t flex justify-end">
            <Link
              to="/proyecto/$id"
              params={{ id: project.id }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Abrir proyecto →
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
