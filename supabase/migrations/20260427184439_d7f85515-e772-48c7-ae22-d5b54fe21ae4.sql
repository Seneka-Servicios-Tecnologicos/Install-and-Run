-- Helper: is current user a guest?
CREATE OR REPLACE FUNCTION public.is_guest()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'invitado'::public.app_role)
$$;

-- PROJECTS: block writes for guests
DROP POLICY IF EXISTS "Insert own projects" ON public.projects;
CREATE POLICY "Insert own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_guest());

DROP POLICY IF EXISTS "Update own or public projects" ON public.projects;
CREATE POLICY "Update own or public projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (((auth.uid() = user_id) OR (visibility = 'public')) AND NOT public.is_guest());

DROP POLICY IF EXISTS "Owner can delete projects" ON public.projects;
CREATE POLICY "Owner can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_guest());

-- ENTRIES: block writes for guests
DROP POLICY IF EXISTS "Insert entries in accessible projects" ON public.entries;
CREATE POLICY "Insert entries in accessible projects"
  ON public.entries FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_guest()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = entries.project_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Update own entries" ON public.entries;
CREATE POLICY "Update own entries"
  ON public.entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_guest());

DROP POLICY IF EXISTS "Delete own entries" ON public.entries;
CREATE POLICY "Delete own entries"
  ON public.entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_guest());

-- CLIENTS: block writes for guests
DROP POLICY IF EXISTS "Authenticated can create clients" ON public.clients;
CREATE POLICY "Authenticated can create clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND NOT public.is_guest());

DROP POLICY IF EXISTS "Creator can update clients" ON public.clients;
CREATE POLICY "Creator can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND NOT public.is_guest());

DROP POLICY IF EXISTS "Creator can delete clients" ON public.clients;
CREATE POLICY "Creator can delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND NOT public.is_guest());

-- PROFILES: block updates for guests
DROP POLICY IF EXISTS "Profiles can be updated by owner" ON public.profiles;
CREATE POLICY "Profiles can be updated by owner"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT public.is_guest());