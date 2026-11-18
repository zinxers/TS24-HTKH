import type { Metadata } from 'next';
import { LoginForm } from '../../../features/auth/LoginForm';

export const metadata: Metadata = { title: 'Đăng nhập · TS24-HTKH' };

export default function LoginPage() {
  return <LoginForm />;
}
