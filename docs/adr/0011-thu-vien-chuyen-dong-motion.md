# ADR-0011: Dùng thư viện `motion` cho chuyển động giao diện

- Ngày: 2026-11-26
- Trạng thái: Đã chấp nhận
- Người quyết định: Trưởng phòng HTKH

## Bối cảnh
Mốc 8 làm lại giao diện web theo video mẫu: thanh bên thu gọn/mở rộng, ngăn kéo trên mobile, chuyển trang, hiện dần nội dung.
Cần chuyển động mượt, có hoạt ảnh thoát (exit), và tôn trọng người dùng bật "giảm chuyển động". Spec: `docs/superpowers/specs/2026-11-26-moc-8-giao-dien-moi-design.md` (mục 3 và 4.8).

## Quyết định
Chọn phương án B: CSS + React thuần cho phần đơn giản, thêm thư viện `motion` (gói `motion/react`) cho phần cần exit, layout và gesture.
Chỉ `apps/web` phụ thuộc `motion`. Giảm chuyển động bật toàn cục qua `MotionConfig reducedMotion="user"`.

## Hệ quả
- Thêm khoảng 40KB JS (gzip theo từng phần dùng đến) vào bundle web.
- Component dùng `motion` là client component (`'use client'`).
- `.dependency-cruiser.cjs` không cần đổi: luật chỉ giới hạn `packages/*`, `apps/web` được phép có dependency ngoài.
- `apps/desktop` mở URL web nên hưởng chuyển động tương tự, không thêm gì.
- Test jsdom cần stub `window.matchMedia` (đã thêm vào `vitest.setup.ts`).

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| A. CSS + React thuần | Không có hoạt ảnh thoát khi gỡ phần tử, ngăn kéo và chuyển trang phải tự viết nhiều mã định thời, dễ lỗi |
| C. Tailwind + shadcn | Đổi cả hệ thống style và thêm nhiều phụ thuộc; vượt phạm vi, lệch token hiện có trong `globals.css` |
