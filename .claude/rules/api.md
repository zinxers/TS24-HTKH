---
paths:
  - "apps/web/src/app/api/**"
---

# API (`/api/v1`)

- Route handler mỏng: `requireUser()` → kiểm input bằng schema zod trong `@ts24-htkh/shared` → gọi service qua `container` → trả JSON.
- Không viết SQL, không import `@ts24-htkh/db` hay `@ts24-htkh/storage`, không chứa luật nghiệp vụ.
- Lỗi đi qua một hàm `handle()` chung, ánh xạ `AppError` → mã HTTP; không trả stack hay câu SQL.
- Chỉ route đăng nhập là public; mọi route khác bắt buộc `requireUser()`.
- Đổi request/response làm gãy client: mở `/api/v2`, giữ `/v1` cho tới khi không còn dùng.
