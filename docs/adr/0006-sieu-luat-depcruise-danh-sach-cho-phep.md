# ADR-0006: Siết luật dependency-cruiser thành danh sách cho phép

- Ngày: 2026-11-17
- Trạng thái: Đã chấp nhận
- Người quyết định: Trưởng phòng HTKH

## Bối cảnh
Review Mốc 0 (PR #1) dựng file mẫu và thấy luật cũ trong `.dependency-cruiser.cjs` để lọt các import trái `docs/architecture.md` mục 2:
- File App Router ngoài `(pages)` và `api` (`error.tsx`, `layout.tsx`, `middleware.ts`...) import được `core`, `db`.
- `api` import được `xlsx-report`, `platform`.
- `db`, `storage`, `xlsx-report` import lẫn nhau được; `core` import được `platform`; `platform` import được `shared`.
- `import type` không bị kiểm (`tsPreCompilationDeps` tắt).

## Quyết định
- Mỗi lớp có một luật dạng **danh sách cho phép**: mọi package nội bộ ngoài danh sách đều bị chặn, đúng theo mục 2 của `docs/architecture.md`.
- Mọi file trong `apps/web/src` không thuộc `app/api/` được coi là lớp giao diện.
- Bật `tsPreCompilationDeps` để kiểm cả `import type`.
- Mỗi luật có test bằng file mẫu ở `tests/depcruise-rules.test.ts` (trường hợp bị chặn và trường hợp hợp lệ).
- Đổi tên luật cho khớp nội dung: `api-chi-goi-core-shared`, `core-chi-goi-tang-duoi`, `tang-duoi-chi-goi-shared`, `platform-khong-phu-thuoc`; luật `tang-duoi-khong-goi-core` được gộp vào hai luật sau.

## Hệ quả
- Sơ đồ phụ thuộc không đổi; chỉ công cụ kiểm tra khớp với sơ đồ chặt hơn.
- Thêm một package hoặc cho phép một mũi tên mới phải sửa danh sách trong luật, có ADR.
- Chưa kiểm: phần `react|next` của luật `core-khong-ui` chưa có hiệu lực vì script chỉ giữ các module trong `src/` (`--include-only`); chặn thay bằng `dependencies` và `tests/workspace-deps.test.ts`.
- Cần cập nhật Whiteboard (người dùng).

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| Giữ luật dạng danh sách cấm, vá từng lỗ | Mỗi package hoặc file Next mới lại có thể lọt; khó chứng minh đủ |
| Chỉ dựa vào `dependencies` của package (pnpm chặn import ké) | Không phân biệt được giao diện và API trong cùng `apps/web` |
