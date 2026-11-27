import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { tsWeekNumber, weekPeriod, type IsoDate } from '@ts24-htkh/shared';
import { TopBar } from './TopBar';

const TODAY = '2026-11-26' as IsoDate;
const dm = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7);

describe('TopBar', () => {
  it('hiện kỳ tuần TS24 tính từ weekPeriod', () => {
    const p = weekPeriod(TODAY);
    render(<TopBar today={TODAY} />);
    expect(
      screen.getByText(`Tuần ${tsWeekNumber(p.start)} · ${dm(p.start)}–${dm(p.end)}`),
    ).toBeInTheDocument();
  });

  it('có link Nhập KPI tới /kpi', () => {
    render(<TopBar today={TODAY} />);
    expect(screen.getByRole('link', { name: 'Nhập KPI' })).toHaveAttribute('href', '/kpi');
  });

  it('không có onMenu thì không có nút Mở menu', () => {
    render(<TopBar today={TODAY} />);
    expect(screen.queryByRole('button', { name: 'Mở menu' })).toBeNull();
  });

  it('có onMenu: bấm gọi onMenu, aria-expanded theo menuOpen', () => {
    const onMenu = vi.fn();
    render(<TopBar today={TODAY} onMenu={onMenu} menuOpen />);
    const btn = screen.getByRole('button', { name: 'Mở menu' });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });
});
