-- Phase 2 (deslop audit) — S8: lock down the avatars bucket.
--
-- Before: "Anyone can upload an avatar" granted INSERT to PUBLIC (incl. anon)
-- with only a bucket_id check — a free, public, CDN-served file host on your
-- egress bill. Owner UPDATE/DELETE policies existed but never matched because
-- the app used FLAT filenames (uid-...) while they expect a uid/ folder. No
-- size/MIME caps. Dashboard had created duplicate policies.
--
-- After: public READ stays (RN <Image> fetches avatar URLs UNAUTHENTICATED, so
-- this MUST remain public). INSERT/UPDATE/DELETE are owner-scoped to the
-- authenticated user, accepting BOTH the new `uid/...` folder paths AND the
-- legacy flat names that embed the uid — so a build mid-rollout keeps working.
-- (Drop the legacy LIKE branches once every client uploads folder paths.)
-- Adds a 5 MB size cap + image-only MIME allowlist.
--
-- Ships WITH the app change that uploads to `${uid}/...`.

UPDATE storage.buckets
SET file_size_limit = 5242880,  -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

-- Drop ALL existing avatars policies (incl. dashboard duplicates), then rebuild.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (COALESCE(qual, '') LIKE '%avatars%' OR COALESCE(with_check, '') LIKE '%avatars%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '-%'                 -- legacy uid-position-ts.jpg / uid-ts.jpg
      OR name LIKE 'plan-%-' || auth.uid()::text || '.jpg'  -- legacy plan-ts-uid.jpg
    )
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '-%'
      OR name LIKE 'plan-%-' || auth.uid()::text || '.jpg'
    )
  )
  WITH CHECK (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '-%'
      OR name LIKE 'plan-%-' || auth.uid()::text || '.jpg'
    )
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR name LIKE auth.uid()::text || '-%'
      OR name LIKE 'plan-%-' || auth.uid()::text || '.jpg'
    )
  );

-- event-images bucket is unused by the app but had an open anon INSERT policy.
-- Drop just its INSERT policies to kill the abuse vector (leave any read intact).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'INSERT'
      AND (COALESCE(qual, '') LIKE '%event-images%' OR COALESCE(with_check, '') LIKE '%event-images%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
