import type { CurrentUser } from '@ts24-htkh/shared';
import { DEPT_SCOPE, reportPeriods } from '@ts24-htkh/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi, type MockInstance } from 'vitest';
import { ApiError, apiClient } from '../../lib/api-client';
import { TEAMS, TODAY, preview, scopeNote } from './fixtures.test-utils';
import { renderWithUser } from '../../test/render-with-user';
import { ReportsScreen } from './ReportsScreen';


const HEAD: CurrentUser = { id: 'h', email: 'truong.phong@example.com', fullName: 'Trưởng Phòng', role: 'head', teamId: null };
const MANAGER: CurrentUser = { id: 'm2', email: 'quan.ly.2@example.com', fullName: 'Quản Lý Hai', role: 'manager', teamId: TEAMS[1]!.id };
const CONFLICT = 'Nội dung vừa được người khác sửa, vui lòng tải lại';

const periods = (t: 'WR' | 'MR' | 'QR') => reportPeriods(t, TODAY as never);
const confirmDialog = () => screen.getAllByRole('dialog').at(-1)!;
let load: MockInstance<typeof apiClient.reports.preview>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-23T03:00:00Z'));
  load = vi.spyOn(apiClient.reports, 'preview').mockImplementation(async (type, start) => preview(type, start));
});
afterEach(() => vi.useRealTimers());

const asHead = async () => {
  renderWithUser(<ReportsScreen />, HEAD);
  await screen.findByRole('table', { name: 'Số liệu theo team' });
};

describe('ReportsScreen', () => {
  it('mặc định WR và kỳ reportPeriods[1]; đổi sang MR gọi preview(MR, kỳ [1] của MR)', async () => {
    await asHead();
    expect(load).toHaveBeenCalledWith('WR', periods('WR')[1]!.start);
    expect(screen.getByRole('button', { name: 'Tuần (WR)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Kỳ')).toHaveValue(periods('WR')[1]!.start);
    fireEvent.click(screen.getByRole('button', { name: 'Tháng (MR)' }));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith('MR', periods('MR')[1]!.start));
    expect(await screen.findByText('Báo cáo tháng chỉ có tổng ticket và xu hướng.')).toBeInTheDocument();
  });

  it('Trưởng phòng: 3 cột team, 4 tab phạm vi, Cả phòng chỉ có trường tóm tắt', async () => {
    await asHead();
    const table = screen.getByRole('table', { name: 'Số liệu theo team' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Mục', 'TaxOnline', 'iBHXH', 'iXHD']);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Cả phòng', 'TaxOnline', 'iBHXH', 'iXHD']);
    expect(screen.getByLabelText('SLA đạt')).toBeInTheDocument();
    expect(screen.queryByLabelText('SLA Compliance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'iBHXH' }));
    expect(screen.getByLabelText('SLA Compliance')).toBeInTheDocument();
  });

  it('Quản lý: không có tab phạm vi, bảng 1 cột, form có trường tóm tắt và team', async () => {
    load.mockImplementation(async (type, start) => preview(type, start, { managerTeam: 1 }));
    renderWithUser(<ReportsScreen />, MANAGER);
    const table = await screen.findByRole('table', { name: 'Số liệu theo team' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Mục', 'iBHXH']);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByLabelText('SLA đạt')).toBeInTheDocument();
    expect(screen.getByLabelText('SLA Compliance')).toBeInTheDocument();
    expect(screen.getByText(/ký PP\. Hỗ Trợ Khách Hàng/)).toBeInTheDocument();
  });

  it('Lưu mở ConfirmDialog; xác nhận gọi saveNotes với expectedVersion của phạm vi', async () => {
    const scopes = [scopeNote(DEPT_SCOPE, { version: 3, fields: { sla: '95%' } }), ...TEAMS.map((t) => scopeNote(t.id))];
    load.mockImplementation(async (type, start) => preview(type, start, { scopes }));
    const save = vi.spyOn(apiClient.reports, 'saveNotes').mockResolvedValue({ scopes });
    await asHead();
    expect(screen.getByLabelText('SLA đạt')).toHaveValue('95%');
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: '96%' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(screen.getByRole('dialog', { name: 'Lưu nội dung chữ?' })).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith('WR', {
        start: periods('WR')[1]!.start,
        scope: DEPT_SCOPE,
        fields: expect.objectContaining({ sla: '96%' }),
        expectedVersion: 3,
      }),
    );
  });

  it('saveNotes 409: báo, giữ chữ đang gõ, tải lại preview', async () => {
    vi.spyOn(apiClient.reports, 'saveNotes').mockRejectedValue(new ApiError('CONFLICT', 409, CONFLICT));
    await asHead();
    expect(load).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: 'chữ của tôi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(CONFLICT)).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('SLA đạt')).toHaveValue('chữ của tôi');
  });

  it('409 rồi lưu lại: giữ ô mình gõ, nhận ô người khác vừa sửa và version mới', async () => {
    const v1 = [scopeNote(DEPT_SCOPE, { version: 1, fields: { sla: 'cũ', mttr: 'cũ' } }), ...TEAMS.map((t) => scopeNote(t.id))];
    const v2 = [scopeNote(DEPT_SCOPE, { version: 2, fields: { sla: 'cũ', mttr: 'người khác' } }), ...TEAMS.map((t) => scopeNote(t.id))];
    load.mockImplementationOnce(async (type, start) => preview(type, start, { scopes: v1 }));
    load.mockImplementation(async (type, start) => preview(type, start, { scopes: v2 }));
    const save = vi
      .spyOn(apiClient.reports, 'saveNotes')
      .mockRejectedValueOnce(new ApiError('CONFLICT', 409, CONFLICT))
      .mockResolvedValue({ scopes: v2 });
    await asHead();
    const mttr = () => screen.getByLabelText('MTTR', { selector: 'input' });
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: 'của tôi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Lưu' }));
    await screen.findByText(CONFLICT);
    await waitFor(() => expect(mttr()).toHaveValue('người khác'));
    expect(screen.getByLabelText('SLA đạt')).toHaveValue('của tôi');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith('WR', {
      start: periods('WR')[1]!.start,
      scope: DEPT_SCOPE,
      fields: { sla: 'của tôi', mttr: 'người khác' },
      expectedVersion: 2,
    });
  });

  it('409: ô đã gõ rồi trả về như cũ không ghi đè giá trị mới của người khác', async () => {
    const v1 = [scopeNote(DEPT_SCOPE, { version: 1, fields: { sla: 'cũ', mttr: 'cũ' } }), ...TEAMS.map((t) => scopeNote(t.id))];
    const v2 = [scopeNote(DEPT_SCOPE, { version: 2, fields: { sla: 'cũ', mttr: 'người khác' } }), ...TEAMS.map((t) => scopeNote(t.id))];
    load.mockImplementationOnce(async (type, start) => preview(type, start, { scopes: v1 }));
    load.mockImplementation(async (type, start) => preview(type, start, { scopes: v2 }));
    const save = vi
      .spyOn(apiClient.reports, 'saveNotes')
      .mockRejectedValueOnce(new ApiError('CONFLICT', 409, CONFLICT))
      .mockResolvedValue({ scopes: v2 });
    await asHead();
    const mttr = () => screen.getByLabelText('MTTR', { selector: 'input' });
    fireEvent.change(mttr(), { target: { value: 'tạm' } });
    fireEvent.change(mttr(), { target: { value: 'cũ ' } });
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: 'của tôi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Lưu' }));
    await screen.findByText(CONFLICT);
    await waitFor(() => expect(mttr()).toHaveValue('người khác'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]![1]).toMatchObject({ fields: { sla: 'của tôi', mttr: 'người khác' }, expectedVersion: 2 });
  });

  it('gõ rồi trả về như cũ (khác khoảng trắng): không tính là chưa lưu', async () => {
    const scopes = [scopeNote(DEPT_SCOPE, { version: 1, fields: { sla: '95%' } }), ...TEAMS.map((t) => scopeNote(t.id))];
    load.mockImplementation(async (type, start) => preview(type, start, { scopes }));
    await asHead();
    const save = screen.getByRole('button', { name: 'Lưu' });
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: '96%' } });
    expect(save).toBeEnabled();
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: '95% ' } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Kỳ'), { target: { value: periods('WR')[2]!.start } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenLastCalledWith('WR', periods('WR')[2]!.start));
  });

  it('WR/QR không có dòng thì không hiện câu của báo cáo tháng', async () => {
    load.mockImplementation(async (type, start) => ({ ...preview(type, start), rows: [] }));
    await asHead();
    expect(screen.queryByText('Báo cáo tháng chỉ có tổng ticket và xu hướng.')).not.toBeInTheDocument();
  });

  it('có chữ chưa lưu mà đổi kỳ: hỏi trước, xác nhận mới tải kỳ mới', async () => {
    await asHead();
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: 'x' } });
    const other = periods('WR')[2]!.start;
    fireEvent.change(screen.getByLabelText('Kỳ'), { target: { value: other } });
    expect(screen.getByRole('dialog', { name: 'Bỏ nội dung chưa lưu?' })).toBeInTheDocument();
    expect(load).not.toHaveBeenCalledWith('WR', other);
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Bỏ nội dung' }));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith('WR', other));
  });

  it('có chữ chưa lưu mà bấm "Tải file xlsx": hỏi trước; không có thì tải ngay', async () => {
    await asHead();
    const file = vi.spyOn(apiClient.reports, 'file').mockResolvedValue({ blob: new Blob(['x']), fileName: 'WR-TEC-261123.xlsx' });
    // jsdom không có createObjectURL và không tải được: đếm lần bấm thẻ <a download> ẩn.
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    onTestFinished(() => {
      Object.assign(URL, { createObjectURL, revokeObjectURL });
    });
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    const button = screen.getByRole('button', { name: 'Tải file xlsx' });
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(saved).toEqual(['WR-TEC-261123.xlsx']));
    expect(file).toHaveBeenCalledWith('WR', periods('WR')[1]!.start);
    fireEvent.change(screen.getByLabelText('SLA đạt'), { target: { value: 'x' } });
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Tải file khi chưa lưu?' })).toBeInTheDocument();
    expect(saved).toHaveLength(1);
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Tải file' }));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(screen.getByLabelText('SLA đạt')).toHaveValue('x');
  });

  it('tải file lỗi (403): báo lỗi trên màn hình, không lưu file', async () => {
    await asHead();
    vi.spyOn(apiClient.reports, 'file').mockRejectedValue(new ApiError('FORBIDDEN', 403, 'Bạn không có quyền'));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Tải file xlsx' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn không có quyền');
    expect(click).not.toHaveBeenCalled();
  });

  it('chip Đối soát KPI chỉ có với Trưởng phòng', async () => {
    await asHead();
    expect(screen.getByRole('button', { name: 'Đối soát KPI' })).toBeInTheDocument();
    renderWithUser(<ReportsScreen />, MANAGER);
    await screen.findAllByRole('table', { name: 'Số liệu theo team' });
    expect(screen.getAllByRole('button', { name: 'Đối soát KPI' })).toHaveLength(1);
  });
});
