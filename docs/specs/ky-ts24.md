# Kỳ TS24 và tuần lịch

Nguồn duy nhất tính kỳ: `@ts24-htkh/shared` (`packages/shared/src/date.ts`, `period.ts`, `schedule-weeks.ts`).
Chuyển từ hệ thống cũ HTKH-KPI, giữ nguyên kết quả. Thiết kế: `docs/superpowers/specs/2026-11-17-moc-1-ky-ts24-design.md`.

## Quy tắc (theo `CLAUDE.md`)

- **Tuần TS24:** thứ Sáu tuần trước → hết thứ Năm. Tuần 1 bắt đầu thứ Sáu đầu tiên của năm; tuần vắt qua năm mới mang số tuần của năm cũ.
- **Tháng N:** ngày 16 tháng N-1 → hết ngày 15 tháng N. Từ ngày 16 là kỳ tháng sau.
- **Quý cố định:** Quý 1 = 16/12 năm trước → 15/03, Quý 2 = 16/03 → 15/06, Quý 3 = 16/06 → 15/09, Quý 4 = 16/09 → 15/12.
- **Tuần lịch:** thứ Hai → thứ Bảy; tháng N gồm các tuần có thứ Sáu nằm trong tháng dương lịch N.
- **Nhãn ô A6 mẫu xlsx:** `Tuần <n> tháng MM/YYYY`, `Tháng MM/YYYY`, `Qúy MM/YYYY` (chữ "Qúy" đúng như mẫu). Tháng/năm lấy từ ngày cuối kỳ.
- Kỳ tính cả hai đầu. Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh`.

## Kiểu ngày

Ngày là chuỗi `IsoDate` (`YYYY-MM-DD`) để kết quả không lệch theo múi giờ nơi chạy (Vercel UTC, trình duyệt, Tauri, CI).
Đổi một thời điểm sang ngày VN bằng `toVnDate`. `Date` chỉ được dùng trong `date.ts`; ESLint chặn `Date` trong `period.ts`, `schedule-weeks.ts`.

## Hàm cũ → hàm mới

| Hàm cũ (`HTKH-KPI/app/src/Pure.js`, dòng) | Hàm mới | File |
|---|---|---|
| `weekPeriod` (720) | `weekPeriod(d)` | `period.ts` |
| `monthPeriod` (728) | `monthPeriod(d, offset)` | `period.ts` |
| `runningMonthPeriod` (734) | `runningMonthPeriod(d)` | `period.ts` |
| `trendPeriods` (739) | `trendPeriods(unit, today)` | `period.ts` |
| `quarterPeriod` (753) | `quarterPeriod(d, offset)` | `period.ts` |
| `weekNumber_` (762) | `tsWeekNumber(start)` | `period.ts` |
| `reportPeriods` (770) | `reportPeriods(type, today)` | `period.ts` |
| `previousPeriod(start, end)` (896) | `previousPeriod({ start, end })` | `period.ts` |
| `scheduleWeeks` (1190) | `scheduleWeeks(month)` | `schedule-weeks.ts` |
| `scheduleMonthOf` (1197) | `scheduleMonthOf(d)` | `schedule-weeks.ts` |
| `scheduleMonthShift` (1202) | `scheduleMonthShift(month, n)` | `schedule-weeks.ts` |
| `addDays_`, `dayOf_`, `dayCount_`, `pad2` | `addDays`, `daysBetween`, `makeDate`, `dayOfWeek`, `parts` | `date.ts` |
| (mới) | `isIsoDate`, `isoDate`, `toVnDate` | `date.ts` |

Kỳ trả về `{ start, end }` thay cho mảng `[start, end]`.

## Test cũ → test mới

| Test cũ (`HTKH-KPI/app/tests/`, dòng) | Test mới (`packages/shared/src/`) |
|---|---|
| `period.test.js` 9-63 (weekPeriod, monthPeriod, runningMonthPeriod, nút Kỳ này/Kỳ trước, previousPeriod) | `period.test.ts` |
| `period.test.js` 144-203 (trendPeriods, reportPeriods WR/MR/QR, quarterPeriod) | `period.test.ts` |
| `schedule.test.js` 8-12 (scheduleWeeks, scheduleMonthOf, scheduleMonthShift) | `schedule-weeks.test.ts` |
| (mới) ngày sai dạng, năm nhuận, mốc nửa đêm giờ VN | `date.test.ts` |
| (mới) 16/12 thuộc Quý 1 năm sau; năm có 01/01 là thứ Sáu | `period.test.ts` |

## Chưa chuyển (mốc sau)

- `ticketBuckets`, `hourBuckets`, `reportFollowUp`, `workdaysBetween`, ngày nghỉ lễ: nghiệp vụ KPI/lịch (`core`).
- Xếp lịch thứ Bảy (`rotateSat`, `seedSat`, `placeNewSat`, `scheduleDaysOff`...), xuất Excel.
- Schema zod cho `IsoDate` ở biên API: làm khi có route đầu tiên.
- Định dạng hiển thị `dd/mm/yyyy`: làm khi có giao diện.
