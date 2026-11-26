'use client';

import { toVnDate, type Period, type TeamMemberKpi } from '@ts24-htkh/shared';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { fmtDate, fmtNumber } from '../../lib/format';

const vnTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtInstant = (iso: string) => `${fmtDate(toVnDate(new Date(iso)))} ${vnTime.format(new Date(iso))}`;

/** Các dòng KPI của một thành viên trong kỳ, hiện ngay dưới bảng team. Chỉ xem. */
export function MemberPanel({ teamId, userId, range, onClose }: { teamId: string; userId: string; range: Period; onClose: () => void }) {
  const [data, setData] = useState<TeamMemberKpi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setData(null);
    setError(null);
    apiClient.kpi.member(teamId, userId, { from: range.start, to: range.end }).then(
      (d) => !stale && setData(d),
      (e: unknown) => !stale && setError(errorMessage(e)),
    );
    return () => {
      stale = true;
    };
  }, [teamId, userId, range]);

  return (
    <section className="member" aria-label="Chi tiết thành viên">
      <div className="head-row">
        <h3>{data ? `${data.fullName} · ${fmtNumber(data.items.length)} ticket · ${fmtNumber(data.money)} đ` : 'Đang tải…'}</h3>
        <button className="text-btn" type="button" onClick={onClose}>
          Đóng
        </button>
      </div>
      {error && (
        <p role="alert" className="banner-error">
          {error}
        </p>
      )}
      {data && (
        <table className="sent-table" aria-label="Dòng KPI của thành viên">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Thời điểm</th>
              <th style={{ width: 140 }}>Ticket</th>
              <th style={{ width: 200 }}>Kênh - Tình trạng</th>
              <th style={{ width: 220 }}>Phân loại</th>
              <th>Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i, idx) => (
              <tr key={`${i.createdAt}-${idx}`}>
                <td className="d">{fmtInstant(i.createdAt)}</td>
                <td className="t tk">{i.ticket}</td>
                <td className="k">{i.kenh}</td>
                <td className="k">{i.phanLoai}</td>
                <td className="n">{i.noiDung}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
