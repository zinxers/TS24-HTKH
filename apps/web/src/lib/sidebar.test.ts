import { describe, expect, it } from 'vitest';
import { parseSidebar, saveSidebar } from './sidebar';

describe('parseSidebar', () => {
  it('chỉ "collapsed" là thu gọn', () => {
    expect(parseSidebar('collapsed')).toBe(true);
    expect(parseSidebar('expanded')).toBe(false);
    expect(parseSidebar(undefined)).toBe(false);
    expect(parseSidebar('xyz')).toBe(false);
  });
});

describe('saveSidebar', () => {
  it('ghi cookie theo trạng thái', () => {
    saveSidebar(true);
    expect(document.cookie).toContain('sidebar=collapsed');
    saveSidebar(false);
    expect(document.cookie).toContain('sidebar=expanded');
  });
});
