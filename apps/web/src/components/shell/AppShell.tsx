'use client';

import { toVnDate, type CurrentUser } from '@ts24-htkh/shared';
import { MotionConfig, motion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, apiClient } from '../../lib/api-client';
import { CurrentUserContext, type CurrentUserValue } from '../../lib/current-user';
import { errorMessage } from '../../lib/errors';
import { saveSidebar } from '../../lib/sidebar';
import { Drawer } from './Drawer';
import { PageSkeleton } from './PageSkeleton';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useMediaQuery } from './useMediaQuery';

const ENTER = { duration: 0.35, ease: [0.22, 1, 0.36, 1] } as const;

interface AppShellProps {
  initialCollapsed: boolean;
  userMenu: ReactNode; // dùng useCurrentUser(): chỉ render khi đã có `me`
  children: ReactNode;
}

/** Khung app: lấy người dùng một lần, cấp context, thanh bên | tấm nội dung, ngăn kéo khi màn hẹp. */
export function AppShell({ initialCollapsed, userMenu, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const narrow = useMediaQuery('(max-width: 767px)');
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Xóa cookie cũ trước, nếu không proxy sẽ đưa /login về lại trang này.
  const leave = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch (e) {
      setNotice(errorMessage(e));
      return;
    }
    router.replace('/login');
  }, [router]);

  const load = useCallback(() => {
    apiClient.auth.me().then(setMe, (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) void leave();
      else setLoadError(errorMessage(e));
    });
  }, [leave]);

  useEffect(load, [load]);

  const value = useMemo<CurrentUserValue | null>(
    () => (me ? { me, setMe, notice, setNotice, leave } : null),
    [me, notice, leave],
  );

  const toggle = () => {
    setCollapsed(!collapsed);
    saveSidebar(!collapsed);
  };
  const retry = () => {
    setLoadError(null);
    load();
  };

  const role = me?.role ?? null;
  const menu = me ? userMenu : undefined;

  let body: ReactNode;
  if (me) body = children;
  else if (loadError)
    body = (
      <div className="load-error">
        <p role="alert">{loadError}</p>
        <button type="button" className="text-btn" onClick={retry}>
          Thử lại
        </button>
      </div>
    );
  else body = notice ? null : <PageSkeleton />;

  return (
    <MotionConfig reducedMotion="user">
      <CurrentUserContext.Provider value={value}>
        <div className="app">
          {narrow ? (
            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
              <Sidebar role={role} collapsed={false} onNavigate={() => setDrawerOpen(false)} userMenu={menu} />
            </Drawer>
          ) : (
            <Sidebar role={role} collapsed={collapsed} onToggle={toggle} userMenu={menu} />
          )}
          <main className="panel">
            <TopBar
              today={toVnDate(new Date())}
              onMenu={narrow ? () => setDrawerOpen(true) : undefined}
              menuOpen={drawerOpen}
            />
            {/* Chỉ phần này có transform; TopBar, thanh bên ở ngoài để menu position:fixed đo đúng. */}
            <motion.div key={pathname} className="content wide" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={ENTER}>
              {notice && (
                <p role="alert" className="banner-error">
                  {notice}
                </p>
              )}
              {body}
            </motion.div>
          </main>
        </div>
      </CurrentUserContext.Provider>
    </MotionConfig>
  );
}
