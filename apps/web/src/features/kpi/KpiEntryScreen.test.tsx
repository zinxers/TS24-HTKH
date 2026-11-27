import type { CurrentUser } from '@ts24-htkh/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { renderWithUser } from '../../test/render-with-user';
import { KpiEntryScreen } from './KpiEntryScreen';


const USER: CurrentUser = { id: 'u1', email: 'a@example.com', fullName: 'Nhân Viên A', role: 'staff', teamId: 't1' };

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

async function openWithRow() {
  renderWithUser(<KpiEntryScreen />, USER);
  fireEvent.click(await screen.findByRole('button', { name: '+ Thêm dòng' }));
}

function fillRow(n: number, ticket: string) {
  fireEvent.change(screen.getByLabelText(`Ticket dòng ${n}`), { target: { value: ticket } });
  fireEvent.change(screen.getByLabelText(`Kênh - Tình trạng dòng ${n}`), { target: { value: 'Email Hoàn Thành' } });
  fireEvent.change(screen.getByLabelText(`Phân loại dòng ${n}`), { target: { value: 'Hỗ trợ sử dụng' } });
  fireEvent.change(screen.getByLabelText(`Nội dung dòng ${n}`), { target: { value: 'Hướng dẫn khách' } });
}

describe('KpiEntryScreen', () => {
  it('nút Gửi tắt khi chưa có dòng; Thêm dòng không hỏi xác nhận', async () => {
    renderWithUser(<KpiEntryScreen />, USER);
    const send = await screen.findByRole('button', { name: /^Gửi/ });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm dòng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ticket dòng 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi 1 dòng' })).toBeEnabled();
  });

  it('tắt Thêm dòng khi đủ 200 dòng', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ rowId: `row-${String(i).padStart(8, '0')}`, ticket: '', kenh: '', phanLoai: '', noiDung: '' }));
    localStorage.setItem('ts24-htkh:kpi-draft:u1', JSON.stringify(rows));
    renderWithUser(<KpiEntryScreen />, USER);
    expect(await screen.findByRole('button', { name: '+ Thêm dòng' })).toBeDisabled();
  });

  it('bấm Gửi mở ConfirmDialog "Gửi N dòng?"; Hủy không gọi API', async () => {
    const submit = vi.spyOn(apiClient.kpi, 'submit');
    await openWithRow();
    fillRow(1, 'TICKET/1');
    fireEvent.click(screen.getByRole('button', { name: 'Gửi 1 dòng' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Gửi 1 dòng?' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(submit).not.toHaveBeenCalled();
  });

  it('xác nhận gửi đúng các dòng; dòng ok biến mất, dòng lỗi hiện thông báo cạnh ô', async () => {
    await openWithRow();
    fireEvent.click(screen.getByRole('button', { name: '+ Thêm dòng' }));
    fillRow(1, 'TICKET/1');
    fillRow(2, '48214');
    const sent = vi.fn(async (rows: unknown[]) => {
      const [a, b] = rows as { rowId: string }[];
      return {
        createdAt: '2026-11-19T02:42:00.000Z',
        results: [
          { rowId: a!.rowId, status: 'ok' as const },
          { rowId: b!.rowId, status: 'error' as const, errors: [{ field: 'ticket', message: 'Ticket phải có dạng TICKET/số' }] },
        ],
      };
    });
    vi.spyOn(apiClient.kpi, 'submit').mockImplementation(sent);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi 2 dòng' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gửi' }));
    expect(await screen.findByText('Ticket phải có dạng TICKET/số')).toBeInTheDocument();
    expect(sent.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ ticket: 'TICKET/1', kenh: 'Email Hoàn Thành', phanLoai: 'Hỗ trợ sử dụng', noiDung: 'Hướng dẫn khách' }),
      expect.objectContaining({ ticket: '48214' }),
    ]);
    expect((sent.mock.calls[0]![0] as object[])[0]).not.toHaveProperty('errors');
    expect(screen.getByLabelText('Ticket dòng 1')).toHaveValue('48214');
    expect(screen.getByText(/1 dòng chưa gửi được/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vừa gửi' })).toBeInTheDocument();
    expect(screen.getByText('TICKET/1')).toBeInTheDocument();
  });

  it('API lỗi 400 hiện thông báo từ server, giữ nháp', async () => {
    await openWithRow();
    fillRow(1, 'TICKET/1');
    vi.spyOn(apiClient.kpi, 'submit').mockRejectedValue(new ApiError('VALIDATION', 400, 'Mỗi lần gửi tối đa 200 dòng'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi 1 dòng' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gửi' }));
    expect(await screen.findByText('Mỗi lần gửi tối đa 200 dòng')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Ticket dòng 1')).toHaveValue('TICKET/1'));
  });
});
