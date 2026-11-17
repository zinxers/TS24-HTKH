# TS24-HTKH

Hệ thống báo cáo hỗ trợ khách hàng của Phòng HTKH, Công ty CP TS24: web (Next.js) và app desktop Windows (Tauri 2), monorepo pnpm + Turborepo, PostgreSQL. Người dùng giao tiếp bằng tiếng Việt.
**Dự án mới hoàn toàn, repo riêng `ts24-htkh`**, thay thế dần hệ thống cũ HTKH-KPI (Google Apps Script + Google Sheet).

Kiến trúc (nguồn chuẩn, đọc trước khi thiết kế hay thêm file): @docs/architecture.md
Quyết định kiến trúc: `docs/adr/` · Thuật ngữ: `docs/GLOSSARY.md` · Spec: `docs/specs/` · Vận hành: `docs/runbooks/`.
Quy tắc riêng theo vùng code nằm trong `.claude/rules/` (tự nạp khi làm việc với file tương ứng).

## Vai trò và cách làm việc (bắt buộc)

Claude là chuyên gia hỗ trợ làm việc cùng người dùng. Người dùng là người quyết định.

- Trước mỗi bước lớn (thiết kế, đổi kiến trúc, sửa nhiều file, migration, merge, deploy, phát hành desktop): nêu việc sẽ làm và đề xuất, chờ người dùng đồng ý.
- Có nhiều phương án: nêu ngắn ưu/nhược, đề xuất một phương án, để người dùng chọn.
- Giao diện: cho xem mẫu trước khi làm và cho xem lại sau khi làm (web desktop, web 375px, app Tauri). Chỉ xong khi người dùng duyệt.
- Dừng ở mỗi mốc kiểm tra được. Sau mỗi phần việc: tóm tắt đã làm gì, chưa kiểm tra gì, người dùng cần tự kiểm tra gì.
- Phân biệt rõ sự thật, giả định và ý kiến khi báo cáo.
- Không làm được bước nào trong plan thì báo ngay, không âm thầm dời về cuối.
- Thay đổi kiến trúc (thêm package, đổi quy tắc phụ thuộc, đổi công nghệ): viết ADR mới trong `docs/adr/`, cập nhật `docs/architecture.md` và `.dependency-cruiser.cjs` trong cùng PR, rồi nhắc người dùng cập nhật Whiteboard.

## Quan hệ với hệ thống cũ HTKH-KPI (bắt buộc)

Hệ thống cũ phải **tiếp tục chạy bình thường** cho tới khi TS24-HTKH được nghiệm thu (xem `docs/adr/0005-chay-song-song-he-thong-cu.md`).

- **Không sửa, không commit, không `clasp push`, không deploy repo cũ** (`D:\Downloads\AI\HTKH-KPI`) từ dự án này. Sửa lỗi bản cũ làm trong repo cũ.
- Repo cũ chỉ để **tham khảo**: quy tắc nghiệp vụ, test (`app/tests/*.test.js`), mẫu xlsx. Chuyển quy tắc sang thì chuyển kèm test và ghi nguồn trong `docs/specs/`.
- Google Sheet `HTKH-KPI-data` chỉ được **đọc** (bởi `tools/sheets-migration`), không bao giờ ghi.
- Không dùng chung tài khoản dịch vụ, khóa hay secret giữa hai hệ thống.
- Tên miền, tên app, tên package dùng `ts24-htkh`, không dùng lại `htkh-kpi`.
- Chép dữ liệu thật, chạy song song, chuyển hẳn: chỉ làm khi người dùng yêu cầu.

## Lệnh (chạy ở thư mục gốc)

| Việc | Lệnh |
|---|---|
| Cài đặt | `pnpm install` (CI: `pnpm install --frozen-lockfile`) |
| Chạy DB local | `supabase start` (dữ liệu giả từ `supabase/seed.sql`) |
| Chạy web | `pnpm turbo dev --filter=@ts24-htkh/web` → http://localhost:3000 |
| Chạy desktop | `pnpm --filter @ts24-htkh/desktop tauri dev` (cần Rust + MSVC + WebView2) |
| Kiểm tra toàn repo | `pnpm turbo lint typecheck test` |
| Chỉ phần bị ảnh hưởng | `pnpm turbo lint typecheck test --filter=...[origin/main]` |
| Kiểm ranh giới lớp | `pnpm depcruise` |
| Kiểm RLS | `pnpm check:rls` |
| Tạo migration | `supabase migration new <ten_ngan>` |
| Chạy lại DB từ đầu | `supabase db reset` (chỉ local) |
| Sinh type từ DB | `pnpm --filter @ts24-htkh/db gen:types` |
| Build web | `pnpm turbo build --filter=@ts24-htkh/web` |
| Thêm dependency | `pnpm add <pkg> --filter <tên package>` |

## Quy ước chung

- TypeScript `strict` toàn repo. Package nội bộ tên `@ts24-htkh/<tên>`, phụ thuộc nội bộ khai báo `"workspace:*"`.
- Đặt code đúng lớp theo `docs/architecture.md`; `pnpm depcruise` phải sạch. Không nới luật depcruise để code chạy được.
- OOP: Entity · Repository · Policy · Service · Route handler, mỗi class một vai trò (chi tiết trong `.claude/rules/`). Phụ thuộc truyền qua constructor, nối ở `packages/core/src/container.ts`. Logic thuần (tính kỳ, tuần lịch) là hàm thuần trong `@ts24-htkh/shared`.
- Lỗi dùng class chung: `AuthError` (401), `ForbiddenError` (403), `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409). Thông báo tiếng Việt, không lộ stack hay SQL.
- Ngày giờ trả về client là chuỗi ISO 8601; hiển thị theo `Asia/Ho_Chi_Minh`.
- Một file vượt khoảng 300 dòng thì tách theo nghiệp vụ.

## Bảo mật (luôn áp dụng)

- **Secrets không bao giờ nằm trong code, test, log, commit hay file cài desktop.** Local: `.env.local` (gitignore). Vercel/GitHub: biến môi trường, Secrets. `.env.example` chỉ có tên biến.
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SESSION_SECRET`, thông tin TS24 chỉ ở server, không bao giờ có tiền tố `NEXT_PUBLIC_`. Lộ key: đổi key ngay.
- **Frontend chỉ là gợi ý, backend mới là luật.** Mọi route (trừ đăng nhập) gọi `requireUser()`; mọi thao tác ghi gọi Policy trong Service.
- Đăng nhập bằng cookie `httpOnly`, `Secure`, `SameSite=Lax`, dùng chung cho web và cửa sổ Tauri.
- Thay đổi xác thực, phân quyền, RLS, CSP, capabilities Tauri, chia sẻ dữ liệu: hỏi người dùng trước.

## Quy tắc nghiệp vụ (giữ từ hệ thống cũ)

- **Kỳ TS24:** tuần = thứ Sáu tuần trước → hết thứ Năm; tháng N = ngày 16 tháng N-1 → hết ngày 15 tháng N; quý cố định (Quý 4 = 16/09 → 15/12, Quý 1 = 16/12 năm trước → 15/03). Chỉ tính bằng `@ts24-htkh/shared` (`period`, `quarter`).
- **Lịch làm việc:** tuần lịch = thứ Hai → thứ Bảy; tháng N gồm các tuần có thứ Sáu nằm trong tháng dương lịch N. Chỉ Trưởng phòng sửa và công bố.
- **Đúng một Trưởng phòng** (unique index `ux_one_head`); tài khoản Trưởng phòng không xóa được.
- **Email là ID cố định:** trigger chặn đổi email; cần email khác thì tạo tài khoản mới, khóa tài khoản cũ.
- Phó phòng phụ trách team được cấp vai trò `manager` của team đó.
- Thao tác tài khoản chỉ ghi `app_user` và `audit_log`, không thay đổi `kpi_report`. Báo cáo lưu họ tên và team tại lúc gửi.
- Báo cáo WR/MR/QR: `@ts24-htkh/xlsx-report` điền mẫu gốc bằng sửa XML ô, giữ nguyên định dạng; Quản lý ký `PP.`, Trưởng phòng ký `TP.`.
- Mọi thao tác thay đổi dữ liệu trên giao diện qua `ConfirmDialog`, trừ thao tác chỉ thêm dòng trống. Thao tác chỉ xem không hỏi.
- **TS24:** không lưu/log mật khẩu TS24; `session_id` chỉ ở server, mã hóa; hết phiên trả `TS24_AUTH`; không bao giờ tự gửi lại lệnh tạo ticket.

## Git và GitHub

- Trước khi sửa code: `git status` sạch. Mỗi thay đổi một nhánh `feat/...`, `fix/...`, `chore/...`.
- Conventional Commits, scope là package: `feat(core): soft delete tài khoản`.
- Không push thẳng `main`; mọi thay đổi qua PR, CI đạt, ít nhất 1 review.
- Commit `pnpm-lock.yaml` cùng thay đổi dependency. Không commit `.env*` (trừ `.env.example`), dữ liệu thật, file backup, `src-tauri/target/`.
- Kiểu xuống dòng LF.

## Tiêu chí hoàn thành

1. `pnpm turbo lint typecheck test` đạt, `pnpm depcruise` sạch, output sạch.
2. Có migration: `supabase db reset` chạy được; RLS bật cho bảng mới; đã sinh lại type.
3. Có thay đổi giao diện: chụp web (desktop, 375px) và app Tauri; người dùng đã duyệt.
4. Có thay đổi server/phân quyền: có test cho tài khoản bị chặn và tài khoản được phép.
5. Có thay đổi `apps/desktop` hoặc `packages/platform`: chạy thử `tauri dev` trên Windows.
6. Có ít nhất một lượt review (subagent reviewer hoặc `/code-review`) trước khi báo xong.
7. Báo rõ cái chưa kiểm tra được (vd chưa chạy trên staging, chưa thử Windows 10).
8. Báo cáo, recap và câu hỏi gửi người dùng viết bằng tiếng Việt.

## Lỗi đã gặp

Cập nhật khi một lỗi lặp lại 2 lần hoặc review bắt được lỗi lẽ ra phải biết. Mỗi dòng: lỗi → cách tránh.
