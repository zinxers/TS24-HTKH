import { expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

it('xuất đúng tên package', () => {
  expect(PACKAGE_NAME).toBe('@ts24-htkh/shared');
});
