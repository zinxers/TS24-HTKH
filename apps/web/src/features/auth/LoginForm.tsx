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
    <form className="signin" onSubmit={onSubmit} noValidate>
      <div className="mark" aria-hidden="true">
        HT
      </div>
      <h1>Đăng nhập</h1>
      <p className="sub">Hệ thống báo cáo Phòng Hỗ trợ khách hàng TS24</p>
      <div className="group">
        <div className="field">
          <label htmlFor="email">Email</label>
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
        <div className="field">
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Bắt buộc"
            required
            disabled={pending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.2v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="8" cy="11.4" r="1" fill="currentColor" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <button className="primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
      <p className="note">Quên mật khẩu? Liên hệ Quản lý hoặc Trưởng phòng.</p>
    </form>
  );
}
