-- RoomChat: guest/account room-owner deletion and timed chat mute.
-- Applied to Supabase project losuyalyjcurntylbwgy on 2026-10-25.
-- Safe to re-run; additive changes only.

CREATE OR REPLACE FUNCTION public.roomchat_room_image_paths(p_room_id uuid, p_owner_token text DEFAULT NULL)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_paths text[]; v_creator uuid; v_owner boolean := false;
BEGIN
  SELECT created_by INTO v_creator FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RETURN ARRAY[]::text[]; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() = v_creator THEN v_owner := true; END IF;
  IF char_length(coalesce(p_owner_token,'')) >= 32 THEN
    PERFORM 1 FROM roomchat_private.room_owners
      WHERE room_id = p_room_id
        AND owner_token_sha256 = encode(extensions.digest(p_owner_token,'sha256'),'hex');
    IF FOUND THEN v_owner := true; END IF;
  END IF;
  IF NOT v_owner AND NOT roomchat_private.is_admin() THEN
    RAISE EXCEPTION '이 방의 운영자만 방을 정리할 수 있습니다.';
  END IF;
  SELECT coalesce(array_agg(m.image_path) FILTER (WHERE m.image_path IS NOT NULL), ARRAY[]::text[])
    INTO v_paths FROM public.messages m WHERE m.room_id = p_room_id;
  RETURN v_paths;
END
$function$;

CREATE OR REPLACE FUNCTION public.roomchat_delete_room(p_room_id uuid, p_owner_token text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_creator uuid; v_featured boolean; v_owner boolean := false;
BEGIN
  SELECT created_by, is_featured INTO v_creator, v_featured
    FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_featured THEN RAISE EXCEPTION '고정된 기본 방은 삭제할 수 없습니다.'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() = v_creator THEN v_owner := true; END IF;
  IF char_length(coalesce(p_owner_token,'')) >= 32 THEN
    PERFORM 1 FROM roomchat_private.room_owners
      WHERE room_id = p_room_id
        AND owner_token_sha256 = encode(extensions.digest(p_owner_token,'sha256'),'hex');
    IF FOUND THEN v_owner := true; END IF;
  END IF;
  IF NOT v_owner AND NOT roomchat_private.is_admin() THEN
    RAISE EXCEPTION '방장 또는 관리자만 방을 삭제할 수 있습니다.';
  END IF;
  DELETE FROM public.rooms WHERE id = p_room_id;
  RETURN true;
END
$function$;
GRANT EXECUTE ON FUNCTION public.roomchat_room_image_paths(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roomchat_delete_room(uuid,text) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS roomchat_private.room_mutes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_session_id uuid,
  muted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK ((user_id IS NULL) <> (guest_session_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS roomchat_room_mutes_user_uidx
  ON roomchat_private.room_mutes(room_id,user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roomchat_room_mutes_guest_uidx
  ON roomchat_private.room_mutes(room_id,guest_session_id) WHERE guest_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION roomchat_private.is_muted_now(p_room_id uuid,p_user_id uuid,p_guest uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM roomchat_private.room_mutes m
    WHERE m.room_id = p_room_id AND m.expires_at > now()
      AND ((p_user_id IS NOT NULL AND m.user_id = p_user_id)
        OR (p_guest IS NOT NULL AND m.guest_session_id = p_guest))
  )
$function$;

CREATE OR REPLACE FUNCTION public.roomchat_mute_member(
  p_room_id uuid, p_user_id uuid DEFAULT NULL, p_guest_session_id uuid DEFAULT NULL,
  p_owner_token text DEFAULT NULL, p_minutes integer DEFAULT 5
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_creator uuid; v_owner boolean := false; v_admin boolean := roomchat_private.is_admin();
  v_owner_session uuid; v_until timestamptz;
BEGIN
  IF (p_user_id IS NULL) = (p_guest_session_id IS NULL) THEN
    RAISE EXCEPTION '뮤트할 참여자 한 명을 선택해 주세요.';
  END IF;
  IF p_minutes IS NULL OR p_minutes NOT IN (1,5,10,30,60,1440) THEN
    RAISE EXCEPTION '뮤트 시간은 1분, 5분, 10분, 30분, 1시간, 하루 중에서 선택해 주세요.';
  END IF;
  SELECT created_by INTO v_creator FROM public.rooms WHERE id=p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION '방을 찾을 수 없습니다.'; END IF;
  IF auth.uid() IS NOT NULL AND v_creator=auth.uid() THEN v_owner:=true; END IF;
  IF char_length(coalesce(p_owner_token,'')) >= 32 THEN
    SELECT owner_session_id INTO v_owner_session FROM roomchat_private.room_owners
    WHERE room_id=p_room_id AND owner_token_sha256=encode(extensions.digest(p_owner_token,'sha256'),'hex');
    IF FOUND THEN v_owner:=true; END IF;
  END IF;
  IF NOT v_admin AND NOT v_owner THEN RAISE EXCEPTION '이 방의 운영자만 참여자를 뮤트할 수 있습니다.'; END IF;
  IF (auth.uid() IS NOT NULL AND p_user_id=auth.uid())
     OR (auth.uid() IS NULL AND v_owner AND p_guest_session_id=v_owner_session) THEN
    RAISE EXCEPTION '방장은 자기 자신을 뮤트할 수 없습니다.';
  END IF;
  IF p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM roomchat_private.member_roles WHERE user_id=p_user_id AND role='admin'
  ) THEN RAISE EXCEPTION '인증된 관리자는 뮤트할 수 없습니다.'; END IF;
  v_until:=now()+make_interval(mins=>p_minutes);
  IF p_user_id IS NOT NULL THEN
    INSERT INTO roomchat_private.room_mutes(room_id,user_id,muted_by,expires_at)
      VALUES(p_room_id,p_user_id,auth.uid(),v_until)
    ON CONFLICT (room_id,user_id) WHERE user_id IS NOT NULL
      DO UPDATE SET expires_at=excluded.expires_at,muted_by=excluded.muted_by,created_at=now();
  ELSE
    INSERT INTO roomchat_private.room_mutes(room_id,guest_session_id,muted_by,expires_at)
      VALUES(p_room_id,p_guest_session_id,auth.uid(),v_until)
    ON CONFLICT (room_id,guest_session_id) WHERE guest_session_id IS NOT NULL
      DO UPDATE SET expires_at=excluded.expires_at,muted_by=excluded.muted_by,created_at=now();
  END IF;
  RETURN true;
END
$function$;
GRANT EXECUTE ON FUNCTION public.roomchat_mute_member(uuid,uuid,uuid,text,integer) TO anon, authenticated;

-- Both message entry points check the mute server-side, so a client cannot bypass it.
CREATE OR REPLACE FUNCTION public.roomchat_post_message(
 p_room_id uuid,p_content text DEFAULT NULL,p_image_path text DEFAULT NULL,
 p_guest_session_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL
) RETURNS public.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_nickname text; v_user_id uuid:=auth.uid(); v_row public.messages%ROWTYPE;
 v_content text:=nullif(btrim(coalesce(p_content,'')),''); v_is_guide boolean:=false;
BEGIN
 SELECT coalesce(r.is_featured AND r.name='설명 방',false) INTO v_is_guide FROM public.rooms r WHERE r.id=p_room_id;
 IF NOT FOUND THEN RAISE EXCEPTION '이 방은 더 이상 존재하지 않습니다.'; END IF;
 IF v_is_guide THEN RAISE EXCEPTION '설명 방에서는 채팅할 수 없어요.'; END IF;
 IF v_content IS NOT NULL AND char_length(v_content)>2000 THEN RAISE EXCEPTION '메시지는 2000자 이내로 입력해 주세요.'; END IF;
 IF v_content IS NULL AND p_image_path IS NULL THEN RAISE EXCEPTION '메시지나 이미지를 입력해 주세요.'; END IF;
 IF p_image_path IS NOT NULL AND p_image_path NOT LIKE p_room_id::text||'/%' THEN RAISE EXCEPTION '이미지 경로가 현재 방과 일치하지 않습니다.'; END IF;
 IF v_user_id IS NOT NULL THEN
   SELECT nickname INTO v_nickname FROM public.roomchat_profiles WHERE id=v_user_id;
   IF v_nickname IS NULL THEN RAISE EXCEPTION '계정 닉네임을 확인할 수 없습니다.'; END IF;
   IF roomchat_private.is_kicked_now(p_room_id,v_user_id,NULL) THEN RAISE EXCEPTION '이 방의 운영자가 참여를 제한했습니다.'; END IF;
   IF roomchat_private.is_muted_now(p_room_id,v_user_id,NULL) THEN RAISE EXCEPTION '이 방에서 일시적으로 채팅이 제한되었습니다.'; END IF;
 ELSE
   SELECT nickname INTO v_nickname FROM roomchat_private.guest_sessions
    WHERE session_id=p_guest_session_id AND token_sha256=encode(extensions.digest(coalesce(p_guest_token,''),'sha256'),'hex') AND expires_at>now();
   IF v_nickname IS NULL THEN RAISE EXCEPTION '게스트 이름을 먼저 정해 주세요.'; END IF;
   IF roomchat_private.is_kicked_now(p_room_id,NULL,p_guest_session_id) THEN RAISE EXCEPTION '이 방의 운영자가 참여를 제한했습니다.'; END IF;
   IF roomchat_private.is_muted_now(p_room_id,NULL,p_guest_session_id) THEN RAISE EXCEPTION '이 방에서 일시적으로 채팅이 제한되었습니다.'; END IF;
 END IF;
 INSERT INTO public.messages(room_id,nickname,content,image_path,user_id,guest_session_id,is_verified)
 VALUES(p_room_id,v_nickname,v_content,p_image_path,v_user_id,CASE WHEN v_user_id IS NULL THEN p_guest_session_id ELSE NULL END,roomchat_private.is_admin())
 RETURNING * INTO v_row;
 RETURN v_row;
END
$function$;

CREATE OR REPLACE FUNCTION public.roomchat_post_reply(
 p_room_id uuid,p_content text DEFAULT NULL,p_image_path text DEFAULT NULL,
 p_guest_session_id uuid DEFAULT NULL,p_guest_token text DEFAULT NULL,p_reply_to bigint DEFAULT NULL
) RETURNS public.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_nickname text; v_user_id uuid:=auth.uid(); v_row public.messages%ROWTYPE;
 v_content text:=nullif(btrim(coalesce(p_content,'')),''); v_is_guide boolean:=false;
BEGIN
 SELECT coalesce(r.is_featured AND r.name='설명 방',false) INTO v_is_guide FROM public.rooms r WHERE r.id=p_room_id;
 IF NOT FOUND THEN RAISE EXCEPTION '이 방은 더 이상 존재하지 않습니다.'; END IF;
 IF v_is_guide THEN RAISE EXCEPTION '설명 방에서는 채팅할 수 없어요.'; END IF;
 IF v_content IS NOT NULL AND char_length(v_content)>2000 THEN RAISE EXCEPTION '메시지는 2000자 이내로 입력해 주세요.'; END IF;
 IF v_content IS NULL AND p_image_path IS NULL THEN RAISE EXCEPTION '메시지나 이미지를 입력해 주세요.'; END IF;
 IF p_image_path IS NOT NULL AND p_image_path NOT LIKE p_room_id::text||'/%' THEN RAISE EXCEPTION '이미지 경로가 현재 방과 일치하지 않습니다.'; END IF;
 IF p_reply_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.messages m WHERE m.id=p_reply_to AND m.room_id=p_room_id) THEN RAISE EXCEPTION '답글을 달 원본 메시지를 찾을 수 없습니다.'; END IF;
 IF v_user_id IS NOT NULL THEN
   SELECT nickname INTO v_nickname FROM public.roomchat_profiles WHERE id=v_user_id;
   IF v_nickname IS NULL THEN RAISE EXCEPTION '계정 닉네임을 확인할 수 없습니다.'; END IF;
   IF roomchat_private.is_kicked_now(p_room_id,v_user_id,NULL) THEN RAISE EXCEPTION '이 방의 운영자가 참여를 제한했습니다.'; END IF;
   IF roomchat_private.is_muted_now(p_room_id,v_user_id,NULL) THEN RAISE EXCEPTION '이 방에서 일시적으로 채팅이 제한되었습니다.'; END IF;
 ELSE
   SELECT nickname INTO v_nickname FROM roomchat_private.guest_sessions
    WHERE session_id=p_guest_session_id AND token_sha256=encode(extensions.digest(coalesce(p_guest_token,''),'sha256'),'hex') AND expires_at>now();
   IF v_nickname IS NULL THEN RAISE EXCEPTION '게스트 이름을 먼저 정해 주세요.'; END IF;
   IF roomchat_private.is_kicked_now(p_room_id,NULL,p_guest_session_id) THEN RAISE EXCEPTION '이 방의 운영자가 참여를 제한했습니다.'; END IF;
   IF roomchat_private.is_muted_now(p_room_id,NULL,p_guest_session_id) THEN RAISE EXCEPTION '이 방에서 일시적으로 채팅이 제한되었습니다.'; END IF;
 END IF;
 INSERT INTO public.messages(room_id,nickname,content,image_path,user_id,guest_session_id,is_verified,reply_to)
 VALUES(p_room_id,v_nickname,v_content,p_image_path,v_user_id,CASE WHEN v_user_id IS NULL THEN p_guest_session_id ELSE NULL END,roomchat_private.is_admin(),p_reply_to)
 RETURNING * INTO v_row;
 RETURN v_row;
END
$function$;
GRANT EXECUTE ON FUNCTION public.roomchat_post_message(uuid,text,text,uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.roomchat_post_reply(uuid,text,text,uuid,text,bigint) TO anon, authenticated;
