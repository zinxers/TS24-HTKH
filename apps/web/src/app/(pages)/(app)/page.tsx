'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ROLE_LABEL } from '../../../features/accounts/labels';
import { HOME_ART, type HomeArtKey } from '../../../features/home/HomeArt';
import { useCurrentUser } from '../../../lib/current-user';

interface Tile {
  href: string;
  title: string;
  desc: string;
  art: HomeArtKey;
  /** Chỉ Quản lý và Trưởng phòng (giao diện chỉ gợi ý; API mới là luật). */
  lead?: boolean;
  size?: 'wide' | 'full';
}

const TILES: Tile[] = [
  { href: '/kpi', title: 'Báo cáo KPI', desc: 'Nhập số ticket theo kênh và loại việc cho kỳ đang chạy.', art: 'kpi', size: 'wide' },
  { href: '/kpi/mine', title: 'KPI của tôi', desc: 'Xem lại các kỳ đã gửi và kết quả KPI của bạn.', art: 'mine' },
  { href: '/kpi/rates', title: 'Đơn giá KPI', desc: 'Đơn giá theo loại việc đang áp dụng cho từng team.', art: 'rates' },
  { href: '/team', title: 'KPI theo team', desc: 'So sánh kết quả các team và xem chi tiết từng người.', art: 'team', lead: true },
  { href: '/reports', title: 'Báo cáo tổng hợp', desc: 'Báo cáo tuần, tháng, quý và tải file xlsx đã ký.', art: 'reports', lead: true },
  {
    href: '/accounts',
    title: 'Quản lý tài khoản',
    desc: 'Thêm, khoá tài khoản, phân team, đặt lại mật khẩu và sửa họ tên.',
    art: 'accounts',
    lead: true,
    size: 'full',
  },
];

export default function Page() {
  const { me: user } = useCurrentUser();

  return (
    <>
      <section className="home-hero">
        <h1>Xin chào, {user.fullName}</h1>
        <p>
          {ROLE_LABEL[user.role]} · {user.email}
        </p>
      </section>
      <nav className={user.role === 'staff' ? 'tiles two' : 'tiles'} aria-label="Thao tác">
        {TILES.filter((t) => !t.lead || user.role !== 'staff').map((t, i) => (
          <Link key={t.href} className={`tile ${t.size ?? ''}`} href={t.href} style={{ '--i': i } as CSSProperties}>
            <div className="text">
              <h2>{t.title}</h2>
              <p>{t.desc}</p>
            </div>
            <div className="art" aria-hidden="true">
              {HOME_ART[t.art]}
            </div>
            <span className="go" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
