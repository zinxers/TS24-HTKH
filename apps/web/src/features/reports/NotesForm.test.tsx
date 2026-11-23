import { DEPT_SCOPE, REPORT_FIELDS, reportFieldsFor } from '@ts24-htkh/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotesForm } from './NotesForm';

const base = { type: 'WR' as const, meta: undefined, dirty: true, busy: false, onChange: vi.fn(), onSave: vi.fn() };

describe('NotesForm', () => {
  it('ô gần 2.000 ký tự hiện bộ đếm 1.986 / 2.000 (cảnh báo)', () => {
    render(<NotesForm {...base} fields={REPORT_FIELDS.WR.summary} values={{ vanDe: 'a'.repeat(1986) }} />);
    const cnt = screen.getByText('1.986 / 2.000');
    expect(cnt).toHaveClass('cnt', 'warn');
  });

  it('nhóm theo mục, ô ngắn là input, ô dài là textarea; gõ gọi onChange(key, value)', () => {
    const onChange = vi.fn();
    render(<NotesForm {...base} onChange={onChange} fields={reportFieldsFor('WR', 'team-id')} values={{}} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'I. Tóm tắt',
      'III. Chỉ số team',
      'IV. Vấn đề nổi bật',
      'V. Kế hoạch tuần tới',
    ]);
    expect(screen.getByLabelText('SLA đạt').tagName).toBe('INPUT');
    expect(screen.getByLabelText('SLA Compliance').tagName).toBe('TEXTAREA');
    fireEvent.change(screen.getByLabelText('MTTR', { selector: 'input' }), { target: { value: '4 giờ' } });
    expect(onChange).toHaveBeenCalledWith('mttr', '4 giờ');
  });

  it('hiện người sửa lần cuối; Lưu tắt khi chưa đổi', () => {
    render(
      <NotesForm
        {...base}
        dirty={false}
        fields={reportFieldsFor('WR', DEPT_SCOPE)}
        values={{}}
        meta={{ scope: DEPT_SCOPE, fields: {}, version: 2, updatedAt: '2026-11-22T03:32:00Z', updatedByName: 'Nguyễn Văn Hùng' }}
      />,
    );
    expect(screen.getByText('Sửa lần cuối: Nguyễn Văn Hùng, 10:32 22/11/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled();
  });
});
