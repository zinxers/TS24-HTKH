'use client';

import { KENH, MAX_ROWS_PER_SUBMIT, PHAN_LOAI, type KpiRowResult } from '@ts24-htkh/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiClient } from '../../lib/api-client';
import { useConfirmAction } from '../accounts/useConfirmAction';
import { KpiShell, useKpiUser } from './KpiShell';
import { toInput, useKpiDraft, type DraftRow } from './useKpiDraft';

interface SentRow {
  rowId: string;
  ticket: string;
  kenh: string;
  phanLoai: string;
  noiDung: string;
  when: string;
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });

/** Màn hình nhập KPI: nháp tự lưu trên máy; gửi qua ConfirmDialog, lỗi hiện cạnh từng ô. */
export function KpiEntryScreen() {
  const { me, notice, setNotice, leave } = useKpiUser();
  return (
    <KpiShell me={me} notice={notice} onNotice={setNotice}>
      {me && <EntryBody userId={me.id} onAuthLost={() => void leave()} />}
    </KpiShell>
  );
}

function EntryBody({ userId, onAuthLost }: { userId: string; onAuthLost: () => void }) {
  const draft = useKpiDraft(userId);
  const action = useConfirmAction(onAuthLost);
  const [sent, setSent] = useState<SentRow[]>([]);
  const [failed, setFailed] = useState(0);
  const { rows } = draft;
  const n = rows.length;

  function send() {
    const snapshot = rows;
    action.ask({
      title: `Gửi ${n} dòng?`,
      message: 'Dòng hợp lệ được ghi nhận vào KPI của bạn. Dòng lỗi ở lại để sửa.',
      confirmLabel: 'Gửi',
      run: async () => {
        const { createdAt, results } = await apiClient.kpi.submit(snapshot.map(toInput));
        draft.applyResults(results);
        setFailed(results.filter((r: KpiRowResult) => r.status === 'error').length);
        const done = snapshot.filter((r) => results.some((x) => x.rowId === r.rowId && x.status === 'ok'));
        setSent((prev) => [...done.map((r) => ({ ...toInput(r), when: hhmm(createdAt) })).reverse(), ...prev]);
      },
    });
  }

  const banner = action.error ?? (failed > 0 ? `${failed} dòng chưa gửi được. Sửa lỗi rồi gửi lại.` : null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Báo cáo KPI</h1>
          <p className="count">{n} dòng nháp · tự lưu trên máy này</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" href="/kpi/mine">
            KPI của tôi
          </Link>
        </div>
      </div>

      <div className="table-wrap entry-wrap">
        <table className="entry-table">
          <colgroup>
            <col className="c-ticket" />
            <col className="c-kenh" />
            <col className="c-loai" />
            <col className="c-nd" />
            <col className="c-x" />
          </colgroup>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Kênh - Tình trạng</th>
              <th>Phân loại</th>
              <th>Nội dung</th>
              <th>
                <span className="visually-hidden">Xóa dòng</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <EntryRow key={r.rowId} row={r} index={i + 1} draft={draft} />
            ))}
          </tbody>
        </table>
        <div className="entry-foot">
          <button className="btn btn-secondary" type="button" disabled={n >= MAX_ROWS_PER_SUBMIT} onClick={draft.addRow}>
            + Thêm dòng
          </button>
          <span className="hint-line">Tối đa {MAX_ROWS_PER_SUBMIT} dòng mỗi lần gửi · thêm dòng không hỏi xác nhận</span>
          <button className="btn btn-primary" type="button" disabled={n === 0 || action.busy} onClick={send}>
            Gửi {n} dòng
          </button>
        </div>
      </div>

      {banner && (
        <p role="alert" className="banner-error">
          {banner}
        </p>
      )}

      {sent.length > 0 && (
        <>
          <h2 className="sec-title">Vừa gửi</h2>
          <div className="sent">
            {sent.map((s) => (
              <div className="sent-row" key={s.rowId}>
                <span className="tick" aria-hidden="true">
                  ✓
                </span>
                <span className="main">
                  <b>{s.ticket}</b> · {s.kenh}
                </span>
                <span className="when">{s.when}</span>
                <span className="meta">
                  {s.phanLoai} · {s.noiDung}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <ConfirmDialog {...action.dialogProps} />
    </>
  );
}

function EntryRow({ row, index, draft }: { row: DraftRow; index: number; draft: ReturnType<typeof useKpiDraft> }) {
  const set = (patch: Parameters<typeof draft.updateRow>[1]) => draft.updateRow(row.rowId, patch);
  const err = (field: string) => row.errors[field];
  const props = (field: string, label: string) => ({
    className: err(field) ? 'kin invalid' : 'kin',
    'aria-label': `${label} dòng ${index}`,
    'aria-invalid': err(field) ? (true as const) : undefined,
  });
  const msg = (field: string) =>
    err(field) && (
      <span className="cell-err" role="alert">
        {err(field)}
      </span>
    );
  return (
    <tr className={Object.keys(row.errors).length > 0 ? 'has-error' : undefined}>
      <td data-label="Ticket">
        <div>
          <input {...props('ticket', 'Ticket')} value={row.ticket} onChange={(e) => set({ ticket: e.target.value })} />
          {msg('ticket')}
        </div>
      </td>
      <td data-label="Kênh">
        <div>
          <select {...props('kenh', 'Kênh - Tình trạng')} value={row.kenh} onChange={(e) => set({ kenh: e.target.value })}>
            <option value="">Chọn kênh - tình trạng</option>
            {KENH.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          {msg('kenh')}
        </div>
      </td>
      <td data-label="Phân loại">
        <div>
          <select {...props('phanLoai', 'Phân loại')} value={row.phanLoai} onChange={(e) => set({ phanLoai: e.target.value })}>
            <option value="">Chọn phân loại</option>
            {PHAN_LOAI.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          {msg('phanLoai')}
        </div>
      </td>
      <td data-label="Nội dung">
        <div>
          <textarea {...props('noiDung', 'Nội dung')} rows={1} value={row.noiDung} onChange={(e) => set({ noiDung: e.target.value })} />
          {msg('noiDung')}
        </div>
      </td>
      <td className="x">
        <button className="icon-btn" type="button" aria-label={`Xóa dòng ${index}`} onClick={() => draft.removeRow(row.rowId)}>
          ✕
        </button>
      </td>
    </tr>
  );
}
