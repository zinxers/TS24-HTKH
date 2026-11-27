'use client';

import { KENH, KENH_GROUPS, toVnDate, type IsoDate, type Kenh, type RateVersion } from '@ts24-htkh/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, FormDialog } from '../../components/FormDialog';
import { apiClient } from '../../lib/api-client';
import { errorMessage } from '../accounts/labels';
import { useConfirmAction } from '../accounts/useConfirmAction';
import { fmtDate, fmtNumber } from '../../lib/format';
import { useCurrentUser } from '../../lib/current-user';

// Bản mặc định do migration tạo; bản khác có thể có createdBy null (dữ liệu seed).
const DEFAULT_FROM = '2000-01-01';

/** "1.800", "1800", " 1 800 " → 1800; ô trống hoặc không phải số → NaN (API trả lỗi tiếng Việt). */
const parseAmount = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/[.\s]/g, '')));

/** Lịch sử đơn giá (mọi người xem) và nút đổi đơn giá (chỉ Trưởng phòng; API mới là luật). */
export function RatesPanel() {
  const { me, setNotice, leave } = useCurrentUser();
  const [versions, setVersions] = useState<RateVersion[] | null>(null);
  const [editing, setEditing] = useState(false);
  const action = useConfirmAction(() => void leave());

  useEffect(() => {
    apiClient.kpi.rates().then(setVersions, (e: unknown) => setNotice(errorMessage(e)));
  }, [setNotice]);

  const today = toVnDate(new Date());
  // Mới nhất trước; hiện hành = phiên bản mới nhất đã có hiệu lực hôm nay.
  const shown = versions ? [...versions].reverse() : [];
  const current = shown.find((v) => v.from <= today);

  function save(data: FormData) {
    const from = String(data.get('from') ?? '') as IsoDate;
    const rates = Object.fromEntries(KENH.map((k) => [k, parseAmount(String(data.get(k) ?? ''))])) as Record<Kenh, number>;
    action.ask({
      title: 'Lưu đơn giá mới?',
      message: `Đơn giá mới áp dụng từ ${fmtDate(from)}. Kỳ đã qua giữ đơn giá cũ.`,
      confirmLabel: 'Lưu',
      run: async () => {
        setVersions(await apiClient.kpi.setRates({ from, rates }));
        setEditing(false);
      },
    });
  }

  return (
    <>
      <div className="section-actions">
        <div>
          <h1>Đơn giá</h1>
          <p className="muted">Mỗi phiên bản áp dụng từ ngày hiệu lực.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" href="/kpi/mine">
            KPI của tôi
          </Link>
          {me.role === 'head' && versions && (
            <button className="btn btn-primary" type="button" onClick={() => setEditing(true)}>
              Đổi đơn giá
            </button>
          )}
        </div>
      </div>

      {versions && (
        <div className="table-wrap rate-wrap">
          <table className="rate-table" aria-label="Lịch sử đơn giá">
            <thead>
              <tr>
                <th>Kênh - Tình trạng</th>
                {shown.map((v) => (
                  <th key={v.from} className={v === current ? 'ver cur' : 'ver'}>
                    {v.from === DEFAULT_FROM ? 'Mặc định' : `Từ ${fmtDate(v.from)}`}
                    {v === current && <span className="badge">Hiện hành</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KENH_GROUPS.flatMap((g) => [
                <tr className="grp" key={`g:${g.name}`}>
                  <th scope="row" colSpan={shown.length + 1}>
                    {g.name}
                  </th>
                </tr>,
                ...g.kenh.map((k) => (
                  <tr key={`k:${k}`}>
                    <td className="kenh">{k}</td>
                    {shown.map((v) => (
                      <td key={v.from} className={v === current ? 'num cur' : 'num'}>
                        {fmtNumber(v.rates[k])}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}

      {editing && current && (
        <FormDialog
          title="Đổi đơn giá"
          submitLabel="Lưu"
          hint="Số nguyên đồng, từ 0 đến 1.000.000. Kỳ đã qua giữ đơn giá cũ."
          error={action.error}
          busy={action.busy}
          onSubmit={save}
          onCancel={() => setEditing(false)}
        >
          <Field label="Ngày áp dụng">{(id) => <input id={id} name="from" type="date" defaultValue={today} required />}</Field>
          {KENH_GROUPS.map((g) => (
            <div key={g.name}>
              <p className="group-cap">{g.name}</p>
              {g.kenh.map((k) => (
                <Field key={k} label={k}>
                  {(id) => (
                    <>
                      <input id={id} name={k} className="amt" inputMode="numeric" defaultValue={fmtNumber(current.rates[k])} />
                      <span className="unit">đ</span>
                    </>
                  )}
                </Field>
              ))}
            </div>
          ))}
        </FormDialog>
      )}
      <ConfirmDialog {...action.dialogProps} />
    </>
  );
}
