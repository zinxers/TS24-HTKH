-- Mốc 3: nhật ký thao tác (audit_log) và luật đúng một Trưởng phòng cho bàn giao.

-- audit_log: chỉ thêm, không sửa, không xóa.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.app_user (id) on delete restrict,
  action text not null,
  target_id uuid references public.app_user (id) on delete restrict,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_audit_log_target_created on public.audit_log (target_id, created_at desc);

create trigger audit_log_set_updated_at
  before update on public.audit_log
  for each row execute function public.set_updated_at();

grant select, insert on public.audit_log to ts24_app;

alter table public.audit_log enable row level security;

create policy audit_log_select_ts24_app on public.audit_log
  for select to ts24_app using (true);
create policy audit_log_insert_ts24_app on public.audit_log
  for insert to ts24_app with check (true);

revoke all on public.audit_log from anon, authenticated;

-- Bỏ luật "không được đổi vai trò Trưởng phòng" (bàn giao cần hạ Trưởng phòng cũ);
-- luật đúng một Trưởng phòng chuyển sang constraint trigger hoãn bên dưới.
create or replace function public.app_user_guard_update() returns trigger
language plpgsql as $$
begin
  if new.email is distinct from old.email then
    raise exception 'app_user: không được đổi email (tạo tài khoản mới, khóa tài khoản cũ)';
  end if;
  if old.role = 'head' and new.deleted_at is not null and old.deleted_at is null then
    raise exception 'app_user: không được xóa Trưởng phòng';
  end if;
  if old.role = 'head' and new.status = 'locked' then
    raise exception 'app_user: không được khóa Trưởng phòng';
  end if;
  return new;
end;
$$;

-- Kiểm lúc commit, nên hạ người cũ rồi nâng người mới trong cùng transaction là hợp lệ.
-- ux_one_head vẫn chặn hai Trưởng phòng ở mọi thời điểm.
create function public.app_user_exactly_one_head() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'UPDATE' and old.role = 'head') or new.role = 'head' then
    if (select count(*) from public.app_user where role = 'head' and deleted_at is null) <> 1 then
      raise exception 'app_user: phải có đúng một Trưởng phòng';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger app_user_exactly_one_head
  after insert or update on public.app_user
  deferrable initially deferred
  for each row execute function public.app_user_exactly_one_head();

revoke execute on function public.app_user_exactly_one_head() from public, anon, authenticated;
