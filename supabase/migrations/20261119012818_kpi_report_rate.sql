-- Mốc 4: báo cáo KPI (kpi_report), đơn giá theo ngày hiệu lực (kpi_rate) và view tính tiền theo ngày gửi.
-- Danh mục kênh/phân loại phải khớp packages/shared/src/kpi.ts.

-- kpi_rate: mỗi phiên bản giá ghi đủ 11 kênh; chỉ áp dụng từ hôm nay trở đi (giờ VN).
create table public.kpi_rate (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  kenh text not null check (kenh in (
    'PI Hoàn Thành', 'PO Hoàn Thành', 'PI Nhận thông tin', 'PO Nhận thông tin',
    'Teamviewer Hoàn Thành', 'Email Nhận thông tin', 'Email Hoàn Thành',
    'Chat Nhận thông tin', 'Chat Hoàn Thành', 'Trường hợp khó', 'Chăm sóc KH'
  )),
  amount int not null check (amount between 0 and 1000000),
  created_by uuid references public.app_user (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (effective_from, kenh)
);

-- Bản mặc định chèn trước khi tạo trigger (trigger chặn ngày quá khứ).
insert into public.kpi_rate (effective_from, kenh, amount) values
  ('2000-01-01', 'PI Hoàn Thành', 1000),
  ('2000-01-01', 'PO Hoàn Thành', 1000),
  ('2000-01-01', 'PI Nhận thông tin', 600),
  ('2000-01-01', 'PO Nhận thông tin', 600),
  ('2000-01-01', 'Teamviewer Hoàn Thành', 2000),
  ('2000-01-01', 'Email Nhận thông tin', 600),
  ('2000-01-01', 'Email Hoàn Thành', 1500),
  ('2000-01-01', 'Chat Nhận thông tin', 600),
  ('2000-01-01', 'Chat Hoàn Thành', 1500),
  ('2000-01-01', 'Trường hợp khó', 4000),
  ('2000-01-01', 'Chăm sóc KH', 5000);

create function public.kpi_rate_guard() returns trigger
language plpgsql as $$
declare
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if tg_op = 'DELETE' then
    raise exception 'kpi_rate: không được xóa đơn giá';
  end if;
  if new.effective_from < today then
    raise exception 'kpi_rate: không được đặt đơn giá cho ngày đã qua';
  end if;
  if tg_op = 'UPDATE' and old.effective_from < today then
    raise exception 'kpi_rate: không được sửa đơn giá của ngày đã qua';
  end if;
  return new;
end;
$$;

create trigger kpi_rate_guard
  before insert or update on public.kpi_rate
  for each row execute function public.kpi_rate_guard();
create trigger kpi_rate_guard_delete
  before delete on public.kpi_rate
  for each row execute function public.kpi_rate_guard();
create trigger kpi_rate_set_updated_at
  before update on public.kpi_rate
  for each row execute function public.set_updated_at();

grant select, insert, update on public.kpi_rate to ts24_app;
alter table public.kpi_rate enable row level security;
create policy kpi_rate_select_ts24_app on public.kpi_rate for select to ts24_app using (true);
create policy kpi_rate_insert_ts24_app on public.kpi_rate for insert to ts24_app with check (true);
create policy kpi_rate_update_ts24_app on public.kpi_rate for update to ts24_app using (true) with check (true);
revoke all on public.kpi_rate from anon, authenticated;

-- kpi_report: họ tên và team chụp lúc gửi. row_id unique TOÀN BẢNG (không partial):
-- dòng đã xóa mềm gửi lại cũng không được tạo lại.
create table public.kpi_report (
  id uuid primary key default gen_random_uuid(),
  row_id text not null unique check (row_id ~ '^[A-Za-z0-9-]{8,64}$'),
  user_id uuid not null references public.app_user (id) on delete restrict,
  full_name text not null,
  team_id uuid references public.team (id) on delete restrict,
  ticket text not null check (ticket ~ '^TICKET/[0-9]+$'),
  kenh text not null check (kenh in (
    'PI Hoàn Thành', 'PO Hoàn Thành', 'PI Nhận thông tin', 'PO Nhận thông tin',
    'Teamviewer Hoàn Thành', 'Email Nhận thông tin', 'Email Hoàn Thành',
    'Chat Nhận thông tin', 'Chat Hoàn Thành', 'Trường hợp khó', 'Chăm sóc KH'
  )),
  phan_loai text not null check (phan_loai in (
    'Hỗ trợ sử dụng', 'Cấu hình phần mềm', 'Lỗi hệ thống, lỗi tích hợp'
  )),
  noi_dung text not null check (char_length(noi_dung) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.app_user (id) on delete restrict,
  delete_reason text,
  check ((deleted_at is null) = (delete_reason is null))
);

create index ix_kpi_report_user_created on public.kpi_report (user_id, created_at);

create function public.kpi_report_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'kpi_report: không được xóa cứng báo cáo';
  end if;
  if (to_jsonb(new) - 'deleted_at' - 'deleted_by' - 'delete_reason' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'deleted_at' - 'deleted_by' - 'delete_reason' - 'updated_at') then
    raise exception 'kpi_report: chỉ được sửa cột xóa mềm';
  end if;
  return new;
end;
$$;

create trigger kpi_report_guard
  before update on public.kpi_report
  for each row execute function public.kpi_report_guard();
create trigger kpi_report_guard_delete
  before delete on public.kpi_report
  for each row execute function public.kpi_report_guard();
create trigger kpi_report_set_updated_at
  before update on public.kpi_report
  for each row execute function public.set_updated_at();

grant select, insert, update on public.kpi_report to ts24_app;
alter table public.kpi_report enable row level security;
create policy kpi_report_select_ts24_app on public.kpi_report for select to ts24_app using (true);
create policy kpi_report_insert_ts24_app on public.kpi_report for insert to ts24_app with check (true);
create policy kpi_report_update_ts24_app on public.kpi_report for update to ts24_app using (true) with check (true);
revoke all on public.kpi_report from anon, authenticated;

-- Đơn giá theo ngày gửi giờ VN: phiên bản có effective_from lớn nhất <= report_date.
create view public.kpi_report_priced with (security_invoker = true) as
select r.*, d.report_date, rate.amount
from public.kpi_report r
cross join lateral (select (r.created_at at time zone 'Asia/Ho_Chi_Minh')::date as report_date) d
cross join lateral (
  select amount from public.kpi_rate
  where kenh = r.kenh and effective_from <= d.report_date
  order by effective_from desc limit 1
) rate
where r.deleted_at is null;

grant select on public.kpi_report_priced to ts24_app;
revoke all on public.kpi_report_priced from anon, authenticated;

revoke execute on function public.kpi_rate_guard() from public, anon, authenticated;
revoke execute on function public.kpi_report_guard() from public, anon, authenticated;
