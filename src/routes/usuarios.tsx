import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Users, Camera, Video, FileText, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRelative } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios — Install & Report" },
      { name: "description", content: "Actividad de cada técnico del equipo." },
    ],
  }),
  component: UsersPage,
});

interface UserStats {
  id: string;
  full_name: string | null;
  email: string | null;
  total: number;
  photos: number;
  videos: number;
  notes: number;
  projects: number;
  last_activity: string | null;
}

function UsersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim(),
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      const payload = data as { error?: string; ok?: boolean } | null;
      if (payload?.error) throw new Error(payload.error);
      toast.success(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      setInviteOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo invitar";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingData(true);
      // Get all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      // Get all entries (RLS already filters to ones the user can see)
      const { data: entries } = await supabase
        .from("entries")
        .select("user_id, type, captured_at, project_id");

      const stats = new Map<string, UserStats>();
      for (const p of profiles ?? []) {
        stats.set(p.id, {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          total: 0, photos: 0, videos: 0, notes: 0, projects: 0,
          last_activity: null,
        });
      }

      const projectsByUser = new Map<string, Set<string>>();
      for (const en of entries ?? []) {
        const s = stats.get(en.user_id);
        if (!s) continue;
        s.total += 1;
        if (en.type === "photo") s.photos += 1;
        else if (en.type === "video") s.videos += 1;
        else if (en.type === "note") s.notes += 1;
        if (!s.last_activity || en.captured_at > s.last_activity) {
          s.last_activity = en.captured_at;
        }
        if (!projectsByUser.has(en.user_id)) projectsByUser.set(en.user_id, new Set());
        projectsByUser.get(en.user_id)!.add(en.project_id);
      }
      for (const [uid, set] of projectsByUser) {
        const s = stats.get(uid);
        if (s) s.projects = set.size;
      }

      setUsers(
        Array.from(stats.values()).sort((a, b) => {
          if (a.last_activity && b.last_activity) {
            return b.last_activity.localeCompare(a.last_activity);
          }
          if (a.last_activity) return -1;
          if (b.last_activity) return 1;
          return (a.full_name ?? "").localeCompare(b.full_name ?? "");
        }),
      );
      setLoadingData(false);
    })();
  }, [user]);

  if (loading || !user) {
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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios del equipo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Actividad y aportes de cada técnico (basada en lo que puedes ver).
          </p>
        </div>

        {loadingData ? (
          <p className="text-sm text-muted-foreground">Cargando estadísticas...</p>
        ) : users.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay usuarios registrados todavía.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <Link
                key={u.id}
                to="/usuario/$id"
                params={{ id: u.id }}
                className="group"
              >
                <Card className="p-5 transition-all hover:shadow-md hover:-translate-y-0.5 h-full">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                      {(u.full_name ?? u.email ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {u.full_name || u.email || "Sin nombre"}
                        {u.id === user.id && (
                          <Badge variant="secondary" className="ml-2 text-[10px] py-0">tú</Badge>
                        )}
                      </h3>
                      {u.email && u.full_name && (
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> {u.photos}</span>
                        <span className="flex items-center gap-1"><Video className="h-3 w-3" /> {u.videos}</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {u.notes}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {u.total} entradas · {u.projects} proyectos
                        {u.last_activity && ` · activo ${formatRelative(u.last_activity)}`}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
