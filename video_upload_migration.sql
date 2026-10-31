-- Store chat video files in the existing chat-images bucket so message cleanup
-- and room deletion continue to remove media through the existing image_path flow.
UPDATE storage.buckets
SET file_size_limit = 524288000,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/gif','image/avif',
      'video/mp4','video/webm','video/quicktime'
    ]
WHERE id = 'chat-images';

DROP POLICY IF EXISTS "roomchat image upload" ON storage.objects;
CREATE POLICY "roomchat image upload"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND name ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9_-]{1,128}[.](jpg|png|webp|gif|avif|mp4|webm|mov)$'
  AND EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id::text = split_part(objects.name, '/', 1)
  )
);
