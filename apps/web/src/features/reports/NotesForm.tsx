'use client';

import { MAX_NOTE_TEXT, toVnDate, type ReportField, type ReportNoteScope, type ReportType } from '@ts24-htkh/shared';
import { fmtDate, fmtNumber } from '../../lib/format';

/** Tiêu đề mục. WR theo mẫu duyệt 2026-11-23; MR, QR theo ViewPeriodic.html của hệ thống cũ. */
const SECTIONS: Record<ReportType, Record<string, string>> = {
  WR: { I: 'I. Tóm tắt', III: 'III. Chỉ số team', IV: 'IV. Vấn đề nổi bật', V: 'V. Kế hoạch tuần tới' },
  MR: { I: 'I. Tóm tắt', II: 'II. KPI tháng', III: 'III. Phân tích Root Cause', IV: 'IV. Đánh giá chất lượng dịch vụ', V: 'V. Đề xuất cải tiến' },
  QR: { I: 'I. Tổng quan hỗ trợ quý', II: 'II. Phân tích xu hướng', III: 'III. Hiệu suất đội ngũ', IV: 'IV. Rủi ro', V: 'V. Đề xuất chiến lược quý tới' },
};
const WARN_AT = MAX_NOTE_TEXT - 200;

const vnTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtInstant = (iso: string) => `${vnTime.format(new Date(iso))} ${fmtDate(toVnDate(new Date(iso)))}`;

interface Props {
  type: ReportType;
  fields: readonly ReportField[];
  values: Record<string, string>;
  meta: ReportNoteScope | undefined;
  dirty: boolean;
  busy: boolean;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
}

/** Form chữ của một phạm vi: nhóm theo mục, ô ngắn xếp lưới, ô dài là textarea có bộ đếm. */
export function NotesForm({ type, fields, values, meta, dirty, busy, onChange, onSave }: Props) {
  const sections = [...new Set(fields.map((f) => f.section))];

  const field = (f: ReportField, hideLabel: boolean) => {
    const id = `note-${f.key}`;
    const v = values[f.key] ?? '';
    const common = { id, value: v, maxLength: MAX_NOTE_TEXT, onChange: (e: { target: { value: string } }) => onChange(f.key, e.target.value) };
    return (
      <div className="nf" key={f.key}>
        {hideLabel ? null : <label htmlFor={id}>{f.label}</label>}
        {f.long ? <textarea {...common} aria-label={hideLabel ? f.label : undefined} /> : <input {...common} />}
        {f.long && (
          <span className={v.length >= WARN_AT ? 'cnt warn' : 'cnt'}>
            {fmtNumber(v.length)} / {fmtNumber(MAX_NOTE_TEXT)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="notes">
      {sections.map((s) => {
        const list = fields.filter((f) => f.section === s);
        const title = SECTIONS[type][s] ?? s;
        // Mục chỉ một ô trùng tên mục (vd "V. Kế hoạch tuần tới"): bỏ nhãn lặp, giữ aria-label.
        const hideLabel = list.length === 1 && title.endsWith(list[0]!.label);
        const short = list.filter((f) => !f.long);
        return (
          <section key={s}>
            <h3>{title}</h3>
            {short.length > 0 && <div className="row2">{short.map((f) => field(f, false))}</div>}
            {list.filter((f) => f.long).map((f) => field(f, hideLabel))}
          </section>
        );
      })}
      <div className="notes-foot">
        <span className="muted">{meta?.updatedAt && meta.updatedByName ? `Sửa lần cuối: ${meta.updatedByName}, ${fmtInstant(meta.updatedAt)}` : 'Chưa có nội dung đã lưu'}</span>
        <button className="btn btn-primary" type="button" disabled={!dirty || busy} onClick={onSave}>
          Lưu
        </button>
      </div>
    </div>
  );
}
