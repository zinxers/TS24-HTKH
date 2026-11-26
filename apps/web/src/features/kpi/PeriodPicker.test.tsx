import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeriodPicker } from './PeriodPicker';

const value = { start: '2026-10-16', end: '2026-11-15' } as never;

describe('PeriodPicker', () => {
  it('mặc định chọn sẵn Tháng này', () => {
    render(<PeriodPicker value={value} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Tháng này' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('defaultPreset chọn sẵn chip, nhập tay thì bỏ chọn', () => {
    render(<PeriodPicker value={value} onChange={vi.fn()} defaultPreset="Tháng trước" />);
    expect(screen.getByRole('button', { name: 'Tháng trước' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tháng này' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-20' } });
    expect(screen.getByRole('button', { name: 'Tháng trước' })).toHaveAttribute('aria-pressed', 'false');
  });
});
