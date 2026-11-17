-- Mốc 2a: bảng team, app_user, role ts24_app, RLS.

-- updated_at dùng clock_timestamp() để đổi được cả trong cùng transaction.
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- team: dữ liệu tham chiếu, không xóa.
create table public.team (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger team_set_updated_at
  before update on public.team
  for each row execute function public.set_updated_at();

insert into public.team (name, sort_order) values
  ('Thuế, Kế toán và Hệ thống quản lý', 1),
  ('Bảo hiểm xã hội và Quản lý nhân sự', 2),
  ('Hóa đơn điện tử, Hải quan và Chuyển đổi số', 3);

-- app_user
create table public.app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null,
  team_id uuid references public.team (id) on delete restrict,
  status text not null default 'active',
  password_hash text,
  failed_login_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.app_user (id) on delete restrict,
  constraint app_user_role_check check (role in ('head', 'manager', 'staff')),
  constraint app_user_status_check check (status in ('active', 'locked')),
  constraint app_user_role_team_check check ((role = 'head') = (team_id is null)),
  constraint app_user_email_normalized_check check (email = lower(btrim(email)))
);

create unique index ux_app_user_email on public.app_user (email) where deleted_at is null;
create unique index ux_one_head on public.app_user (role) where role = 'head' and deleted_at is null;

create function public.app_user_guard_update() returns trigger
language plpgsql as $$
begin
  if new.email is distinct from old.email then
    raise exception 'app_user: không được đổi email (tạo tài khoản mới, khóa tài khoản cũ)';
  end if;
  if old.role = 'head' and new.deleted_at is not null and old.deleted_at is null then
    raise exception 'app_user: không được xóa Trưởng phòng';
  end if;
  if old.role = 'head' and new.role is distinct from 'head' then
    raise exception 'app_user: không được đổi vai trò Trưởng phòng';
  end if;
  return new;
end;
$$;

create trigger app_user_guard_update
  before update on public.app_user
  for each row execute function public.app_user_guard_update();

create function public.app_user_block_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'app_user: không được xóa cứng, dùng xóa mềm (deleted_at)';
end;
$$;

create trigger app_user_block_delete
  before delete on public.app_user
  for each row execute function public.app_user_block_delete();

create trigger app_user_set_updated_at
  before update on public.app_user
  for each row execute function public.set_updated_at();

-- Role backend: nologin ở đây; login và mật khẩu đặt ngoài migration (seed.sql cho local).
do $$
begin
  if not exists (select from pg_roles where rolname = 'ts24_app') then
    create role ts24_app nologin;
  end if;
end;
$$;

grant usage on schema public to ts24_app;
grant select, insert, update on public.team, public.app_user to ts24_app;

-- RLS: chỉ ts24_app; anon và authenticated không có quyền gì.
alter table public.team enable row level security;
alter table public.app_user enable row level security;

create policy team_ts24_app on public.team
  for all to ts24_app using (true) with check (true);
create policy app_user_ts24_app on public.app_user
  for all to ts24_app using (true) with check (true);

revoke all on public.team, public.app_user from anon, authenticated;
