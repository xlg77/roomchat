import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const allowedOrigins = new Set([
  "https://xlg77.github.io",
  "https://unknownuser-using-ai.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const encoder = new TextEncoder();
const ADMIN_INITIAL_NAMES = new Set(["천사", "크리스탈"]);

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicAuth = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeNickname(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/gu, " ")
    : "";
}

function jsonResponse(body: unknown, status = 200, origin?: string | null): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin",
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "apikey, authorization, content-type, x-client-info");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function hmacIp(ip: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(serviceKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(ip)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function allowRequest(request: Request, bucket: "register" | "login" | "recovery"): Promise<boolean> {
  // Cloudflare overwrites this header at the edge; never trust caller-controlled X-Forwarded-For.
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown-client";
  const { data, error } = await admin.rpc("roomchat_consume_rate_limit", {
    p_key_hash: await hmacIp(ip),
    p_bucket: bucket,
    p_limit: bucket === "register" ? 5 : bucket === "recovery" ? 5 : 20,
    p_window_seconds: bucket === "register" ? 3600 : bucket === "recovery" ? 3600 : 600,
  });
  if (error) throw error;
  return data === true;
}

function passwordIsValid(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && encoder.encode(value).length <= 72;
}

async function makeSession(email: string, password: string) {
  const { data, error } = await publicAuth.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return jsonResponse({ ok: true }, 200, origin);
  if (request.method !== "POST") return jsonResponse({ error: "지원하지 않는 요청입니다." }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return jsonResponse({ error: "허용되지 않은 웹사이트입니다." }, 403);

  try {
    const input = await request.json();
    const action = input?.action;
    const password = input?.password;

    if (action === "change_password") {
      if (!passwordIsValid(password)) {
        return jsonResponse({ error: "새 비밀번호는 8~72바이트로 입력해 주세요." }, 400, origin);
      }
      const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") || "";
      const { data: authData, error: authError } = accessToken
        ? await admin.auth.getUser(accessToken)
        : { data: { user: null }, error: new Error("Missing access token") };
      if (authError || !authData.user) {
        return jsonResponse({ error: "로그인한 계정에서만 비밀번호를 변경할 수 있습니다." }, 401, origin);
      }
      if (!await allowRequest(request, "recovery")) {
        return jsonResponse({ error: "비밀번호 변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, 429, origin);
      }
      const { error: passwordError } = await admin.auth.admin.updateUserById(authData.user.id, { password });
      if (passwordError) {
        return jsonResponse({ error: "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요." }, 400, origin);
      }
      return jsonResponse({ ok: true }, 200, origin);
    }

    const nickname = normalizeNickname(input?.nickname);
    if (nickname.length < 1 || nickname.length > 20 || /[\u0000-\u001f\u007f]/u.test(nickname)) {
      return jsonResponse({ error: "닉네임은 1~20자로 입력해 주세요." }, 400, origin);
    }
    if (action === "recover_admin") {
      if (!passwordIsValid(password)) {
        return jsonResponse({ error: "새 비밀번호는 8~72바이트로 입력해 주세요." }, 400, origin);
      }
      const recoveryCode = typeof input?.recoveryCode === "string" ? input.recoveryCode.trim().toLowerCase() : "";
      if (!["천사", "크리스탈"].includes(nickname) || !/^[0-9a-f]{64}$/u.test(recoveryCode)) {
        return jsonResponse({ error: "계정 또는 복구 코드가 올바르지 않거나 만료되었습니다." }, 400, origin);
      }
      if (!await allowRequest(request, "recovery")) {
        return jsonResponse({ error: "복구 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, 429, origin);
      }

      const inviteName = nickname === "천사" ? "[인증됨] 천사" : "[인증됨] 크리스탈";
      const { data: invite, error: inviteError } = await admin.schema("roomchat_private").from("admin_invites")
        .select("claimed_by")
        .eq("nickname", inviteName)
        .maybeSingle();
      const userId = invite?.claimed_by;
      if (inviteError || !userId) {
        return jsonResponse({ error: "계정 또는 복구 코드가 올바르지 않거나 만료되었습니다." }, 400, origin);
      }
      const { data: role } = await admin.schema("roomchat_private").from("member_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        return jsonResponse({ error: "계정 또는 복구 코드가 올바르지 않거나 만료되었습니다." }, 400, origin);
      }

      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(recoveryCode)));
      const codeHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const now = new Date().toISOString();
      const { data: consumed, error: consumeError } = await admin.schema("roomchat_private").from("admin_recovery_codes")
        .update({ used_at: now })
        .eq("user_id", userId)
        .eq("code_sha256", codeHash)
        .is("used_at", null)
        .gt("expires_at", now)
        .select("user_id")
        .maybeSingle();
      if (consumeError || !consumed) {
        return jsonResponse({ error: "계정 또는 복구 코드가 올바르지 않거나 만료되었습니다." }, 400, origin);
      }

      const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password });
      if (passwordError) {
        return jsonResponse({ error: "비밀번호를 변경하지 못했습니다. 복구 코드를 다시 발급받아야 합니다." }, 500, origin);
      }
      return jsonResponse({ ok: true, message: "관리자 비밀번호를 변경했습니다. 이제 새 비밀번호로 로그인하세요." }, 200, origin);
    }

    if (action === "recover_account") {
      if (!passwordIsValid(password)) {
        return jsonResponse({ error: "새 비밀번호는 8~72바이트로 입력해 주세요." }, 400, origin);
      }
      const recoveryCode = typeof input?.recoveryCode === "string" ? input.recoveryCode.trim().toLowerCase() : "";
      if (!/^[0-9a-f]{64}$/u.test(recoveryCode)) {
        return jsonResponse({ error: "계정 또는 복구 코드가 올바르지 않거나 만료되었습니다." }, 400, origin);
      }
      if (!await allowRequest(request, "recovery")) {
        return jsonResponse({ error: "복구 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, 429, origin);
      }
      const nicknameKey = nickname.toLocaleLowerCase("ko-KR").replace(/[\\%_]/gu, (char) => "\\" + char);
      const { data: profile, error: profileError } = await admin.from("roomchat_profiles")
        .select("id")
        .ilike("login_nickname", nicknameKey)
        .maybeSingle();
      if (profileError || !profile) {
        return jsonResponse({ error: "계정 또는 복구 코드가 올바르지 않거나 만료되었습니다." }, 400, origin);
      }
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(recoveryCode)));
      const codeHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const now = new Date().toISOString();
      const { data: consumed, error: consumeError } = await admin.schema("roomchat_private").from("account_recovery_codes")
        .update({ used_at: now })
        .eq("user_id", profile.id)
        .eq("code_sha256", codeHash)
        .is("used_at", null)
        .gt("expires_at", now)
        .select("user_id")
        .maybeSingle();
      if (consumeError || !consumed) {
        return jsonResponse({ error: "계정 또는 복구 코드가 올바르지 않거나 만료되었습니다." }, 400, origin);
      }
      const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (passwordError) {
        return jsonResponse({ error: "비밀번호 변경에 실패했습니다. 복구 코드를 새로 발급받아야 합니다." }, 500, origin);
      }
      return jsonResponse({ ok: true }, 200, origin);
    }

    if (!passwordIsValid(password)) {
      return jsonResponse({ error: "비밀번호는 8~72바이트로 입력해 주세요." }, 400, origin);
    }

    if (action === "register") {
      const code = typeof input?.adminClaimCode === "string" ? input.adminClaimCode.trim() : "";
      const isReserved = nickname.includes("인증됨");
      if (isReserved) {
        return jsonResponse({ error: "‘인증됨’은 닉네임에 넣을 수 없고 관리자에게만 별도 배지로 표시됩니다." }, 400, origin);
      }
      if (ADMIN_INITIAL_NAMES.has(nickname) && code.length < 20) {
        return jsonResponse({ error: "이 관리자 계정은 1회용 관리자 초대코드가 필요합니다." }, 400, origin);
      }
      if (!await allowRequest(request, "register")) {
        return jsonResponse({ error: "가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, 429, origin);
      }

      // A reserved, non-routable email lets Supabase Auth hash and verify passwords
      // without asking the player for an email address or exposing a service key.
      const loginKey = nickname.toLocaleLowerCase("ko-KR");
      const { data: existingLogin, error: existingLoginError } = await admin.from("roomchat_profiles")
        .select("id")
        .ilike("login_nickname", loginKey.replace(/[\\%_]/gu, (char) => "\\" + char))
        .maybeSingle();
      if (existingLoginError || existingLogin) {
        return jsonResponse({ error: "이 진짜 닉네임은 사용할 수 없습니다. 다른 이름을 선택해 주세요." }, 400, origin);
      }

      const email = `u_${crypto.randomUUID().replaceAll("-", "")}@accounts.roomchat.invalid`;
      const userMetadata: Record<string, unknown> = {
        nickname,
        login_nickname: nickname,
      };
      if (ADMIN_INITIAL_NAMES.has(nickname)) userMetadata.admin_claim_code = code;

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { roomchat_managed: true },
        user_metadata: userMetadata,
      });
      if (createError || !created.user) {
        // Do not reveal whether a username or one-time administrator invitation exists.
        return jsonResponse({ error: "계정을 만들지 못했습니다. 닉네임이나 초대코드를 확인해 주세요." }, 400, origin);
      }

      const { data: profileData, error: profileError } = await admin.rpc("roomchat_materialize_auth_profile", {
        p_user_id: created.user.id,
      });
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      if (profileError || !profile) {
        return jsonResponse({ error: "계정은 만들어졌지만 프로필 설정을 마치지 못했습니다. 잠시 후 로그인해 주세요." }, 500, origin);
      }

      const session = await makeSession(email, password);
      if (!session) return jsonResponse({ error: "계정은 만들어졌지만 로그인에 실패했습니다. 다시 로그인해 주세요." }, 500, origin);
      return jsonResponse({ session, nickname: profile.nickname, loginNickname: profile.login_nickname, isVerified: profile.is_verified }, 200, origin);
    }

    if (action === "login") {
      if (!await allowRequest(request, "login")) {
        return jsonResponse({ error: "로그인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, 429, origin);
      }
      const nicknameKey = nickname.toLocaleLowerCase("ko-KR").replace(/[\\%_]/gu, (char) => "\\" + char);
      const { data: profile, error: profileError } = await admin.from("roomchat_profiles")
        .select("id,nickname,login_nickname,is_verified")
        .ilike("login_nickname", nicknameKey)
        .maybeSingle();
      if (profileError || !profile) return jsonResponse({ error: "닉네임 또는 비밀번호가 올바르지 않습니다." }, 401, origin);
      const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.id);
      const email = userResult?.user?.email;
      if (userError || !email) return jsonResponse({ error: "닉네임 또는 비밀번호가 올바르지 않습니다." }, 401, origin);
      const session = await makeSession(email, password);
      if (!session) return jsonResponse({ error: "닉네임 또는 비밀번호가 올바르지 않습니다." }, 401, origin);
      return jsonResponse({ session, nickname: profile.nickname, loginNickname: profile.login_nickname, isVerified: profile.is_verified }, 200, origin);
    }

    return jsonResponse({ error: "요청 유형을 확인해 주세요." }, 400, origin);
  } catch (_error) {
    // Never write passwords, invitation codes, or forwarded IP addresses to function logs.
    return jsonResponse({ error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, origin);
  }
});
