-- Dữ liệu giả cho local. Không dùng ở staging/production.

insert into public.app_user (email, full_name, role, team_id)
values ('truong.phong@example.com', 'Nguyễn Văn Trưởng', 'head', null);

insert into public.app_user (email, full_name, role, team_id)
select v.email, v.full_name, v.role, t.id
from (values
  ('quan.ly.1@example.com', 'Trần Thị Quản Lý Một', 'manager', 1),
  ('nhan.vien.1a@example.com', 'Lê Văn Một A', 'staff', 1),
  ('nhan.vien.1b@example.com', 'Phạm Thị Một B', 'staff', 1),
  ('quan.ly.2@example.com', 'Hoàng Văn Quản Lý Hai', 'manager', 2),
  ('nhan.vien.2a@example.com', 'Vũ Thị Hai A', 'staff', 2),
  ('nhan.vien.2b@example.com', 'Đặng Văn Hai B', 'staff', 2),
  ('quan.ly.3@example.com', 'Bùi Thị Quản Lý Ba', 'manager', 3),
  ('nhan.vien.3a@example.com', 'Đỗ Văn Ba A', 'staff', 3),
  ('nhan.vien.3b@example.com', 'Ngô Thị Ba B', 'staff', 3)
) as v (email, full_name, role, sort_order)
join public.team t on t.sort_order = v.sort_order;

-- Mật khẩu dev công khai `matkhau-dev-ts24` cho mọi tài khoản seed, chỉ local.
-- Không dùng ở staging/production.
update public.app_user
set password_hash = '$argon2id$v=19$m=19456,t=2,p=1$uGYSrQkXyFahRQ77ZqF3Mw$lbcC5W8ZXk3tQEXWI33c9Op2bB8/LaqcSjy/k9Rgyt4';

-- Mật khẩu dev công khai cho role backend (chỉ local).
alter role ts24_app with login password 'ts24_app_dev';

-- KPI giả: 40 dòng rải trong ~2 kỳ tháng gần nhất, chỉ local.
insert into public.kpi_report (row_id, user_id, full_name, team_id, ticket, kenh, phan_loai, noi_dung, created_at)
select
  'seed-' || lpad(g::text, 4, '0'),
  u.id, u.full_name, u.team_id,
  'TICKET/' || (100000 + g),
  (array['PI Hoàn Thành','PO Hoàn Thành','PI Nhận thông tin','PO Nhận thông tin','Teamviewer Hoàn Thành',
         'Email Nhận thông tin','Email Hoàn Thành','Chat Nhận thông tin','Chat Hoàn Thành',
         'Trường hợp khó','Chăm sóc KH'])[1 + g % 11],
  (array['Hỗ trợ sử dụng','Cấu hình phần mềm','Lỗi hệ thống, lỗi tích hợp'])[1 + g % 3],
  'Nội dung hỗ trợ giả số ' || g,
  now() - make_interval(days => (g * 61) / 40, hours => g % 9)
from generate_series(1, 40) g
join (values (0, 'nhan.vien.1a@example.com'), (1, 'nhan.vien.2a@example.com'),
             (2, 'quan.ly.1@example.com'), (3, 'truong.phong@example.com')) v (k, email) on v.k = g % 4
join public.app_user u on u.email = v.email;

-- Phiên bản đơn giá thứ hai (quá khứ gần) để thấy đổi giá giữa kỳ; chỉ local, bỏ qua trigger.
set session_replication_role = replica;
insert into public.kpi_rate (effective_from, kenh, amount)
select current_date - 10, kenh, amount + 500
from public.kpi_rate where effective_from = '2000-01-01';
reset session_replication_role;
