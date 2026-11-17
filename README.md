# TS24-HTKH
Monorepo pnpm + Turborepo · Web Next.js · Desktop Windows Tauri 2 · PostgreSQL (research only)

BỘ KHỞI TẠO
File	Vai trò	Khi nào Claude Code đọc
CLAUDE.md (101 dòng)	Cách làm việc, quan hệ với hệ thống cũ, lệnh, bảo mật cốt lõi, quy tắc nghiệp vụ, tiêu chí hoàn thành	Mỗi phiên
docs/architecture.md	Nguồn chuẩn của kiến trúc: sơ đồ 5 lớp (Mermaid), bảng lớp ↔ thư mục, quy tắc phụ thuộc, cây thư mục, luồng một request, các môi trường	Mỗi phiên, vì CLAUDE.md import nó bằng @docs/architecture.md
.claude/rules/*.md (6 file)	Quy tắc riêng cho từng vùng code: backend, database, api, frontend, desktop, ci-cd	Chỉ khi Claude làm việc với file thuộc vùng đó
docs/adr/0001–0005 + mẫu	Lý do của từng quyết định: monorepo, PostgreSQL, Tauri vỏ mỏng, ký code miễn phí, chạy song song hệ thống cũ	Khi cần biết vì sao đã chọn như vậy
.dependency-cruiser.cjs	Quy tắc phụ thuộc viết thành code, CI chặn import sai lớp	Mỗi lần chạy pnpm depcruise

Hai cơ chế của Claude Code mà bộ này dựa vào:
•	Import: CLAUDE.md import được file khác bằng @path/to/import; file được import sẽ được nạp ngay khi khởi động, cùng với file gọi nó.
•	Quy tắc theo vùng code: rule có khai báo paths thì chỉ được kích hoạt khi Claude đọc file khớp với mẫu đường dẫn. Ví dụ quy tắc Tauri chỉ nạp khi Claude đụng vào apps/desktop/, nên không tốn context khi đang làm backend.

KIẾN TRỨC được giữ ở ba nơi
1.	docs/architecture.md: Claude Code đọc file này để đặt code đúng chỗ. Đây là bản đúng duy nhất.
2.	.dependency-cruiser.cjs: đặt sai lớp thì CI báo lỗi, kể cả khi Claude quên quy tắc.
3.	Whiteboard: bản hình để bạn và đồng nghiệp xem. Khi hai nơi lệch nhau, file trong repo là bản đúng. CLAUDE.md có quy định: đổi kiến trúc thì phải viết ADR, sửa architecture.md và depcruise trong cùng một PR, rồi nhắc bạn cập nhật Whiteboard.

CÁCH BÁT ĐẦU
1.	Tạo repo private ts24-htkh trên GitHub, clone về máy, đặt ở thư mục khác D:\Downloads\AI\HTKH-KPI.
2.	Giải nén nội dung bên trong thư mục ts24-htkh-kit/ vào thư mục gốc của repo, rồi commit lần đầu.
3.	Mở Claude Code trong thư mục repo và gửi lời nhắn đầu tiên, ví dụ:
Đọc CLAUDE.md và docs/architecture.md. Lập plan Mốc 0 (dựng khung monorepo, chưa có nghiệp vụ): pnpm-workspace.yaml, turbo.json, packages/config, các package rỗng đúng tên và đúng dependencies, apps/web Next.js chạy được trang chào, cấu hình depcruise, ci.yml chạy lint/typecheck/test/depcruise. Trình plan cho tôi duyệt trước, dừng sau mỗi bước để tôi kiểm tra.
4.	Các mốc tiếp theo, mỗi mốc một plan và dừng để bạn duyệt: 
o	Mốc 1: chuyển period/quarter từ Pure.js sang shared, kèm toàn bộ test cũ.
o	Mốc 2: schema DB, migration và RLS.
o	Mốc 3: đăng nhập và tài khoản.
o	Mốc 4: gửi KPI.
o	Sau đó lần lượt các module khác. App desktop Tauri làm sau khi web đã chạy ổn trên staging.

CẦN KIỂM TRA
•	Lần đầu Claude Code gặp import trỏ ra ngoài repo, nó sẽ hiện hộp thoại xin phép; nếu bạn từ chối thì các import đó bị tắt. @docs/architecture.md nằm trong repo nên bình thường không bị hỏi, nhưng nếu hộp thoại hiện ra thì hãy chọn đồng ý.
•	.dependency-cruiser.cjs mới viết, chưa chạy trên repo thật. Nên kiểm tra ở Mốc 0: cố ý import sai một lần để chắc CI có chặn.
