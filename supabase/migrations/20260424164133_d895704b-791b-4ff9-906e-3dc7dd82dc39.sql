
-- 1) Crear tabla de clientes (global, compartida)
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update clients"
  ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete clients"
  ON public.clients FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Añadir client_id y visibility a projects
ALTER TABLE public.projects
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_visibility_check CHECK (visibility IN ('private','public'));

CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_visibility ON public.projects(visibility);

-- 3) Reescribir RLS de projects para soportar público (todos ven y colaboran)
DROP POLICY IF EXISTS "Owner can view projects" ON public.projects;
DROP POLICY IF EXISTS "Owner can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Owner can update projects" ON public.projects;
DROP POLICY IF EXISTS "Owner can delete projects" ON public.projects;

CREATE POLICY "View own or public projects"
  ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR visibility = 'public');

CREATE POLICY "Insert own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own or public projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR visibility = 'public');

CREATE POLICY "Owner can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4) Reescribir RLS de entries: cualquiera ve/edita entradas en proyectos públicos
DROP POLICY IF EXISTS "Owner can view entries" ON public.entries;
DROP POLICY IF EXISTS "Owner can insert entries" ON public.entries;
DROP POLICY IF EXISTS "Owner can update entries" ON public.entries;
DROP POLICY IF EXISTS "Owner can delete entries" ON public.entries;

CREATE POLICY "View entries in accessible projects"
  ON public.entries FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = entries.project_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

CREATE POLICY "Insert entries in accessible projects"
  ON public.entries FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = entries.project_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

CREATE POLICY "Update own entries"
  ON public.entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Delete own entries"
  ON public.entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5) Permitir que usuarios autenticados vean perfiles básicos de los demás
--    (necesario para mostrar "subido por: Juan" en proyectos públicos y vista de usuarios)
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- 6) Storage: permitir leer media de proyectos accesibles (públicos)
--    Las rutas en storage tienen formato: {user_id}/{project_id}/{filename}
DROP POLICY IF EXISTS "Users can view own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;

CREATE POLICY "View media of accessible projects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[2]
          AND (p.visibility = 'public' OR p.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Upload media to accessible projects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Update own media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Delete own media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-media' AND auth.uid()::text = (storage.foldername(name))[1]);
