# ADR-0010: Tính tiền KPI bằng view SQL, `row_id` duy nhất toàn bảng, team chụp lúc gửi

- Ngày: 2026-11-19
- Trạng thái: Đã chấp nhận
- Người quyết định: Trưởng phòng HTKH

## Bối cảnh
Mốc 4 đưa báo cáo KPI lên hệ thống mới: bảng `kpi_report` (dòng ticket đã hỗ trợ) và `kpi_rate` (đơn giá theo ngày áp dụng).
Tiền KPI = số dòng theo kênh × đơn giá có hiệu lực tại **ngày gửi** dòng đó. Đơn giá đổi theo thời gian nên một kỳ có thể chứa nhiều mức giá.
Mốc sau (xem theo team, đối soát) cũng cần cộng tiền. Spec: `docs/superpowers/specs/2026-11-19-moc-4-bao-cao-kpi-design.md`; quy tắc: `docs/specs/kpi.md`.

## Quyết định
- **Tính tiền bằng view `kpi_report_priced`** (người dùng chọn phương án B ngày 2026-11-19). View gắn `report_date` (ngày VN của `created_at`) và `amount`
  (đơn giá của kênh ở phiên bản có `effective_from` lớn nhất ≤ `report_date`) vào từng dòng chưa xóa. `security_invoker = true` để RLS của bảng gốc vẫn áp dụng.
- Luật chọn đơn giá nằm ở **schema** (view trong migration), không ở repository. Repository chỉ `select … group by` trên view,
  nên quy tắc "repository không chứa luật nghiệp vụ" vẫn đúng.
- **`row_id` unique toàn bảng**, không partial. Lệch quy ước "unique là partial index chỉ trên dòng chưa xóa" và có lý do: `row_id` do client sinh để gửi lại an toàn (idempotent);
  nếu dòng đã xóa mềm cho dùng lại `row_id`, một lần gửi lại do mất mạng sẽ tạo lại dòng đã bị xóa.
- **Team chụp lúc gửi**: server điền `full_name` và `team_id` từ tài khoản trong DB tại thời điểm gửi; client không chọn. Báo cáo cũ không đổi khi người dùng chuyển team.
  Trưởng phòng gửi được, `team_id` rỗng.
- Đơn giá chỉ thêm phiên bản từ hôm nay trở đi (trigger chặn ngày đã qua và mọi delete); lưu lại cùng ngày thì thay bản của ngày đó.

## Hệ quả
- Không phải tải mọi dòng của kỳ về server; Mốc 5/6 cộng tiền trực tiếp trên DB.
- Luật tiền nằm trong schema, test bằng `pnpm --filter @ts24-htkh/db test:db` (chậm hơn test hàm thuần).
- Đổi đơn giá **áp dụng hôm nay** thì các dòng đã gửi trong hôm nay cũng tính theo giá mới (view tính theo ngày gửi). Ngày đã qua không đổi. Giữ như hệ thống cũ.
- Danh mục kênh, phân loại có hai bản (`packages/shared/src/kpi.ts` và check constraint); test DB kiểm hai bên khớp nhau.
- `pnpm check:rls` không cần sửa (quét bảng bằng `pg_tables`; view được kiểm quyền của `anon`, `authenticated`).
- Nhắc người dùng cập nhật Whiteboard "TS24-HTKH: kiến trúc monorepo" (module `kpi`, bảng `kpi_report`, `kpi_rate`, view `kpi_report_priced`).

## Phương án đã cân nhắc
| Phương án | Lý do không chọn |
|---|---|
| A. Hàm thuần trong `shared`: repository trả dòng và bảng đơn giá, hàm chọn đơn giá theo ngày rồi cộng | Phải tải mọi dòng của kỳ về server; mốc team/đối soát phải lặp lại logic cộng ở TypeScript |
| `row_id` unique partial (`where deleted_at is null`) | Cho phép tạo lại dòng đã xóa mềm khi client gửi lại cùng `row_id` |
| Cho người gửi chọn team trên từng dòng như hệ thống cũ | Dễ chọn sai team; team của người gửi lúc gửi đã đủ |
