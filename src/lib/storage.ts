import { supabase } from "@/integrations/supabase/client";

export async function uploadMedia(
  userId: string,
  projectId: string,
  blob: Blob,
  extension: string,
  contentType: string,
): Promise<string> {
  const filename = `${crypto.randomUUID()}.${extension}`;
  const path = `${userId}/${projectId}/${filename}`;
  const { error } = await supabase.storage
    .from("project-media")
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("project-media")
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteMedia(paths: string[]): Promise<void> {
  const valid = paths.filter(Boolean);
  if (valid.length === 0) return;
  await supabase.storage.from("project-media").remove(valid);
}
