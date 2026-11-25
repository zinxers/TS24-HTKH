import type { ReportPreview } from '@ts24-htkh/shared';
import { fmtNumber } from '../kpi/KpiShell';

/** 412.3 → "412,3"; số nguyên → "1.234". */
const fmtValue = (n: number | null) => {
  if (n === null) return '';
  const [i, f] = String(n).split('.');
  return fmtNumber(Number(i)) + (f ? `,${f}` : '');
};
const SUM_ROW = 'Hoàn thành';
const TREND_CLASS = { '↑': 'v team-up', '↓': 'v team-down', '=': 'v' } as const;

/** Tổng ticket, mũi tên MR và bảng số liệu theo team. Cột null (team không được xem) bị ẩn. Chỉ xem. */
export function ReportTable({ preview }: { preview: ReportPreview }) {
  const cols = preview.teams.flatMap((t, i) => (t ? [{ team: t, i }] : []));
  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <span className="v">{fmtNumber(preview.total)}</span>
          <span className="l">Tổng ticket</span>
        </div>
        {preview.trend && (
          <div className="stat">
            <span className={TREND_CLASS[preview.trend]}>{preview.trend}</span>
            <span className="l">So với tháng trước</span>
          </div>
        )}
      </div>

      <div className="scroll-x">
        <table className="rep-table" aria-label="Số liệu theo team">
          <thead>
            <tr>
              <th scope="col">Mục</th>
              {cols.map((c) => (
                <th key={c.team.id} scope="col" title={c.team.name}>
                  {c.team.shortName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="muted">
                  {preview.type === 'MR' ? 'Báo cáo tháng chỉ có tổng ticket và xu hướng.' : 'Chưa có số liệu.'}
                </td>
              </tr>
            ) : (
              preview.rows.map((r) => (
                <tr key={r.label} className={r.label === SUM_ROW ? 'sum' : undefined}>
                  <td>{r.label}</td>
                  {cols.map((c) => (
                    <td key={c.team.id} className="num">
                      {fmtValue(r.values[c.i] ?? null)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
