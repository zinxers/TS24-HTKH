import { toVnDate, type ReconcileFlag } from '@ts24-htkh/shared';
import { fmtDate, fmtNumber } from '../../lib/format';

const RULES: Record<ReconcileFlag['rule'], string> = {
  1: 'Tỉ lệ kênh giá cao',
  2: 'Lô lớn kênh giá cao',
  3: 'Một ticket nhiều kênh Hoàn Thành',
  4: 'Một ticket hai người',
};
const vnTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtAt = (iso: string) => `${vnTime.format(new Date(iso))} ${fmtDate(toVnDate(new Date(iso)))}`;

/** Danh sách "Cần xem lại": chỉ gợi ý, không đổi bảng hay file. */
export function ReconcileFlags({ flags }: { flags: ReconcileFlag[] }) {
  return (
    <section className="flags">
      <h2>
        Cần xem lại <span className="muted">({flags.length})</span>
      </h2>
      <p className="muted">Gợi ý để kiểm tra trước khi gửi, không thay đổi bảng hay file.</p>
      {flags.length === 0 ? (
        <p className="muted">Không có trường hợp cần xem lại trong khoảng này</p>
      ) : (
        <ul className="flag-list">
          {flags.map((f, i) => (
            <li key={i}>
              <span>
                <span className="tag">
                  QT{f.rule} · {RULES[f.rule]}
                </span>
                <span className="who">{f.people.map((p) => p.name).join(', ')}</span>{' '}
                <span className="muted">· {[...new Set(f.people.map((p) => p.team))].join(', ')}</span>
              </span>
              <span className="why">{f.text}</span>
              <span className="m">{fmtNumber(f.money)} đ</span>
              <details className="items">
                <summary>Xem các dòng</summary>
                {f.items.map((it, j) => (
                  <div key={j}>
                    {fmtAt(it.at)} · {it.ticket} · {it.kenh} · {it.name}
                  </div>
                ))}
                {f.more > 0 && <div>và {f.more} dòng nữa</div>}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
