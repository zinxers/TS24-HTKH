import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { parseTheme, THEME_COOKIE } from '../lib/theme';
import './globals.css';
import './controls.css';
import './dialogs.css';
import './accounts.css';
import './kpi.css';
import './team.css';
import './reports.css';
import './home.css';
import './shell.css';
import './motion.css';

export const metadata: Metadata = {
  title: 'TS24-HTKH',
  description: 'Hệ thống báo cáo hỗ trợ khách hàng',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Đọc cookie ở server để trang tải về đã đúng giao diện, không nhấp nháy.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="vi" data-theme={theme ?? undefined}>
      <body>{children}</body>
    </html>
  );
}
