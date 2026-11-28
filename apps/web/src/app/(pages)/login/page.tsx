import type { Metadata } from 'next';
import { Logo } from '../../../components/Logo';
import { LoginForm } from '../../../features/auth/LoginForm';

export const metadata: Metadata = { title: 'Đăng nhập · TS24-HTKH' };

export default function LoginPage() {
  return (
    <div className="login-page">
      <aside className="login-art">
        <Logo className="logo" />
        <div className="login-art-img" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trang trí, không cần tối ưu của next/image */}
          <img src="/login-art.png" alt="" width={690} height={539} />
        </div>
        <p className="login-art-title">TS24 - Nhà phát triển giải pháp số cho doanh nghiệp</p>
        <p className="login-art-foot">Công ty Cổ phần TS24 · Phòng Hỗ trợ Khách hàng</p>
      </aside>
      <main className="login-main">
        <Logo className="logo" />
        <LoginForm />
      </main>
    </div>
  );
}
