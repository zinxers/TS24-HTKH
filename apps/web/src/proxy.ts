import { SESSION_COOKIE } from '@ts24-htkh/shared';
import { NextResponse, type NextRequest } from 'next/server';

// Chỉ gợi ý điều hướng theo cookie có/không; luật thật ở API (requireUser).
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.next();
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession && pathname !== '/login') return NextResponse.redirect(new URL('/login', req.url));
  if (hasSession && pathname === '/login') return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = {
  // Bỏ tài nguyên tĩnh và mọi đường dẫn có đuôi file (robots.txt, ảnh trong public/).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};
