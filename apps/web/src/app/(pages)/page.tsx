'use client';

import type { CurrentUser } from '@ts24-htkh/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { AppBar } from '../../components/AppBar';
import { ROLE_LABEL } from '../../features/accounts/labels';
import { UserMenu } from '../../features/profile/UserMenu';
import { HOME_ART, type HomeArtKey } from '../../features/home/HomeArt';
import { ApiError, apiClient } from '../../lib/api-client';

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
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [logoutError] = useState<string | null>(null);

  useEffect(() => {
    const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Lỗi hệ thống, vui lòng thử lại');
    apiClient.auth.me().then(setUser, async (e: unknown) => {
      if (!(e instanceof ApiError && e.status === 401)) return fail(e);
      // Xóa cookie cũ trước, nếu không proxy sẽ đưa /login về lại `/`. Xóa lỗi thì báo, không chuyển (tránh vòng lặp).
      try {
        await apiClient.auth.logout();
      } catch (logoutFailure) {
        return fail(logoutFailure);
      }
      router.replace('/login');
    });
  }, [router, attempt]);

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

  return (
    <>
      <AppBar userMenu={user && <UserMenu />} />
      <main className="content">
        {user ? (
          <>
            {logoutError && (
              <p role="alert" className="banner-error">
                {logoutError}
              </p>
            )}
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
        ) : error ? (
          <div className="load-error">
            <p role="alert">{error}</p>
            <button className="text-btn" type="button" onClick={retry}>
              Thử lại
            </button>
          </div>
        ) : (
          <p aria-busy="true">Đang tải…</p>
        )}
      </main>
    </>
  );
}
