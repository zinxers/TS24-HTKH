# Runbook: môi trường staging

Dành cho người vận hành. Staging chỉ chứa **dữ liệu giả**; không chép dữ liệu thật vào đây khi chưa được yêu cầu.

## 1. Thành phần

| Thành phần | Giá trị |
|---|---|
| Supabase project | `ts24-htkh-staging` (ref `uakaccibucgboyhbzyzt`), vùng `ap-southeast-1`, gói free |
| Kết nối của app | role `ts24_app` qua Supavisor transaction pooler: `aws-1-ap-southeast-1.pooler.supabase.com:6543`, user `ts24_app.uakaccibucgboyhbzyzt` |
| Vercel project | `ts24-htkh` (team `zinxers`), nối repo `zinxers/TS24-HTKH`, Root Directory `apps/web`, Framework Next.js, function `sin1` |
| URL | `https://ts24-htkh-staging.vercel.app` (alias), `https://ts24-htkh-zinxers.vercel.app` (production của project) |
| Bảo vệ | Vercel Authentication bật cho domain `*.vercel.app`: phải đăng nhập Vercel bằng tài khoản trong team mới mở được |

Host `db.<ref>.supabase.co` (kết nối trực tiếp) chỉ có IPv6, Vercel không gọi được: luôn dùng pooler. Client DB đã đặt `prepare: false` cho transaction mode.

## 2. Biến môi trường trên Vercel

Chỉ hai biến bắt buộc (`packages/core/src/config/env.ts`), kiểu **Sensitive**, cho Production và Preview:

- `DATABASE_URL`: `postgresql://ts24_app.uakaccibucgboyhbzyzt:<mật khẩu ts24_app>@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`
- `SESSION_SECRET`: tạo theo `dat-mat-khau.md` mục 1, giá trị riêng của staging.

Không có biến nào mang tiền tố `NEXT_PUBLIC_`. Giá trị không ghi vào repo, log hay chat.

### Đổi mật khẩu `ts24_app`

1. Supabase → SQL Editor: `alter role ts24_app with login password '<mật khẩu mới>';`
2. Cập nhật `DATABASE_URL` trên Vercel (Production và Preview).
3. Deploy lại để function nhận biến mới.

## 3. Migration

Vercel tự deploy mỗi lần push `main`, nhưng **không tự chạy migration**. Mỗi PR có file mới trong `supabase/migrations/`:

1. Merge PR (migration phải tương thích ngược với code đang chạy: expand → contract).
2. Chạy từng file mới theo thứ tự trên staging (Supabase SQL Editor, hoặc `supabase db push` sau khi `supabase link --project-ref uakaccibucgboyhbzyzt`).
3. Không sửa migration đã chạy trên staging; cần đổi thì tạo file mới.

Kiểm RLS sau mỗi migration (phải ra 0):

```sql
select count(*) from pg_tables t join pg_class c on c.relname = t.tablename
where t.schemaname = 'public' and not c.relrowsecurity;
```

## 4. Dữ liệu giả

`supabase/seed.sql` viết cho local: nó đặt mật khẩu dev công khai cho mọi tài khoản và mật khẩu `ts24_app_dev` cho role `ts24_app`. **Không chạy nguyên file trên staging.** Khi dựng lại staging chỉ chạy phần tạo tài khoản `@example.com` và 40 dòng KPI giả; mật khẩu tài khoản đặt bằng `dat-mat-khau.md` mục 2 (trỏ `DATABASE_URL` staging).

## 5. Dựng lại từ đầu

1. Tạo Supabase project mới (vùng `ap-southeast-1`), chạy toàn bộ `supabase/migrations/` theo thứ tự, kiểm RLS (mục 3).
2. Đặt mật khẩu `ts24_app` (mục 2), nạp dữ liệu giả (mục 4).
3. Vercel: project nối repo, Root Directory `apps/web`, hai biến môi trường (mục 2), deploy `main`.
4. Cập nhật bảng mục 1 nếu ref, host hay URL đổi.
