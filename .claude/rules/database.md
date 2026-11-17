---
paths:
  - "packages/db/**"
  - "supabase/**"
  - "tools/sheets-migration/**"
---

# Database (PostgreSQL / Supabase)

## Migration
- Mỗi thay đổi schema là file mới: `supabase migration new <ten_ngan>`. **Không sửa migration đã chạy trên staging/production.**
- Migration đi chung PR với code dùng nó; sau đó `pnpm --filter @ts24-htkh/db gen:types` và commit `types.generated.ts`.
- Thay đổi có thể làm gãy app: expand → contract qua 2 lần deploy.
- Không chạy migration hay ghi dữ liệu trên staging/production khi người dùng chưa yêu cầu.

## Schema
- Mọi bảng có `id uuid`, `created_at`, `updated_at`; bảng cho phép xóa có `deleted_at`, `deleted_by`.
- Unique trên bảng có soft delete là partial index `where deleted_at is null`. Khóa ngoại `on delete restrict`.
- Quy tắc nghiệp vụ quan trọng đặt cả ở DB: `ux_one_head` (đúng một Trưởng phòng), trigger chặn đổi email.
- RLS bật cho **mọi** bảng trong `public` (mặc định chặn hết); `pnpm check:rls` phải sạch.

## Soft delete
- Mặc định soft delete. Hard delete chỉ qua job dọn dẹp đã duyệt, cho bảng phụ.
- `kpi_report`, `periodic_report`: soft delete, bắt buộc `delete_reason`.
- `audit_log`: chỉ thêm; revoke `update`, `delete`.
- `work_schedule`: không xóa, giữ bản nháp và bản công bố theo version.
- Yêu cầu xóa dữ liệu cá nhân: ẩn danh hóa, hỏi phòng pháp lý trước.

## Repository (`packages/db/src/repositories/`)
- Kế thừa `BaseRepository`: mọi câu đọc lọc `deleted_at is null`; `softDelete(id, actorId)`.
- Chỉ đọc/ghi một bảng (hoặc bảng phụ gắn chặt); không chứa luật nghiệp vụ.
- Câu SQL dùng tham số (`$1`), không ghép chuỗi giá trị từ input.

## sheets-migration
- Google Sheet `HTKH-KPI-data` chỉ được **đọc**. Chỉ ghi vào DB staging/local; không ghi production khi chưa được yêu cầu.
- Đối chiếu số dòng và tổng KPI theo người × kỳ sau mỗi lần chạy; lệch 0 mới đạt.
