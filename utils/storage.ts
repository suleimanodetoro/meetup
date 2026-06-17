import { supabase } from './supabase';

/**
 * Parse a Supabase Storage public URL into its bucket-relative object path.
 *
 * Returns null when the input isn't a public object URL for `bucket` — e.g. a
 * local `file://` uri straight from the image picker, an http(s) URL pointing
 * elsewhere, or an empty value. Callers can pass mixed lists and rely on the
 * nulls being filtered out.
 *
 *   https://<ref>.supabase.co/storage/v1/object/public/avatars/<uid>/123.jpg
 *     -> "<uid>/123.jpg"
 */
export function storagePathFromPublicUrl(
  url: string | null | undefined,
  bucket = 'avatars'
): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let path = url.slice(idx + marker.length);
  const q = path.indexOf('?'); // strip any transform/cache-bust query
  if (q !== -1) path = path.slice(0, q);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Best-effort deletion of storage objects by their public URLs.
 *
 * Silently skips anything that isn't a `bucket` object URL (local picker uris,
 * already-null slots) and never throws — image cleanup must not block or fail a
 * save. Owner-scoped storage RLS already restricts a user to removing files in
 * their own `${uid}/` folder, so a stray/foreign url simply no-ops server-side.
 */
export async function removeStorageObjectsByUrl(
  urls: Array<string | null | undefined>,
  bucket = 'avatars'
): Promise<void> {
  const paths = urls
    .map((u) => storagePathFromPublicUrl(u, bucket))
    .filter((p): p is string => !!p);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.warn('[storage] cleanup failed for', paths, '-', error.message);
  }
}
