import { Link } from "@tanstack/react-router";
import { Moon, Sun, LogOut, FolderKanban, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import logoColor from "@/assets/logo-seneka-color.png";
import logoWhite from "@/assets/logo-seneka-white.png";

interface AppHeaderProps {
  title?: string;
  showLogout?: boolean;
}

export function AppHeader({ title, showLogout = true }: AppHeaderProps) {
  const { theme, toggle, mounted } = useTheme();
  const logo = mounted && theme === "dark" ? logoWhite : logoColor;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
            <img src={logo} alt="Seneka" className="h-7 w-auto" />
            <span className="hidden sm:inline truncate max-w-[24vw] text-sm">
              {title ?? "Install & Report"}
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link
              to="/"
              className="px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              activeOptions={{ exact: true }}
              activeProps={{ className: "px-2.5 py-1.5 rounded-md text-foreground bg-muted flex items-center gap-1.5" }}
            >
              <FolderKanban className="h-4 w-4" /> Proyectos
            </Link>
            <Link
              to="/clientes"
              className="px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              activeProps={{ className: "px-2.5 py-1.5 rounded-md text-foreground bg-muted flex items-center gap-1.5" }}
            >
              <Building2 className="h-4 w-4" /> Clientes
            </Link>
            <Link
              to="/usuarios"
              className="px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              activeProps={{ className: "px-2.5 py-1.5 rounded-md text-foreground bg-muted flex items-center gap-1.5" }}
            >
              <Users className="h-4 w-4" /> Usuarios
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
            {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {showLogout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => supabase.auth.signOut()}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 text-sm">
        <Link
          to="/"
          className="px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 text-xs"
          activeOptions={{ exact: true }}
          activeProps={{ className: "px-2.5 py-1 rounded-md text-foreground bg-muted flex items-center gap-1.5 text-xs" }}
        >
          <FolderKanban className="h-3.5 w-3.5" /> Proyectos
        </Link>
        <Link
          to="/clientes"
          className="px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 text-xs"
          activeProps={{ className: "px-2.5 py-1 rounded-md text-foreground bg-muted flex items-center gap-1.5 text-xs" }}
        >
          <Building2 className="h-3.5 w-3.5" /> Clientes
        </Link>
        <Link
          to="/usuarios"
          className="px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 text-xs"
          activeProps={{ className: "px-2.5 py-1 rounded-md text-foreground bg-muted flex items-center gap-1.5 text-xs" }}
        >
          <Users className="h-3.5 w-3.5" /> Usuarios
        </Link>
      </nav>
    </header>
  );
}
