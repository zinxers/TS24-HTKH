'use client';

import type { DeptLine, DeptOverview, Period } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { fmtDate, fmtNumber } from '../kpi/KpiShell';
import { TrendCard } from './TrendCard';

const pct = (change: number | null) => {
  if (change === null) return { text: '—', cls: 'num' };
  if (change > 0) return { text: `+${change}%`, cls: 'num team-up' };
  if (change < 0) return { text: `−${-change}%`, cls: 'num team-down' };
  return { text: '0%', cls: 'num' };
};

function LineCells({ l }: { l: DeptLine }) {
  const c = pct(l.change);
  return (
    <>
      <td className="num">{fmtNumber(l.total)}</td>
      <td className="num">{fmtNumber(l.prevTotal)}</td>
      <td className={c.cls}>{c.text}</td>
      <td className="num">{fmtNumber(l.money)}</td>
      <td className="num">
        {l.active} / {l.people}
      </td>
    </>
  );
}

/** Tab "Tổng quan phòng" (chỉ Trưởng phòng): tổng phòng, theo team so kỳ trước, nhóm kênh × team, xu hướng cả phòng. */
export function DeptOverviewPanel({ range }: { range: Period }) {
  const [data, setData] = useState<DeptOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;
    setError(null);
    setLoading(true);
    apiClient.kpi
      .overview({ from: range.start, to: range.end })
      .then(
        (d) => !stale && setData(d),
        (e: unknown) => !stale && (setData(null), setError(errorMessage(e))),
      )
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [range]);

  if (error)
    return (
      <p role="alert" className="banner-error">
        {error}
      </p>
    );
  if (!data) return loading ? <p role="status" aria-busy="true">Đang tải…</p> : null;
  const { teams, noTeam, totals, groups, prev } = data;

  return (
    <section aria-busy={loading}>
      {loading && (
        <p className="muted" role="status">
          Đang tải…
        </p>
      )}
      <div className="stat-row">
        <div className="stat">
          <span className="v">{fmtNumber(totals.total)}</span>
          <span className="l">Ticket cả phòng</span>
        </div>
        <div className="stat">
          <span className="v">{fmtNumber(totals.money)} đ</span>
          <span className="l">Tiền KPI</span>
        </div>
        <div className="stat">
          <span className="v">
            {totals.active} / {totals.people}
          </span>
          <span className="l">Người có báo cáo</span>
        </div>
      </div>

      <h2 className="sec-title">
        Theo team <span className="muted">so với {fmtDate(prev.from)} – {fmtDate(prev.to)}</span>
      </h2>
      <div className="scroll-x">
        <table className="team-table narrow" aria-label="Theo team">
          <thead>
            <tr>
              <th className="name">Team</th>
              <th>Ticket</th>
              <th>Kỳ trước</th>
              <th>Thay đổi</th>
              <th>Tiền</th>
              <th>Có BC / Người</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.team.id}>
                <th scope="row" className="name">
                  {t.team.name}
                </th>
                <LineCells l={t} />
              </tr>
            ))}
            <tr className="off">
              <th scope="row" className="name">
                Không thuộc team
              </th>
              <LineCells l={noTeam} />
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="name">
                Cả phòng
              </th>
              <LineCells l={totals} />
            </tr>
          </tfoot>
        </table>
      </div>

      <h2 className="sec-title">Nhóm kênh × team</h2>
      <div className="scroll-x">
        <table className="team-table narrow" aria-label="Nhóm kênh × team">
          <thead>
            <tr>
              <th className="name">Nhóm kênh</th>
              {teams.map((t) => (
                <th key={t.team.id} title={t.team.name}>
                  {t.team.shortName}
                </th>
              ))}
              <th>Không team</th>
              <th>Tổng</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.name}>
                <th scope="row" className="name">
                  {g.name}
                </th>
                {g.byTeam.map((n, i) => (
                  <td key={teams[i]?.team.id ?? i} className="num">
                    {fmtNumber(n)}
                  </td>
                ))}
                <td className="num">{fmtNumber(g.noTeam)}</td>
                <td className="num">{fmtNumber(g.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TrendCard team="all" title="Xu hướng cả phòng" initialUnit="month" />
    </section>
  );
}
