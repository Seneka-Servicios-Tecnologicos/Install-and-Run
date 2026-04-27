-- Add 'invitado' role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'invitado';