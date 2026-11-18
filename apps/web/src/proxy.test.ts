// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const COOKIE = '__Host-ts24-htkh-session';

function run(path: string, withCookie: boolean) {
  const req = new NextRequest(new URL(path, 'http://localhost:3000'));
  if (withCookie) req.cookies.set(COOKIE, 'tok');
  const res = proxy(req);
  return { status: res.status, location: res.headers.get('location') };
}

describe('proxy', () => {
  it('không cookie vào / → /login', () => {
    expect(run('/', false)).toEqual({ status: 307, location: 'http://localhost:3000/login' });
  });

  it('không cookie vào /login → đi tiếp', () => {
    expect(run('/login', false).location).toBeNull();
  });

  it('có cookie vào /login → /', () => {
    expect(run('/login', true)).toEqual({ status: 307, location: 'http://localhost:3000/' });
  });

  it('có cookie vào / → đi tiếp', () => {
    expect(run('/', true).location).toBeNull();
  });

  it('API không bị chuyển hướng', () => {
    expect(run('/api/v1/auth/me', false).location).toBeNull();
  });

  it('matcher bỏ tài nguyên tĩnh', () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test('/')).toBe(true);
    expect(re.test('/login')).toBe(true);
    for (const path of ['/_next/static/a.js', '/_next/image', '/favicon.ico', '/robots.txt', '/icons/icon.png']) {
      expect(re.test(path)).toBe(false);
    }
  });
});
