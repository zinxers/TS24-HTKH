/** Quy tắc phụ thuộc giữa các lớp của TS24-HTKH. Nguồn: docs/architecture.md mục 2, ADR-0006.
 *  Đổi quy tắc phải có ADR. Không nới luật để code chạy được.
 *  Mỗi luật là danh sách cho phép: mọi package nội bộ ngoài danh sách đều bị chặn.
 *  Test: tests/depcruise-rules.test.ts. */
const API = '^apps/web/src/app/api/';
// Mọi file trong apps/web/src không thuộc api là giao diện (pages, layout, error, middleware...).
const GIAO_DIEN = '^apps/web/src/(?!app/api/)';

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'shared-khong-phu-thuoc', severity: 'error',
      comment: 'shared là logic thuần, không import package nội bộ nào khác',
      from: { path: '^packages/shared/' }, to: { path: '^packages/(?!shared/)' },
    },
    {
      name: 'giao-dien-khong-goi-backend-db', severity: 'error',
      comment: 'Frontend chỉ dùng shared và platform; gọi backend qua API',
      from: { path: GIAO_DIEN }, to: { path: '^packages/(?!(shared|platform)/)' },
    },
    {
      name: 'api-chi-goi-core-shared', severity: 'error',
      comment: 'Route handler chỉ gọi service trong core và dùng shared',
      from: { path: API }, to: { path: '^packages/(?!(core|shared)/)' },
    },
    {
      name: 'core-chi-goi-tang-duoi', severity: 'error',
      comment: 'core chỉ dùng db, storage, xlsx-report, shared',
      from: { path: '^packages/core/' }, to: { path: '^packages/(?!(core|db|storage|xlsx-report|shared)/)' },
    },
    {
      name: 'tang-duoi-chi-goi-shared', severity: 'error',
      comment: 'db, storage, xlsx-report chỉ dùng shared; không gọi ngược core hay gọi ngang nhau',
      from: { path: '^packages/(db|storage|xlsx-report)/' },
      to: { path: '^packages/', pathNot: ['^packages/$1/', '^packages/shared/'] },
    },
    {
      name: 'platform-khong-phu-thuoc', severity: 'error',
      comment: 'platform không import package nghiệp vụ nào',
      from: { path: '^packages/platform/' }, to: { path: '^packages/(?!platform/)' },
    },
    {
      name: 'core-khong-ui', severity: 'error',
      comment: 'Backend không phụ thuộc React, Next.js',
      from: { path: '^packages/(core|db|storage)/' },
      to: { path: 'node_modules/(react|react-dom|next)/' },
    },
    {
      name: 'desktop-khong-nghiep-vu', severity: 'error',
      comment: 'Vỏ Tauri không import package nghiệp vụ',
      from: { path: '^apps/desktop/' }, to: { path: '^packages/(core|db|storage|xlsx-report|shared)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.next|dist|src-tauri/target)/' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    // Bắt cả `import type`, để giao diện không lén phụ thuộc kiểu của backend.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
