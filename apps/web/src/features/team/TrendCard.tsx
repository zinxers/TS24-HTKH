'use client';

import { tsWeekNumber, type KpiTrend } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { fmtNumber } from '../../lib/format';

type Unit = KpiTrend['unit'];
const UNITS: { unit: Unit; label: string }[] = [
  { unit: 'week', label: '12 tuần' },
  { unit: 'month', label: '6 tháng' },
];

/** Cột ticket theo kỳ TS24, vẽ bằng CSS. `team` = uuid hoặc 'all' (cả phòng, cộng mọi team). */
export function TrendCard({ team, title, initialUnit = 'week' }: { team: string; title: string; initialUnit?: Unit }) {
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [data, setData] = useState<KpiTrend | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setError(null);
    apiClient.kpi.trend(team, unit).then(
      (d) => !stale && setData(d),
      (e: unknown) => !stale && (setData(null), setError(errorMessage(e))),
    );
    return () => {
      stale = true;
    };
  }, [team, unit]);

  const cols = (data?.periods ?? []).map((p) => ({
    label: unit === 'week' ? `T${tsWeekNumber(p.from)}` : `T${Number(p.to.slice(5, 7))}`,
    running: p.running,
    total: p.total,
    money: p.money,
  }));
  const max = Math.max(0, ...cols.map((c) => c.total));
  const name = `Ticket ${UNITS.find((u) => u.unit === unit)!.label} TS24 gần nhất`;

  return (
    <>
      <div className="head-row trend-head">
        <h2 className="sec-title">{title}</h2>
        <div className="chips" role="group" aria-label="Đơn vị xu hướng">
          {UNITS.map((u) => (
            <button key={u.unit} className="chip" type="button" aria-pressed={unit === u.unit} onClick={() => setUnit(u.unit)}>
              {u.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="banner-error">
          {error}
        </p>
      )}
      {data?.unit === unit &&
        !error &&
        (max === 0 ? (
          <p className="muted">Chưa có dữ liệu</p>
        ) : (
          <>
            <ul className={unit === 'month' ? 'trend m6' : 'trend'} aria-label={name}>
              {cols.map((c) => (
                <li
                  key={c.label}
                  className={c.running ? 'col running' : 'col'}
                  title={`${c.label}: ${fmtNumber(c.total)} ticket · ${fmtNumber(c.money)} đ`}
                >
                  <span className="b" style={{ height: `${(c.total * 100) / max}%` }} />
                  {c.label}
                </li>
              ))}
            </ul>
            <p className="muted">Cột mờ là kỳ đang chạy. Rê chuột vào cột để xem số ticket và tiền của kỳ.</p>
          </>
        ))}
    </>
  );
}
