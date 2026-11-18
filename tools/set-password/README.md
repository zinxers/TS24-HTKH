# @ts24-htkh/set-password

Lệnh CLI cho người vận hành đặt (hoặc đặt lại) mật khẩu đăng nhập của một tài khoản. Đặt xong, mọi phiên cũ của tài khoản đó bị đăng xuất.

## Cách dùng

```powershell
pnpm --filter @ts24-htkh/set-password start <email>
```

Lệnh hỏi mật khẩu hai lần, không hiện ký tự. Mật khẩu dài 8–128 ký tự. Không truyền mật khẩu trên dòng lệnh (lệnh từ chối) để mật khẩu không nằm trong lịch sử shell.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối của role `ts24_app` |
| `SESSION_SECRET` | Cùng giá trị với web (ít nhất 32 byte) |

Local: đặt hai biến trong phiên PowerShell trước khi chạy, ví dụ lấy từ `apps/web/.env.local`:

```powershell
Get-Content apps/web/.env.local | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item "env:$k" $v }
```

Staging/production: chỉ chạy khi được duyệt, xem `docs/runbooks/dat-mat-khau.md`.

## Ghi chú kỹ thuật

Script chạy bằng `tsx --conditions=react-server` vì `core`/`db` có `import 'server-only'` (chỉ cho chạy ở điều kiện `react-server`) và mã nguồn TypeScript cần biên dịch khi chạy.
