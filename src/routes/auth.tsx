import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { SenekaLogo } from "@/components/seneka-logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceder — Install & Report" },
      { name: "description", content: "Inicia sesión en tu cuenta de técnico." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { theme, toggle, mounted } = useTheme();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al autenticar";
      toast.error(msg.includes("Invalid login") ? "Credenciales incorrectas" : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Te enviamos un correo con instrucciones.");
      setMode("login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo enviar el correo";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "invitado@seneka.local",
        password: "invitado-seneka-2026",
      });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo entrar como invitado";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4"
        onClick={toggle}
        aria-label="Cambiar tema"
      >
        {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <SenekaLogo className="h-14 w-auto" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Install &amp; Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reportes de campo con evidencia visual
        </p>
      </div>

      <Card className="w-full max-w-sm p-6">
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tecnico@empresa.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Procesando..." : "Entrar"}
            </Button>

            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <div className="space-y-2">
              <Label htmlFor="email-forgot">Email</Label>
              <Input
                id="email-forgot"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tecnico@empresa.com"
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar enlace"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </form>
        )}

        {mode === "login" && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">o</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGuest}
              disabled={loading}
            >
              Entrar como invitado
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Acceso de solo lectura — explora proyectos sin modificar nada.
            </p>
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿No tienes cuenta? Pídele a un compañero del equipo que te invite desde
          la sección <span className="font-medium text-foreground">Usuarios</span>.
        </p>
      </Card>
    </div>
  );
}
