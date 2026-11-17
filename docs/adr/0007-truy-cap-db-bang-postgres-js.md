# ADR-0007: Truy cập DB bằng postgres.js

- Ngày: 2026-11-17
- Trạng thái: Đã chấp nhận
- Người quyết định: Trưởng phòng HTKH

## Bối cảnh
Mốc 2a dựng nền DB (PostgreSQL trên Supabase, ADR-0002) cho `packages/db`. Cần chọn thư viện để backend đọc/ghi DB và role DB mà backend dùng để kết nối. Yêu cầu: tham số hóa mọi giá trị (không ghép chuỗi), có transaction, chạy được qua pooler Supabase, ít dependency, luật nghiệp vụ quan trọng đặt cả ở DB.

## Quyết định
- Dùng `postgres` (postgres.js), SQL thuần bằng tagged template; tên bảng động chỉ qua `sql(table)`.
- Client tạo bằng `createSql(url)` với `prepare: false` (tương thích pooler transaction mode). `db` không đọc biến môi trường; URL truyền vào từ tầng trên.
- Transaction qua `Database.transaction` (`sql.begin`). Repository: `BaseRepository` (lọc `deleted_at is null`, `softDelete`), `TeamRepository`, `UserRepository`.
- Kiểu dòng lấy từ `src/types.generated.ts`, sinh bằng `pnpm --filter @ts24-htkh/db gen:types`; CI sinh lại và `git diff --exit-code` để bắt type lệch schema.
- Backend kết nối bằng role `ts24_app`: chỉ `select, insert, update` trên bảng nghiệp vụ, không `delete`, `truncate`, không sở hữu bảng. Migration tạo role `nologin`; mật khẩu và `login` đặt ngoài migration (local: `supabase/seed.sql`, giá trị dev công khai; staging/production: người vận hành đặt ngoài repo).
- RLS bật cho mọi bảng `public`, policy chỉ cho `ts24_app`; `anon`, `authenticated` không có quyền. `pnpm check:rls` kiểm trong CI.
- Bỏ quyền mặc định Supabase cấp cho `anon`, `authenticated` trên bảng, sequence, hàm mới trong `public` (`alter default privileges`), và bỏ quyền execute mặc định của PUBLIC trên hàm mới do `postgres` tạo; local đặt `auto_expose_new_tables = false`. Lý do: RLS không chặn `TRUNCATE`, view chạy bằng quyền chủ sở hữu. `check:rls` báo lỗi cả khi `anon`/`authenticated` còn bất kỳ quyền nào trên bảng hoặc view `public`. Project cloud (staging/production) cần tắt tùy chọn tự expose tương ứng.

## Hệ quả
- Nhẹ: một dependency, tham số tự động, transaction gọn.
- Kiểu kết quả gắn tay theo type sinh; sai tên cột chỉ test DB (`test:db`) bắt được, không phải typecheck.
- Test DB tách khỏi `turbo test` (`test:db`, cần `pnpm supabase start`); CI dựng Postgres trong job `check`.
- Xóa cứng bị chặn ở quyền role và trigger; dọn dữ liệu sau này cần job riêng chạy bằng role khác, có duyệt.
- Không đổi sơ đồ phụ thuộc: `docs/architecture.md`, `.dependency-cruiser.cjs` giữ nguyên.

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| Kysely + `pg` | Type đầy đủ lúc typecheck nhưng thêm 2–3 dependency và bộ sinh type riêng; SQL báo cáo phức tạp viết dài |
| `pg`, SQL thuần | Tự viết `$1`, tự quản client trong transaction |
| `supabase-js` | Đi qua REST, không có transaction |
| Drizzle | Schema TS song song với migration SQL, hai nguồn sự thật |
