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
