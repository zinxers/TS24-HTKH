'use client';

import {
  KENH_GROUPS,
  MAX_RANGE_DAYS,
  isIsoDate,
  previousPeriod,
  quarterPeriod,
  runningMonthPeriod,
  toVnDate,
  weekPeriod,
  type IsoDate,
  type KpiLine,
  type MyKpi,
  type Period,
} from '@ts24-htkh/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { KpiShell, fmtDate, fmtNumber, useKpiUser } from './KpiShell';

const PRESETS: { label: string; of: (today: IsoDate) => Period }[] = [
  { label: 'Tuần này', of: weekPeriod },
  { label: 'Tuần trước', of: (t) => previousPeriod(weekPeriod(t)) },
  { label: 'Tháng này', of: runningMonthPeriod },
  { label: 'Tháng trước', of: (t) => previousPeriod(runningMonthPeriod(t)) },
  { label: 'Quý này', of: (t) => quarterPeriod(t) },
  { label: 'Quý trước', of: (t) => quarterPeriod(t, -1) },
];
const DEFAULT_PRESET = 'Tháng này';

/** KPI của chính người đăng nhập theo khoảng ngày; mặc định kỳ tháng đang chạy. */
export function MyKpiScreen() {
  const { me, notice, setNotice } = useKpiUser();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [preset, setPreset] = useState<string | null>(DEFAULT_PRESET);
  const [range, setRange] = useState<Period>(() => PRESETS[2]!.of(toVnDate(new Date())));
  const [kpi, setKpi] = useState<MyKpi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.teamId) return;
    // Tên team chỉ để hiển thị; không tải được thì bỏ qua.
    apiClient.teams.list().then(
      (teams) => setTeamName(teams.find((t) => t.id === me.teamId)?.name ?? null),
      () => undefined,
    );
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let stale = false;
    setError(null);
    apiClient.kpi.mine({ from: range.start, to: range.end }).then(
      (data) => !stale && setKpi(data),
      (e: unknown) => !stale && (setKpi(null), setError(errorMessage(e))),
    );
    return () => {
      stale = true;
    };
  }, [me, range]);

  const pick = (p: (typeof PRESETS)[number]) => {
    setPreset(p.label);
    setRange(p.of(toVnDate(new Date())));
  };
  const edit = (key: keyof Period, value: string) => {
    setPreset(null);
    if (isIsoDate(value)) setRange((r) => ({ ...r, [key]: value }));
  };

  return (
    <KpiShell me={me} notice={notice} onNotice={setNotice}>
      <div className="page-head">
        <div>
          <h1>KPI của tôi</h1>
          {teamName && <p className="count">{teamName}</p>}
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" href="/kpi/rates">
            Đơn giá
          </Link>
          <Link className="btn btn-secondary" href="/kpi">
            Nhập KPI
          </Link>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Chọn kỳ nhanh">
        {PRESETS.map((p) => (
          <button key={p.label} className="chip" type="button" aria-pressed={preset === p.label} onClick={() => pick(p)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="range">
        <label>
          Từ ngày
          <input className="kin" type="date" value={range.start} onChange={(e) => edit('start', e.target.value)} />
        </label>
        <label>
          Đến ngày
          <input className="kin" type="date" value={range.end} onChange={(e) => edit('end', e.target.value)} />
        </label>
        <p className="range-note">Chọn tay từ ngày – đến ngày thì chip kỳ nhanh bỏ chọn. Tối đa {MAX_RANGE_DAYS} ngày.</p>
      </div>

      {error && (
        <p role="alert" className="banner-error">
          {error}
        </p>
      )}
      {kpi && <KpiResult kpi={kpi} />}
    </KpiShell>
  );
}

function KpiResult({ kpi }: { kpi: MyKpi }) {
  const line = (kenh: string) => kpi.lines.find((l) => l.kenh === kenh) as KpiLine;
  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <span className="v">{fmtNumber(kpi.tongSoLuong)}</span>
          <span className="l">Tổng số lượng</span>
        </div>
        <div className="stat">
          <span className="v">{fmtNumber(kpi.tongTien)} đ</span>
          <span className="l">Tổng thành tiền</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="sum-table" aria-label="Tổng hợp theo kênh">
          <thead>
            <tr>
              <th>Kênh - Tình trạng</th>
              <th className="num">Số lượng</th>
              <th className="num">Đơn giá</th>
              <th className="num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {KENH_GROUPS.map((g) => {
              const lines = g.kenh.map(line);
              return [
                <tr className="grp" key={`g:${g.name}`}>
                  <th scope="row">{g.name}</th>
                  <td className="num">{fmtNumber(lines.reduce((s, l) => s + l.soLuong, 0))}</td>
                  <td />
                  <td className="num">{fmtNumber(lines.reduce((s, l) => s + l.thanhTien, 0))}</td>
                </tr>,
                ...lines.map((l) => (
                  <tr key={`k:${l.kenh}`}>
                    <td className="kenh">{l.kenh}</td>
                    <td className="num">{fmtNumber(l.soLuong)}</td>
                    {l.donGia === null ? (
                      <td className="num multi">Nhiều mức</td>
                    ) : (
                      <td className="num">{fmtNumber(l.donGia)}</td>
                    )}
                    <td className="num">{fmtNumber(l.thanhTien)}</td>
                  </tr>
                )),
              ];
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Tổng</th>
              <td className="num">{fmtNumber(kpi.tongSoLuong)}</td>
              <td />
              <td className="num">{fmtNumber(kpi.tongTien)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted">
        &quot;Nhiều mức&quot;: trong kỳ có hơn một đơn giá nên chỉ hiện thành tiền. Đơn vị: đồng.
      </p>

      <h2 className="sec-title">
        Dòng đã gửi <span className="muted">· {fmtNumber(kpi.items.length)} dòng, mới nhất trước</span>
      </h2>
      <div className="table-wrap">
        <table className="sent-table" aria-label="Dòng đã gửi">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Ngày</th>
              <th style={{ width: 140 }}>Ticket</th>
              <th style={{ width: 200 }}>Kênh - Tình trạng</th>
              <th style={{ width: 220 }}>Phân loại</th>
              <th>Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {kpi.items.map((i, idx) => (
              <tr key={`${i.createdAt}-${idx}`}>
                <td className="d">{fmtDate(toVnDate(new Date(i.createdAt)))}</td>
                <td className="t tk">{i.ticket}</td>
                <td className="k">{i.kenh}</td>
                <td className="k">{i.phanLoai}</td>
                <td className="n">{i.noiDung}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
