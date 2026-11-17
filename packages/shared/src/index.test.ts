import { expect, it } from 'vitest';
import * as shared from './index';
import { PACKAGE_NAME } from './index';

it('xuất đúng tên package', () => {
  expect(PACKAGE_NAME).toBe('@ts24-htkh/shared');
});

it('xuất các hàm kỳ TS24', () => {
  for (const name of ['weekPeriod', 'reportPeriods', 'scheduleWeeks', 'toVnDate', 'isoDate'] as const) {
    expect(typeof shared[name]).toBe('function');
  }
});
