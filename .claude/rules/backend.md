---
paths:
  - "packages/core/**"
---

# Backend (`@ts24-htkh/core`)

| Class | Được làm | Không được làm |
|---|---|---|
| Entity | Giữ dữ liệu và quy tắc của chính nó (`isHead()`, `canBeDeleted()`) | Gọi DB, gọi HTTP |
| Policy | Trả lời "người này có được làm việc này không", ném `ForbiddenError` | Ghi dữ liệu |
| Service | Điều phối: kiểm quyền → xử lý → ghi trong transaction → ghi `audit_log` | Biết về request/response HTTP |

- Mỗi module ở `src/modules/<nghiệp vụ>/`: `*.entity.ts` (khi có luật riêng của đối tượng), `*.service.ts`, `*.policy.ts`, `*.dto.ts`, test cùng thư mục.
- Phụ thuộc (repository, storage, client ngoài) truyền qua constructor; chỉ `src/container.ts` được `new` các phụ thuộc thật.
- Ma trận quyền ở `src/policies/permissions.ts`. Mỗi action có test cho tài khoản được phép và tài khoản bị chặn.
- Không import `react`, `next`, `@ts24-htkh/platform`. Đầu file dùng `import 'server-only'` ở điểm vào package.
- Test service bằng repository giả (class cài cùng interface), không cần DB.
- Env đọc và kiểm tra ở `src/config/env.ts`; thiếu biến thì dừng lúc khởi động.
- TS24 (`src/integrations/ts24/`): không lưu/log mật khẩu; `session_id` mã hóa, chỉ ở server; hết phiên ném lỗi mã `TS24_AUTH`; không tự gửi lại lệnh tạo ticket.
