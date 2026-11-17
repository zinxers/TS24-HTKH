# Mốc 1: logic kỳ TS24 trong `shared` (design)

- Ngày: 2026-11-17 · Trạng thái: đã duyệt
- Nguồn: `CLAUDE.md` (Quy tắc nghiệp vụ), `docs/architecture.md`, repo cũ `HTKH-KPI` (chỉ đọc): `app/src/Pure.js`, `app/tests/period.test.js`, `app/tests/schedule.test.js`.

## Mục đích

Mọi nghiệp vụ sau (KPI, báo cáo WR/MR/QR, lịch làm việc) đều tính kỳ. Đưa logic kỳ của hệ thống cũ sang `@ts24-htkh/shared` thành hàm thuần, giữ nguyên kết quả, kèm test, để từ đây chỉ có một nơi tính kỳ.

## Mục tiêu

- Các hàm kỳ và tuần lịch trong `packages/shared` cho cùng kết quả với hệ thống cũ trên mọi ca test cũ đã chuyển sang.
- Kết quả không phụ thuộc múi giờ của nơi chạy (Vercel UTC, trình duyệt, Tauri, CI).
- `docs/specs/ky-ts24.md` ghi quy tắc và nguồn (file, tên hàm, file test cũ).
- `pnpm turbo lint typecheck test` đạt, `pnpm depcruise` sạch.

## Không làm (để mốc sau)

- `ticketBuckets`, `hourBuckets`, `reportFollowUp`, `workdaysBetween`, ngày nghỉ lễ: thuộc nghiệp vụ KPI/lịch (`core`).
- Xếp lịch thứ Bảy (`rotateSat`, `seedSat`, `placeNewSat`, `scheduleDaysOff`...), xuất Excel.
- Schema zod cho `IsoDate` ở biên API: làm khi có route đầu tiên.
- Định dạng hiển thị (`dd/mm/yyyy`): làm khi có giao diện.

## Chống mục tiêu

- Dùng `Date` (hoặc `getDay`, `getMonth`...) trong logic kỳ. `Date` chỉ được xuất hiện trong hàm đổi thời điểm → ngày VN.
- Đổi kết quả so với hệ thống cũ, kể cả nhãn "Qúy" (đúng chữ trong mẫu xlsx, ô A6).
- Thêm dependency vào `shared`.

## Ràng buộc

- `shared` không IO, không phụ thuộc package nào (`docs/architecture.md` mục 2).
- Quy tắc kỳ theo `CLAUDE.md`: tuần = thứ Sáu → hết thứ Năm; tháng N = 16/N-1 → 15/N; quý cố định (Quý 1 = 16/12 năm trước → 15/03, Quý 4 = 16/09 → 15/12). Tuần lịch: tháng N gồm các tuần có thứ Sáu nằm trong tháng dương lịch N.
- Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh`.

## Phương án (kiểu ngày)

| Phương án | Đánh đổi | Chọn |
|---|---|---|
| A. Chuỗi `"YYYY-MM-DD"` + hàm đổi thời điểm → ngày VN | Không lệch múi giờ, khớp `date` của PostgreSQL và JSON, không dependency; phải viết lại phần cộng ngày | **Có** (người dùng chọn) |
| B. Giữ `Date` như cũ | Chép nguyên văn; lệch một ngày ở mốc nửa đêm tùy nơi chạy, không ép được giờ VN trên trình duyệt | Không |
| C. `Temporal.PlainDate` | Đúng kiểu nhất; có thể cần polyfill trên trình duyệt, vẫn phải đổi sang chuỗi ở biên | Không |

## Thiết kế

Nhánh `feat/shared-ky-ts24`, một PR.

1. **`packages/shared/src/date.ts`**: kiểu `IsoDate` (chuỗi `YYYY-MM-DD` có nhãn kiểu), `isIsoDate`, cộng ngày, thứ trong tuần, và `toVnDate(instant: Date): IsoDate` (ngày theo `Asia/Ho_Chi_Minh`, dùng `Intl`). Tính toán qua số ngày kể từ mốc, không qua `Date` cục bộ.
2. **`packages/shared/src/period.ts`**: `weekPeriod`, `monthPeriod(d, offset)`, `runningMonthPeriod`, `quarterPeriod(d, offset)`, `previousPeriod`, `trendPeriods(unit, today)`, `reportPeriods(type, today)` (nhãn ô A6, `running` cho kỳ đang chạy), số tuần TS24 (tuần 1 bắt đầu thứ Sáu đầu tiên của năm). Kỳ là `{ start, end }` (hai `IsoDate`, tính cả hai đầu).
3. **`packages/shared/src/schedule-weeks.ts`**: `scheduleWeeks(month)`, `scheduleMonthOf(d)`, `scheduleMonthShift(month, n)`; tháng là chuỗi `YYYY-MM`.
4. **Test**: chuyển mọi ca thuần về kỳ trong `period.test.js` (weekPeriod, monthPeriod, runningMonthPeriod, nút Kỳ này/Kỳ trước, previousPeriod, trendPeriods, reportPeriods WR/MR/QR, quarterPeriod) và 5 assert đầu của `schedule.test.js`, đổi sang chuỗi ngày, giá trị mong đợi giữ nguyên. Thêm test `toVnDate` ở mốc nửa đêm (vd `2026-11-15T17:30:00Z` → `2026-11-16`).
5. **`docs/specs/ky-ts24.md`**: quy tắc, bảng hàm cũ → hàm mới, nguồn test cũ.
6. `index.ts` xuất các hàm trên; smoke test `PACKAGE_NAME` giữ nguyên.

## Để người làm tự quyết

- Tên hàm phụ trợ nội bộ, cách tách file test.
- Thuật toán đổi ngày ↔ số ngày (miễn đúng lịch Gregory, có test năm nhuận).
