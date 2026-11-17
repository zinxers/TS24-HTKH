# ADR-0001: Monorepo với pnpm và Turborepo

- Ngày: 2026-11-17 · Trạng thái: Đã chấp nhận

## Bối cảnh
Cần web và app desktop Windows dùng chung một backend; logic kỳ TS24 (16 → 15, quý) được dùng ở app, script chuyển dữ liệu và test. Muốn ranh giới 5 lớp được công cụ kiểm tra, không chỉ dựa vào quy ước.

## Quyết định
Một repo `ts24-htkh`: `apps/` (web, desktop), `packages/` (core, db, storage, xlsx-report, shared, platform, config), `tools/`. pnpm workspaces quản lý package; Turborepo chạy lint/typecheck/test/build theo đồ thị phụ thuộc, có cache. dependency-cruiser kiểm quy tắc phụ thuộc trong CI.

## Hệ quả
- Ranh giới lớp do `dependencies` của từng package và depcruise kiểm soát.
- Thêm app mới (job nền, API tách riêng) không phải tổ chức lại.
- Thêm cấu hình: workspace, `turbo.json`, tsconfig chung, Vercel Root Directory, `transpilePackages`.

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| Một app Next.js, không monorepo | Ranh giới lớp chỉ là quy ước; khó dùng chung cho desktop và tools |
| npm workspaces | Không chặn import "ké", không cache tác vụ |
| Nx | Mạnh nhưng nặng cấu hình so với quy mô dự án |
