import base from '@ts24-htkh/config/eslint/base';

export default [
  ...base,
  {
    // Logic kỳ không được dùng `Date` (lệch múi giờ); chỉ date.ts được dùng.
    files: ['src/period.ts', 'src/schedule-weeks.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'Date', message: 'Dùng IsoDate trong date.ts.' }],
    },
  },
];
