import type { Reconcile } from '@ts24-htkh/shared';
import { fmtNumber } from '../../lib/format';

const HEADS = ['PI', 'PO', 'Chat', 'Email', 'PI', 'PO', 'Chat', 'Email', 'Team­viewer', 'Trường hợp khó', 'Chăm sóc KH'];

/** Bảng đối soát: 11 kênh + Tổng + KPI. Dòng Quản lý chỉ có tên, không tính KPI. */
export function ReconcileTable({ data }: { data: Reconcile }) {
  const count = (c: Reconcile['totals']['counts'], k: string) => (c as Record<string, number>)[k] ?? 0;
  return (
    <div className="rc-wrap">
      <table className="rc-table" aria-label="Đối soát KPI theo nhân viên">
        <colgroup>
          <col className="c-name" />
          <col className="c-tot" />
          <col className="c-k" span={11} />
          <col className="c-kpi" />
        </colgroup>
        <thead>
          <tr className="grp">
            <th />
            <th />
            <th className="g" colSpan={4}>
              Nhận thông tin
            </th>
            <th className="g" colSpan={7}>
              Hoàn thành
            </th>
            <th />
          </tr>
          <tr>
            <th>Họ và tên</th>
            <th>Tổng</th>
            {HEADS.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
            <th>KPI (đ)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="rate">
            <td>Đơn giá (đ)</td>
            <td />
            {data.rates.map((r, i) => (
              <td key={i}>{fmtNumber(r)}</td>
            ))}
            <td />
          </tr>
          {data.teams.map((t) => [
            <tr key={t.teamId} className="team">
              <td colSpan={14}>
                <span>{t.label}</span>
              </td>
            </tr>,
            ...t.rows.map((r) =>
              r.manager ? (
                <tr key={`${t.teamId}-${r.userId}`} className="mgr">
                  <td>{r.name}</td>
                  <td className="note" colSpan={13}>
                    Quản lý, không tính KPI
                  </td>
                </tr>
              ) : (
                <tr key={`${t.teamId}-${r.userId}`}>
                  <td>{r.name}</td>
                  <td>{fmtNumber(r.total)}</td>
                  {data.kenh.map((k, i) => (
                    <td key={i} className={count(r.counts, k) ? undefined : 'z'}>
                      {fmtNumber(count(r.counts, k))}
                    </td>
                  ))}
                  <td className="kpi">{fmtNumber(r.money)}</td>
                </tr>
              ),
            ),
          ])}
          <tr className="sum">
            <td>TỔNG</td>
            <td>{fmtNumber(data.totals.total)}</td>
            {data.kenh.map((k, i) => (
              <td key={i}>{fmtNumber(count(data.totals.counts, k))}</td>
            ))}
            <td>{fmtNumber(data.totals.money)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
