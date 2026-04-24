import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Video, FileText } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { getSignedUrl } from "@/lib/storage";

export const Route = createFileRoute("/usuario/$id")({
  head: () => ({
    meta: [{ title: "Usuario — Install & Report" }],
  }),
  component: UserDetail,
});

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}
interface ActivityEntry {
  id: string;
  type: "photo" | "video" | "note";
  title: string | null;
  description: string | null;
  thumbnail_path: string | null;
  captured_at: string;
  project_id: string;
  project_name?: string;
}

function UserDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", id)
        .maybeSingle();
      if (!prof) {
        toast.error("Usuario no encontrado");
        navigate({ to: "/usuarios" });
        return;
      }
      setProfile(prof as Profile);

      const { data: e } = await supabase
        .from("entries")
        .select("id, type, title, description, thumbnail_path, captured_at, project_id")
        .eq("user_id", id)
        .order("captured_at", { ascending: false })
        .limit(200);

      const list = (e ?? []) as ActivityEntry[];

      // load project names
      const projectIds = Array.from(new Set(list.map((x) => x.project_id)));
      if (projectIds.length > 0) {
        const { data: projs } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);
        const nameMap = new Map((projs ?? []).map((p) => [p.id, p.name]));
        for (const item of list) {
          item.project_name = nameMap.get(item.project_id);
        }
      }
      setEntries(list);

      const tmap: Record<string, string> = {};
      await Promise.all(
        list.map(async (en) => {
          if (en.thumbnail_path) {
            const url = await getSignedUrl(en.thumbnail_path);
            if (url) tmap[en.id] = url;
          }
        }),
      );
      setThumbs(tmap);
    })();
  }, [user, id, navigate]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-6 pb-24">
        <Link to="/usuarios" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Usuarios
        </Link>

        <div className="flex items-start gap-4 mb-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {(profile.full_name ?? profile.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {profile.full_name || profile.email || "Sin nombre"}
              {profile.id === user.id && <Badge variant="secondary" className="text-xs">tú</Badge>}
            </h1>
            {profile.email && profile.full_name && (
              <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">{entries.length} entradas visibles</p>
          </div>
        </div>

        {entries.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-sm">Este usuario aún no ha subido entradas que tú puedas ver.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {entries.map((en) => (
                <li
                  key={en.id}
                  className="p-3 flex items-center gap-3 hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate({
                    to: "/proyecto/$id/entrada/$entradaId",
                    params: { id: en.project_id, entradaId: en.id },
                  })}
                >
                  <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    {thumbs[en.id] ? (
                      <img src={thumbs[en.id]} alt="" className="h-full w-full object-cover" />
                    ) : en.type === "note" ? (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    ) : en.type === "video" ? (
                      <Video className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {en.title || (en.type === "note" ? "Nota" : en.type === "photo" ? "Foto" : "Video")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {en.project_name ?? "Proyecto"} · {formatDateTime(en.captured_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
}
