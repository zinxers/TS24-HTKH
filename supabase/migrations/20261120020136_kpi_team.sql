-- Tên ngắn của team (tab và tiêu đề cột KPI theo team)
alter table public.team add column short_name text;

update public.team set short_name = 'TaxOnline' where name = 'Thuế, Kế toán và Hệ thống quản lý';
update public.team set short_name = 'iBHXH' where name = 'Bảo hiểm xã hội và Quản lý nhân sự';
update public.team set short_name = 'iXHD' where name = 'Hóa đơn điện tử, Hải quan và Chuyển đổi số';

do $$
begin
  if exists (select 1 from public.team where short_name is null) then
    raise exception 'team thiếu short_name';
  end if;
end $$;

alter table public.team alter column short_name set not null;
alter table public.team add constraint team_short_name_len check (char_length(short_name) between 1 and 20);
create unique index ux_team_short_name on public.team (short_name);

-- Index cho báo cáo KPI theo team và cả phòng
create index ix_kpi_report_team_created on public.kpi_report (team_id, created_at);
create index ix_kpi_report_created on public.kpi_report (created_at);
