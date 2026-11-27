'use client';

import { previousPeriod, runningMonthPeriod, toVnDate, type Period, type Reconcile } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';
import { ApiError, apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { fmtNumber } from '../../lib/format';
import { PeriodPicker } from '../kpi/PeriodPicker';
import { ReconcileFlags } from './ReconcileFlags';
import { ReconcileTable } from './ReconcileTable';
import { saveBlob } from './saveBlob';

/** Tab Đối soát KPI (chỉ Trưởng phòng; API kiểm quyền). Chỉ xem và tải nên không hỏi xác nhận. */
export function ReconcilePanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [range, setRange] = useState<Period>(() => previousPeriod(runningMonthPeriod(toVnDate(new Date()))));
  const [data, setData] = useState<Reconcile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fail = (e: unknown) => (e instanceof ApiError && e.status === 401 ? onUnauthorized() : setError(errorMessage(e)));

  useEffect(() => {
    let stale = false;
    setError(null);
    setData(null);
    apiClient.reports.reconcile({ from: range.start, to: range.end }).then(
      (d) => !stale && setData(d),
      (e: unknown) => {
        if (stale) return;
        setData(null);
        fail(e);
      },
    );
    return () => {
      stale = true;
    };
  }, [range]);

  const download = () => {
    if (downloading) return;
    setError(null);
    setDownloading(true);
    apiClient.reports
      .reconcileFile({ from: range.start, to: range.end })
      .then(({ blob, fileName }) => saveBlob(blob, fileName))
      .catch(fail)
      .finally(() => setDownloading(false));
  };

  return (
    <>
      <PeriodPicker value={range} onChange={setRange} defaultPreset="Tháng trước" />
      {error && (
        <p role="alert" className="banner-error">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="v">{fmtNumber(data.totals.total)}</span>
              <span className="l">Ticket tính KPI (không gồm Nhận thông tin)</span>
            </div>
            <div className="stat">
              <span className="v">{fmtNumber(data.totals.money)}</span>
              <span className="l">Tổng tiền KPI (đ)</span>
            </div>
            <div className="stat">
              <span className="v">{data.teams.reduce((n, t) => n + t.rows.filter((r) => !r.manager).length, 0)}</span>
              <span className="l">Nhân viên có dòng</span>
            </div>
          </div>
          {data.rateChanged && (
            <p className="rc-warn">
              <b>Đơn giá đổi trong khoảng này.</b> Cột KPI tính theo đơn giá ngày cuối khoảng (dòng đơn giá), nên có thể khác KPI tạm tính.
            </p>
          )}
          <ReconcileTable data={data} />
          <div className="dl">
            <button type="button" className="btn btn-primary" onClick={download} disabled={downloading}>
              Tải file xlsx
            </button>
            <span className="muted">{data.fileName}</span>
          </div>
          <ReconcileFlags flags={data.flags} />
        </>
      )}
    </>
  );
}
