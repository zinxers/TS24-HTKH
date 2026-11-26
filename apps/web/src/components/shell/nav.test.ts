import { describe, expect, it } from 'vitest';
import { isActive, navFor } from './nav';

describe('nav', () => {
  it('isActive so khớp đúng, bỏ "/" cuối', () => {
    expect(isActive('/kpi', '/kpi/mine')).toBe(false);
    expect(isActive('/kpi', '/kpi/')).toBe(true);
    expect(isActive('/', '/')).toBe(true);
  });
  it('navFor theo vai trò', () => {
    expect(navFor('staff').map((i) => i.href)).toEqual(['/', '/kpi', '/kpi/mine', '/kpi/rates']);
    expect(navFor('manager')).toHaveLength(7);
  });
});
