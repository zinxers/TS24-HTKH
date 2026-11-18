# ADR-0008: Đăng nhập email + mật khẩu tự quản, phiên trong DB

- Ngày: 2026-11-18
- Trạng thái: Đã chấp nhận
- Người quyết định: Trưởng phòng HTKH

## Bối cảnh
Mốc 2b cần đăng nhập cho web và cửa sổ Tauri (cùng tên miền, cookie `httpOnly`). Hệ thống cũ HTKH-KPI dùng email + mật khẩu, khóa tài khoản sau nhiều lần sai, phiên hết sau 6 giờ không thao tác. Chưa có màn quản lý tài khoản, chưa có luồng đổi mật khẩu. Spec: `docs/superpowers/specs/2026-11-18-moc-2b-dang-nhap-design.md`.

## Quyết định
- **Mật khẩu**: argon2id qua `crypto.argon2` của Node 26 (m = 19456 KiB, t = 2, p = 1, salt 16 byte, tag 32 byte, chuỗi PHC), so sánh `timingSafeEqual`. Độ dài 8–128 ký tự khi đặt. Email không có vẫn chạy băm giả (`DUMMY_HASH`) và trả cùng câu báo với sai mật khẩu.
- **Nhập sai**: sai 10 lần → tạm chặn 15 phút (`app_user.login_blocked_until`), tự hết. Đếm tăng nguyên tử trong một câu `update … returning`; chỉ về 0 khi đăng nhập đúng. `status = 'locked'` chỉ do quản lý đặt, kiểm sau khi đúng mật khẩu.
- **Phiên**: bảng `user_session`. Cookie `__Host-ts24-htkh-session` chứa token ngẫu nhiên 32 byte (base64url); DB chỉ lưu `HMAC-SHA256(SESSION_SECRET, token)`. Hết hạn sau 6 giờ không thao tác; gia hạn tối đa mỗi 5 phút một lần ghi DB.
- **Cookie**: `HttpOnly; Secure; SameSite=Lax; Path=/`, không `Max-Age`, không `Domain`. Chống CSRF bằng `SameSite=Lax` + mọi thao tác ghi chỉ qua `POST/PUT/PATCH/DELETE`.
- **API**: `requireUser()` (`apps/web/src/app/api/v1/_lib/require-user.ts`) là bước đầu của mọi route có xác thực; lỗi qua `handle()` chung. `proxy.ts` ở lớp giao diện chỉ gợi ý điều hướng theo cookie có/không.
- **Transaction nhiều repository**: service nhận `UnitOfWork` qua constructor; `container.ts` cài bằng `Database.transaction`.
- **Mật khẩu ban đầu**: CLI `tools/set-password` cho người vận hành (`docs/runbooks/dat-mat-khau.md`). Seed local có bản băm của mật khẩu dev công khai `matkhau-dev-ts24`.

## Hệ quả
- **Ngoại lệ quyền DB**: `ts24_app` có `delete` trên `user_session` (duy nhất; các bảng khác vẫn không `delete`). Phiên là dữ liệu tạm, đăng xuất xóa hẳn dòng.
- **Ngoại lệ `requireUser()`**: ngoài `POST /auth/login`, route `POST /auth/logout` cũng không gọi `requireUser()`, để phiên đã hết hạn vẫn xóa được cookie.
- Cookie không `Max-Age`: đóng trình duyệt hoặc app là mất phiên, mở lại phải đăng nhập lại. Hạn thật do DB giữ.
- **Đổi `SESSION_SECRET` = đăng xuất mọi người** (mọi hash trong `user_session` không còn khớp). Web và `tools/set-password` phải dùng cùng giá trị.
- Đăng xuất, khóa tài khoản, đặt lại mật khẩu cắt phiên ngay (xóa dòng hoặc kiểm `status` mỗi request).
- Câu "Nhập sai quá nhiều lần" cho người đoán biết email có tài khoản (sau 10 lần thử). Chấp nhận vì email công ty dễ đoán; hệ thống cũ cũng vậy.
- Không giới hạn tổng thời gian sống của phiên (giống cũ).
- `tools/set-password` chạy bằng `tsx --conditions=react-server` (thêm dependency `tsx` cho tool này) vì `core`/`db` có `server-only` và mã TypeScript cần biên dịch khi chạy. `pnpm-workspace.yaml` đặt `allowBuilds: esbuild: false` để `pnpm install --frozen-lockfile` không lỗi và không chạy build script của esbuild.
- Sơ đồ phụ thuộc giữ nguyên: `.dependency-cruiser.cjs` không đổi. Hằng `SESSION_COOKIE` đặt ở `@ts24-htkh/shared` để `proxy.ts` dùng được.

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| Sai N lần → `status = 'locked'` vĩnh viễn | Chưa có màn mở khóa; kẻ xấu có thể cố ý khóa tài khoản người khác |
| Cookie ký stateless (không bảng phiên) | Không cắt phiên ngay khi đăng xuất/khóa/đặt lại mật khẩu; mỗi request vẫn phải đọc `app_user` |
| Phiên 12 giờ cố định; 30 ngày trượt | Khác hệ thống cũ (6 giờ không thao tác) |
| Mật khẩu tạm + bắt đổi | Cần luồng đổi mật khẩu, ngoài phạm vi mốc này |
| scrypt | OWASP khuyên argon2id; Node 26 có sẵn, không thêm dependency |
| Chỉ API, không giao diện | Không thử được đầu tới cuối trên web và Tauri |
| Bảng đếm sai theo IP | Thêm bảng; chặn oan cả văn phòng sau một NAT |
