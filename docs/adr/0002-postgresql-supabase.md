# ADR-0002: PostgreSQL (Supabase) thay Google Sheet

- Ngày: 2026-11-17 · Trạng thái: Đã chấp nhận

## Bối cảnh
- Khối lượng: 20 nhân viên × 80 dòng/ngày ≈ 41.600 dòng/tháng, ≈ 500.000 dòng/năm (phỏng vấn phạm vi v2, 28/10/2026).
- Đo tốc độ hệ thống cũ (09–10/11/2026): Thống kê kỳ này, KPI tạm tính, Đối soát KPI, Báo cáo tháng/quý mất 6–14 s, vượt ngưỡng 3–5 s; thời gian tăng theo độ dài khoảng ngày.
- Tab KPI dự kiến chạm giới hạn 10 triệu ô của Google Sheet khoảng cuối 2028.

## Quyết định
PostgreSQL trên Supabase; migration bằng Supabase CLI (SQL thuần); File storage bằng Supabase Storage (bucket private). RLS bật mọi bảng, mặc định chặn hết; phân quyền chính ở backend.

## Hệ quả
- Tổng hợp theo kỳ bằng index và `GROUP BY`; constraint, trigger, transaction.
- Phải chuyển dữ liệu một lần (`tools/sheets-migration`) và tự lo backup 3 lớp.
- [Cần kiểm tra] Gói trả phí, vùng đặt dữ liệu và yêu cầu pháp lý về lưu dữ liệu cá nhân.
