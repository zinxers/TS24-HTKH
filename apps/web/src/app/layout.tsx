import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './controls.css';
import './dialogs.css';
import './accounts.css';
import './kpi.css';
import './team.css';
import './reports.css';

export const metadata: Metadata = {
  title: 'TS24-HTKH',
  description: 'Hệ thống báo cáo hỗ trợ khách hàng',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
