# Runbook: đặt mật khẩu, `SESSION_SECRET`, tài khoản bị tạm chặn

Dành cho người vận hành. Quyết định nền: ADR-0008.

## 1. Tạo `SESSION_SECRET`

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- Mỗi môi trường (local, staging, production) một giá trị riêng, ít nhất 32 byte.
- Local: ghi vào `apps/web/.env.local` (đã gitignore). Staging/production: biến môi trường Vercel, GitHub Secrets. Không bao giờ đưa vào repo, log hay chat.
- Web và `tools/set-password` phải dùng **cùng** giá trị của môi trường đó.
- **Đổi `SESSION_SECRET` = đăng xuất mọi người.** Chỉ đổi khi nghi lộ, và báo trước cho nhân viên.

## 2. Đặt (hoặc đặt lại) mật khẩu cho một tài khoản

1. Đặt `DATABASE_URL` (role `ts24_app` của môi trường đó) và `SESSION_SECRET` trong phiên PowerShell. Local, lấy từ `apps/web/.env.local`:

   ```powershell
   Get-Content apps/web/.env.local | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item "env:$k" $v }
   ```

2. Chạy lệnh **trong PowerShell hoặc cmd** (Git Bash không ẩn được ký tự nên lệnh từ chối), nhập mật khẩu hai lần (không hiện ký tự):

   ```powershell
   pnpm --filter @ts24-htkh/set-password start nhan.vien@ts24.com.vn
   ```

3. Kết quả đúng: `Đã đặt mật khẩu cho <email>, các phiên cũ đã bị đăng xuất`. Mọi phiên cũ của tài khoản bị xóa; bộ đếm sai và tạm chặn về 0.

- Mật khẩu 8–128 ký tự. Không truyền mật khẩu trên dòng lệnh (lệnh từ chối).
- Gửi mật khẩu cho nhân viên qua kênh riêng, không gửi kèm email đăng nhập trong cùng tin.
- Staging/production: chỉ chạy khi Trưởng phòng yêu cầu.

## 3. Tài khoản bị tạm chặn

Triệu chứng: nhân viên thấy "Nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút" (sau 10 lần sai).

- Cách 1: chờ 15 phút rồi đăng nhập lại bằng mật khẩu đúng.
- Cách 2: quên mật khẩu → đặt lại bằng mục 2 (đồng thời bỏ chặn).

Khác với "Tài khoản đã bị khóa, liên hệ Quản lý hoặc Trưởng phòng": đó là `status = 'locked'` do quản lý đặt; đặt lại mật khẩu **không** mở khóa.

## 4. Local

Seed (`supabase/seed.sql`) đặt mật khẩu dev công khai `matkhau-dev-ts24` cho mọi tài khoản mẫu, chỉ dùng ở máy local.
