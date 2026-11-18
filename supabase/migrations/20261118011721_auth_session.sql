-- Mốc 2b: chặn tạm khi đăng nhập sai, bảng phiên đăng nhập.

-- null = không bị chặn.
alter table public.app_user add column login_blocked_until timestamptz;

-- user_session: dữ liệu tạm, không xóa mềm; đăng xuất xóa hẳn dòng.
create table public.user_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete restrict,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_session_token_hash_key unique (token_hash)
);

create index ix_user_session_user_id on public.user_session (user_id);

create trigger user_session_set_updated_at
  before update on public.user_session
  for each row execute function public.set_updated_at();

-- Ngoại lệ duy nhất với luật "không delete" của 2a: phiên được xóa hẳn.
grant select, insert, update, delete on public.user_session to ts24_app;

alter table public.user_session enable row level security;

create policy user_session_ts24_app on public.user_session
  for all to ts24_app using (true) with check (true);

revoke all on public.user_session from anon, authenticated;
