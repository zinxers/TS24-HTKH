import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'TS24-HTKH',
  description: 'Hệ thống báo cáo hỗ trợ khách hàng',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 16 }}>{children}</body>
    </html>
  );
}
