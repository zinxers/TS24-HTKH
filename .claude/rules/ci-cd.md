---
paths:
  - ".github/**"
  - "turbo.json"
  - "pnpm-workspace.yaml"
  - "package.json"
  - "**/package.json"
---

# Monorepo và CI/CD

## pnpm + Turborepo
- Package mới: `package.json` có `name` `@ts24-htkh/<tên>`, scripts `lint`, `typecheck`, `test` (`build` nếu cần), kế thừa `@ts24-htkh/config`.
- Phụ thuộc nội bộ `"workspace:*"`; thêm package ngoài bằng `pnpm add <pkg> --filter <package>`, không cài ở gốc trừ công cụ dev chung.
- `turbo.json`: `build`, `typecheck`, `test` phụ thuộc `^build`; khai báo đúng `outputs` (`.next/**`, `dist/**`) và `env` ảnh hưởng tới build.
- Tác vụ `tauri build` không nằm trong `build` mặc định; chỉ chạy trên runner Windows.
- Không bật remote cache khi người dùng chưa đồng ý.

## Workflows
- `ci.yml` (mọi PR): `pnpm install --frozen-lockfile` → `turbo lint typecheck test --filter=...[origin/main]` → `supabase db reset` + test integration → `pnpm depcruise` → `pnpm check:rls` → build web → gitleaks. Job Windows chỉ khi `apps/desktop` hoặc `packages/platform` đổi.
- `deploy.yml`: merge `main` → migration staging → Vercel staging → smoke test. Tag `v*` → chờ duyệt → backup → migration production → Vercel production → smoke test.
- `release-desktop.yml` (tag `desktop-v*`, `windows-latest`): test → `tauri build` → MSIX hoặc MSI/NSIS ký → beta → duyệt tay → stable.
- `backup.yml`: `pg_dump` hằng đêm, mã hóa, lưu nơi khác (7 ngày, 4 tuần, 12 tháng); hằng tháng `tools/backup-verify`.
- Secret chỉ đọc từ GitHub Secrets/Environments; job production dùng environment có người duyệt.
