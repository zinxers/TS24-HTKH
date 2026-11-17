---
paths:
  - "apps/web/src/app/(pages)/**"
  - "apps/web/src/components/**"
  - "apps/web/src/features/**"
  - "apps/web/src/lib/**"
---

# Frontend web

- Giao diện chỉ gợi ý quyền (ẩn/hiện nút); luật nằm ở backend. Không import `@ts24-htkh/core`, `db`, `storage`.
- Gọi API **chỉ qua** `src/lib/api-client.ts`. Không gọi Supabase trực tiếp.
- Tính năng native (lưu file, thông báo, mở link) **chỉ qua** `@ts24-htkh/platform`, không gọi `@tauri-apps/*` trực tiếp trong component.
- Mọi thao tác thay đổi dữ liệu qua `ConfirmDialog`, trừ thao tác chỉ thêm dòng trống. Thao tác chỉ xem không hỏi.
- Bộ lọc ngày dùng `@ts24-htkh/shared` (`period`, `quarter`); mặc định: Thống kê của tôi = Hôm nay; KPI tạm tính, Quản lý team = kỳ đang chạy.
- Bảng nhiều cột: đặt độ rộng cụ thể cho từng cột và `min-width` bảng = tổng; tiêu đề nhóm cột căn trái.
- Thay đổi giao diện: cho người dùng xem mẫu trước, chụp desktop + 375px + app Tauri sau khi làm, chờ duyệt.
