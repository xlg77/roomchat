-- Recover a guest-created room's management token only when the caller proves
-- possession of the exact guest session recorded as that room's owner.
CREATE OR REPLACE FUNCTION public.roomchat_recover_room_owner(
  p_room_id uuid,
  p_guest_session_id uuid,
  p_guest_token text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_owner_session_id uuid;
  v_owner_token text;
BEGIN
  -- Account sessions use rooms.created_by and must never claim guest ownership.
  IF auth.uid() IS NOT NULL
     OR p_room_id IS NULL
     OR p_guest_session_id IS NULL
     OR char_length(coalesce(p_guest_token, '')) < 32 THEN
    RETURN NULL;
  END IF;

  -- Verify the guest's secret against the server-side hash and expiry.
  PERFORM 1
  FROM roomchat_private.guest_sessions gs
  WHERE gs.session_id = p_guest_session_id
    AND gs.token_sha256 = encode(
      extensions.digest(coalesce(p_guest_token, ''), 'sha256'),
      'hex'
    )
    AND gs.expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Only the exact guest session recorded as this room's owner may recover it.
  SELECT ro.owner_session_id
    INTO v_owner_session_id
  FROM roomchat_private.room_owners ro
  WHERE ro.room_id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_owner_session_id IS DISTINCT FROM p_guest_session_id THEN
    RETURN NULL;
  END IF;

  -- Issue a fresh high-entropy token; only its SHA-256 hash is stored in the DB.
  v_owner_token := replace(
    pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text,
    '-',
    ''
  );

  UPDATE roomchat_private.room_owners
  SET owner_token_sha256 = encode(extensions.digest(v_owner_token, 'sha256'), 'hex')
  WHERE room_id = p_room_id
    AND owner_session_id = p_guest_session_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_owner_token;
END
$function$;

REVOKE ALL ON FUNCTION public.roomchat_recover_room_owner(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roomchat_recover_room_owner(uuid, uuid, text) TO anon;
