import { SESSION_COOKIE } from '@ts24-htkh/core';
import { cookies } from 'next/headers';

// Không Max-Age: cookie theo phiên trình duyệt; hạn thật do DB giữ.
const ATTRS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const;

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value || undefined;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { ...ATTRS });
}

export async function clearSessionCookie(): Promise<void> {
  // __Host- cần Secure + Path=/ cả khi xóa.
  (await cookies()).set(SESSION_COOKIE, '', { ...ATTRS, maxAge: 0 });
}
