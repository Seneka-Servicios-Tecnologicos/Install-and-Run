import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Returns true when the current authenticated user has the 'invitado' role.
 * Guests get read-only access: can browse projects, entries and clients,
 * but cannot create, edit or delete anything, and cannot see the Users section.
 */
export function useIsGuest() {
  const { user, loading } = useAuth();
  const [isGuest, setIsGuest] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsGuest(false);
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "invitado")
        .maybeSingle();
      if (!cancelled) {
        setIsGuest(!!data);
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isGuest, checked: checked && !loading };
}
