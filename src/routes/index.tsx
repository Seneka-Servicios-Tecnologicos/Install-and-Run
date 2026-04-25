import { useEffect, useState, useMemo } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Plus, Search, FolderOpen, Image as ImageIcon, Lock, Globe, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/app-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatRelative } from "@/lib/format";
import { getSignedUrl } from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mis proyectos — Install & Report" },
      { name: "description", content: "Tus proyectos de trabajo en campo." },
    ],
  }),
  component: Dashboard,
});

interface ProjectRow {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  status: string;
  visibility: string;
  user_id: string;
  client_id: string | null;
  created_at: string;
  entry_count: number;
  last_thumb: string | null;
  client_name?: string | null;
}

interface ClientOpt {
  id: string;
  name: string;
}

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "activo" | "finalizado">("todos");
  const [scope, setScope] = useState<"todos" | "mios" | "publicos">("todos");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const loadProjects = async () => {
    if (!user) return;
    const { data: pData, error } = await supabase
      .from("projects")
      .select("id, name, location, description, status, visibility, user_id, client_id, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Error cargando proyectos");
      return;
    }

    // map of clientId → name
    const clientIds = Array.from(new Set((pData ?? []).map((p) => p.client_id).filter(Boolean) as string[]));
    let clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: cs } = await supabase.from("clients").select("id, name").in("id", clientIds);
      clientMap = new Map((cs ?? []).map((c) => [c.id, c.name]));
    }

    const enriched: ProjectRow[] = await Promise.all(
      (pData ?? []).map(async (p) => {
        const { count } = await supabase
          .from("entries")
          .select("id", { count: "exact", head: true })
          .eq("project_id", p.id);
        const { data: lastEntry } = await supabase
          .from("entries")
          .select("thumbnail_path")
          .eq("project_id", p.id)
          .not("thumbnail_path", "is", null)
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          ...p,
          entry_count: count ?? 0,
          last_thumb: lastEntry?.thumbnail_path ?? null,
          client_name: p.client_id ? clientMap.get(p.client_id) ?? null : null,
        };
      }),
    );
    setProjects(enriched);

    const urls: Record<string, string> = {};
    await Promise.all(
      enriched.map(async (p) => {
        if (p.last_thumb) {
          const url = await getSignedUrl(p.last_thumb);
          if (url) urls[p.id] = url;
        }
      }),
    );
    setThumbs(urls);
  };

  const loadClients = async () => {
    const { data } = await supabase.from("clients").select("id, name").order("name");
    setClients((data ?? []) as ClientOpt[]);
  };

  useEffect(() => {
    if (!user) return;
    loadProjects();
    loadClients();
    // Realtime: refresca lista cuando alguien crea/modifica proyectos o sube entradas
    const channel = supabase
      .channel("dashboard-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => loadProjects())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "entries" }, () => loadProjects())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "entries" }, () => loadProjects())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filter !== "todos" && p.status !== filter) return false;
      if (scope === "mios" && p.user_id !== user?.id) return false;
      if (scope === "publicos" && p.visibility !== "public") return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projects, search, filter, scope, user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { error, data } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name,
        location: location || null,
        description: description || null,
        client_id: clientId === "none" ? null : clientId,
        visibility: isPublic ? "public" : "private",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      toast.error("Error al crear proyecto");
      return;
    }
    toast.success("Proyecto creado");
    setOpen(false);
    setName(""); setLocation(""); setDescription(""); setClientId("none"); setIsPublic(false);
    if (data) navigate({ to: "/proyecto/$id", params: { id: data.id } });
  };

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
        <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length} {projects.length === 1 ? "proyecto" : "proyectos"} visibles
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" /> Nuevo proyecto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo proyecto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Nombre *</Label>
                  <Input
                    id="p-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Cableado oficina central"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-client">Cliente</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger id="p-client">
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin cliente</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    ¿No está? <Link to="/clientes" className="text-primary hover:underline">Crear cliente</Link>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-loc">Ubicación</Label>
                  <Input
                    id="p-loc"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Edificio Torre Norte, piso 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-desc">Descripción</Label>
                  <Textarea
                    id="p-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Detalles, alcance, notas iniciales..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="p-vis" className="flex items-center gap-2 cursor-pointer">
                      {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      {isPublic ? "Proyecto público" : "Proyecto privado"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isPublic
                        ? "Todo el equipo puede ver y colaborar añadiendo entradas."
                        : "Solo tú puedes ver y editar este proyecto."}
                    </p>
                  </div>
                  <Switch id="p-vis" checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creando..." : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar proyecto..."
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="activo">Activos</TabsTrigger>
              <TabsTrigger value="finalizado">Finalizados</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="mb-6">
          <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="mios">Míos</TabsTrigger>
              <TabsTrigger value="publicos">Públicos del equipo</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {projects.length === 0
                ? "Aún no hay proyectos. Crea el primero para empezar."
                : "Sin resultados para el filtro actual."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to="/proyecto/$id"
                params={{ id: p.id }}
                className="group"
              >
                <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 h-full p-0 gap-0">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {thumbs[p.id] ? (
                      <img
                        src={thumbs[p.id]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      <Badge
                        variant={p.status === "activo" ? "default" : "secondary"}
                      >
                        {p.status === "activo" ? "Activo" : "Finalizado"}
                      </Badge>
                      <Badge variant="outline" className="bg-background/90 gap-1">
                        {p.visibility === "public" ? (
                          <><Globe className="h-3 w-3" /> Público</>
                        ) : (
                          <><Lock className="h-3 w-3" /> Privado</>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    {p.client_name && (
                      <p className="text-xs text-primary/80 truncate mt-0.5 flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {p.client_name}
                      </p>
                    )}
                    {p.location && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {p.location}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>{p.entry_count} entradas</span>
                      <span>{formatRelative(p.created_at)}</span>
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
