-- Mốc 6a: phần chữ báo cáo WR/MR/QR theo loại, kỳ và phạm vi (team_id null = Cả phòng).
-- version tăng 1 mỗi lần lưu, dùng để chặn ghi đè (khóa lạc quan ở Service).
create table public.report_note (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('WR', 'MR', 'QR')),
  period_start date not null,
  team_id uuid references public.team (id),
  fields jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.app_user (id),
  updated_by_name text not null,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique nulls not distinct (report_type, period_start, team_id)
);

grant select, insert, update on public.report_note to ts24_app;
alter table public.report_note enable row level security;
create policy report_note_select_ts24_app on public.report_note for select to ts24_app using (true);
create policy report_note_insert_ts24_app on public.report_note for insert to ts24_app with check (true);
create policy report_note_update_ts24_app on public.report_note for update to ts24_app using (true) with check (true);
revoke all on public.report_note from anon, authenticated;
