import { describe, expect, it } from 'vitest';
import { fmtDate, fmtNumber } from './format';

describe('format', () => {
  it('fmtNumber dùng dấu chấm ngăn nghìn', () => {
    expect(fmtNumber(1234567)).toBe('1.234.567');
    expect(fmtNumber(0)).toBe('0');
  });
  it('fmtDate đổi ISO sang dd/mm/yyyy', () => {
    expect(fmtDate('2026-11-19')).toBe('19/11/2026');
  });
});
