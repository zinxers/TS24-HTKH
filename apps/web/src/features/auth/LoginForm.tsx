'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, apiClient } from '../../lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiClient.auth.login({ email, password });
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Lỗi hệ thống, vui lòng thử lại');
      setPending(false);
    }
  }

  return (
    <form className="login-card" onSubmit={onSubmit} noValidate>
      <h1>Đăng nhập</h1>
      <p className="sub">Báo cáo và KPI của Phòng Hỗ trợ khách hàng.</p>
      <div className="login-field">
        <label htmlFor="email">Email</label>
        <div className="login-input">
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="ten@ts24.com.vn"
            required
            disabled={pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <div className="login-field">
        <label htmlFor="password">Mật khẩu</label>
        <div className="login-input">
          <input
            id="password"
            type={shown ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            required
            disabled={pending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="login-reveal"
            aria-controls="password"
            aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            disabled={pending}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? 'Ẩn' : 'Hiện'}
          </button>
        </div>
      </div>
      {error && (
        <div className="login-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.2v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="8" cy="11.4" r="1" fill="currentColor" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <button className="login-submit" type="submit" disabled={pending} aria-busy={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
      <div className="login-note">
        <p>Quên mật khẩu? Nhờ Trưởng phòng hoặc Quản lý team đặt lại.</p>
        <p>Nhập sai 10 lần thì phải chờ 15 phút mới thử lại được.</p>
      </div>
    </form>
  );
}
