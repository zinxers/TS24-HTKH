import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '../../../components/shell/AppShell';
import { UserMenu } from '../../../features/profile/UserMenu';
import { SIDEBAR_COOKIE, parseSidebar } from '../../../lib/sidebar';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const collapsed = parseSidebar((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <AppShell initialCollapsed={collapsed} userMenu={<UserMenu />}>
      {children}
    </AppShell>
  );
}
