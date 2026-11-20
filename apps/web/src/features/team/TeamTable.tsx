'use client';

import { KENH_GROUPS, type KenhCounts, type Period, type TeamKpi } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { fmtNumber } from '../kpi/KpiShell';
import { MemberPanel } from './MemberPanel';
import { TrendCard } from './TrendCard';

const groupSum = (byKenh: KenhCounts, kenh: readonly (keyof KenhCounts)[]) => kenh.reduce((s, k) => s + byKenh[k], 0);

/** Tab một team: 3 thẻ số, bảng thành viên, chi tiết người được bấm, xu hướng team. Chỉ xem. */
export function TeamTable({ teamId, range }: { teamId: string; range: Period }) {
  const [data, setData] = useState<TeamKpi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setError(null);
    setPicked(null);
    apiClient.kpi.team(teamId, { from: range.start, to: range.end }).then(
      (d) => !stale && setData(d),
      (e: unknown) => !stale && (setData(null), setError(errorMessage(e))),
    );
    return () => {
      stale = true;
    };
  }, [teamId, range]);

  if (error)
    return (
      <p role="alert" className="banner-error">
        {error}
      </p>
    );
  if (!data) return null;
  const { rows, totals } = data;

  return (
    <section>
      <div className="stat-row">
        <div className="stat">
          <span className="v">{fmtNumber(totals.total)}</span>
          <span className="l">Ticket</span>
        </div>
        <div className="stat">
          <span className="v">{fmtNumber(totals.money)} đ</span>
          <span className="l">Tiền KPI</span>
        </div>
        <div className="stat">
          <span className="v">
            {rows.filter((r) => r.total > 0).length} / {rows.length}
          </span>
          <span className="l">Người có báo cáo</span>
        </div>
      </div>

      <h2 className="sec-title">Thành viên</h2>
      {rows.length === 0 ? (
        <p className="muted">Chưa có dữ liệu</p>
      ) : (
        <>
          <div className="scroll-x">
            <table className="team-table" aria-label="Thành viên">
              <thead>
                <tr>
                  <th className="name">Họ tên</th>
                  {KENH_GROUPS.map((g) => (
                    <th key={g.name}>{g.name}</th>
                  ))}
                  <th>Tổng</th>
                  <th>Tiền</th>
                  <th>Ngày có BC</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className={r.active ? undefined : 'off'}>
                    <th scope="row" className="name">
                      <button type="button" aria-expanded={picked === r.userId} onClick={() => setPicked(r.userId)}>
                        {r.fullName}
                      </button>
                      {r.role === 'manager' && <span className="tag">Quản lý</span>}
                      {!r.active && <span className="tag">Không hoạt động</span>}
                    </th>
                    {KENH_GROUPS.map((g) => (
                      <td key={g.name} className="num">
                        {fmtNumber(groupSum(r.byKenh, g.kenh))}
                      </td>
                    ))}
                    <td className="num">{fmtNumber(r.total)}</td>
                    <td className="num">{fmtNumber(r.money)}</td>
                    <td className="num">{r.days}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="name">
                    Tổng
                  </th>
                  {KENH_GROUPS.map((g) => (
                    <td key={g.name} className="num">
                      {fmtNumber(groupSum(totals.byKenh, g.kenh))}
                    </td>
                  ))}
                  <td className="num">{fmtNumber(totals.total)}</td>
                  <td className="num">{fmtNumber(totals.money)}</td>
                  <td className="num">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted">Bấm tên để xem các dòng KPI của người đó. &quot;Ngày có BC&quot; đếm cả dòng gửi khi ở team khác.</p>
          {picked && <MemberPanel teamId={teamId} userId={picked} range={range} onClose={() => setPicked(null)} />}
        </>
      )}

      <TrendCard team={teamId} title="Xu hướng" />
    </section>
  );
}
