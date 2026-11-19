import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKpiDraft } from './useKpiDraft';

const KEY = 'ts24-htkh:kpi-draft:u1';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useKpiDraft', () => {
  it('addRow thêm dòng trống với rowId UUID', () => {
    const { result } = renderHook(() => useKpiDraft('u1'));
    act(() => result.current.addRow());
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]!.rowId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('mount lại giữ nháp theo từng người dùng', () => {
    const first = renderHook(() => useKpiDraft('u1'));
    act(() => first.result.current.addRow());
    const id = first.result.current.rows[0]!.rowId;
    act(() => first.result.current.updateRow(id, { ticket: 'TICKET/1' }));
    first.unmount();
    expect(localStorage.getItem(KEY)).toContain('TICKET/1');
    const again = renderHook(() => useKpiDraft('u1'));
    expect(again.result.current.rows[0]).toMatchObject({ rowId: id, ticket: 'TICKET/1', errors: {} });
    expect(renderHook(() => useKpiDraft('u2')).result.current.rows).toEqual([]);
  });

  it('applyResults bỏ dòng ok, giữ dòng error kèm lỗi theo field; sửa field thì xóa lỗi field đó', () => {
    const { result } = renderHook(() => useKpiDraft('u1'));
    act(() => {
      result.current.addRow();
      result.current.addRow();
    });
    const [a, b] = result.current.rows.map((r) => r.rowId) as [string, string];
    act(() =>
      result.current.applyResults([
        { rowId: a, status: 'ok' },
        { rowId: b, status: 'error', errors: [{ field: 'ticket', message: 'Ticket phải có dạng TICKET/số' }] },
      ]),
    );
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toMatchObject({ rowId: b, errors: { ticket: 'Ticket phải có dạng TICKET/số' } });
    act(() => result.current.updateRow(b, { ticket: 'TICKET/2' }));
    expect(result.current.rows[0]!.errors).toEqual({});
    act(() => result.current.removeRow(b));
    expect(result.current.rows).toEqual([]);
  });

  it('localStorage ném lỗi: vẫn chạy với nháp rỗng', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useKpiDraft('u1'));
    expect(result.current.rows).toEqual([]);
    act(() => result.current.addRow());
    expect(result.current.rows).toHaveLength(1);
  });

  it('dữ liệu hỏng trong localStorage: bắt đầu rỗng', () => {
    localStorage.setItem(KEY, '{không phải json');
    expect(renderHook(() => useKpiDraft('u1')).result.current.rows).toEqual([]);
  });
});
