create table if not exists roomchat_private.account_recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_sha256 text not null check (code_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table roomchat_private.account_recovery_codes enable row level security;
revoke all on table roomchat_private.account_recovery_codes from public, anon, authenticated;
grant all on table roomchat_private.account_recovery_codes to service_role;
